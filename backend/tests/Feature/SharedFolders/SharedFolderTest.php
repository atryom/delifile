<?php

namespace Tests\Feature\SharedFolders;

use App\Models\File;
use App\Models\User;
use App\Models\Contact;
use App\Models\SharedFolder;
use App\Models\SharedFolderAccess;
use App\Models\SharedFolderFile;
use App\Models\SharedFolderLink;
use Tests\TestCase;

class SharedFolderTest extends TestCase
{
    // ─── Folder CRUD ─────────────────────────────────────────────────────────

    public function test_user_can_list_shared_folders(): void
    {
        $user = User::factory()->create();
        SharedFolder::factory()->create(['owner_id' => $user->id]);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/shared-folders');

        $response->assertOk()
            ->assertJsonPath('result', 'success')
            ->assertJsonStructure(['data' => ['items']]);
    }

    public function test_user_can_create_shared_folder(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/shared-folders', ['name' => 'Team Space']);

        $response->assertStatus(201)
            ->assertJsonPath('result', 'success')
            ->assertJsonPath('data.folder.name', 'Team Space')
            ->assertJsonPath('data.folder.is_owner', true);

        $this->assertDatabaseHas('shared_folders', [
            'owner_id' => $user->id,
            'name'     => 'Team Space',
        ]);
    }

    public function test_owner_can_update_shared_folder(): void
    {
        $user = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $user->id]);

        $response = $this->actingAs($user)
            ->patchJson("/api/v1/shared-folders/{$folder->id}", ['name' => 'Renamed']);

        $response->assertOk()
            ->assertJsonPath('data.folder.name', 'Renamed');
    }

    public function test_non_owner_cannot_update_shared_folder(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $owner->id]);

        $response = $this->actingAs($other)
            ->patchJson("/api/v1/shared-folders/{$folder->id}", ['name' => 'Hacked']);

        $response->assertStatus(403);
    }

    public function test_owner_can_delete_shared_folder(): void
    {
        $user = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $user->id]);

        $response = $this->actingAs($user)
            ->deleteJson("/api/v1/shared-folders/{$folder->id}");

        $response->assertOk();
        $this->assertDatabaseMissing('shared_folders', ['id' => $folder->id]);
    }

    public function test_non_owner_cannot_delete_shared_folder(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $owner->id]);

        $response = $this->actingAs($other)
            ->deleteJson("/api/v1/shared-folders/{$folder->id}");

        $response->assertStatus(403);
    }

    // ─── Subfolders ──────────────────────────────────────────────────────────

    public function test_owner_can_create_subfolder(): void
    {
        $user = User::factory()->create();
        $parent = SharedFolder::factory()->create(['owner_id' => $user->id]);

        $response = $this->actingAs($user)
            ->postJson("/api/v1/shared-folders/{$parent->id}/subfolders", ['name' => 'Child']);

        $response->assertStatus(201)
            ->assertJsonPath('data.folder.name', 'Child');
    }

    public function test_user_with_edit_access_can_create_subfolder(): void
    {
        $owner = User::factory()->create();
        $editor = User::factory()->create();
        $parent = SharedFolder::factory()->create(['owner_id' => $owner->id]);
        SharedFolderAccess::factory()->edit()->create([
            'shared_folder_id' => $parent->id,
            'user_id'          => $editor->id,
        ]);

        $response = $this->actingAs($editor)
            ->postJson("/api/v1/shared-folders/{$parent->id}/subfolders", ['name' => 'Child']);

        $response->assertStatus(201);
    }

    public function test_user_with_view_access_cannot_create_subfolder(): void
    {
        $owner = User::factory()->create();
        $viewer = User::factory()->create();
        $parent = SharedFolder::factory()->create(['owner_id' => $owner->id]);
        SharedFolderAccess::factory()->create([
            'shared_folder_id' => $parent->id,
            'user_id'          => $viewer->id,
        ]);

        $response = $this->actingAs($viewer)
            ->postJson("/api/v1/shared-folders/{$parent->id}/subfolders", ['name' => 'Child']);

        $response->assertStatus(403);
    }

    // ─── Accesses ────────────────────────────────────────────────────────────

    public function test_owner_can_list_accesses(): void
    {
        $user = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $user->id]);

        $response = $this->actingAs($user)
            ->getJson("/api/v1/shared-folders/{$folder->id}/accesses");

        $response->assertOk()
            ->assertJsonPath('result', 'success');
    }

    public function test_non_owner_cannot_list_accesses(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $owner->id]);

        $response = $this->actingAs($other)
            ->getJson("/api/v1/shared-folders/{$folder->id}/accesses");

        $response->assertStatus(403);
    }

    public function test_owner_can_add_access_via_resolved_contact(): void
    {
        $owner = User::factory()->create();
        $recipient = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $owner->id]);
        $contact = Contact::factory()->resolvedTo($recipient)->create([
            'user_id' => $owner->id,
        ]);

        $response = $this->actingAs($owner)
            ->postJson("/api/v1/shared-folders/{$folder->id}/accesses", [
                'contact_id'  => $contact->id,
                'access_type' => 'view',
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('result', 'success');
    }

    public function test_owner_can_remove_access(): void
    {
        $owner = User::factory()->create();
        $recipient = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $owner->id]);
        $contact = Contact::factory()->resolvedTo($recipient)->create([
            'user_id' => $owner->id,
        ]);
        $access = SharedFolderAccess::factory()->create([
            'shared_folder_id' => $folder->id,
            'user_id'          => $recipient->id,
            'contact_id'       => $contact->id,
        ]);

        $response = $this->actingAs($owner)
            ->deleteJson("/api/v1/shared-folders/{$folder->id}/accesses/{$access->id}");

        $response->assertOk();
        $this->assertDatabaseMissing('shared_folder_accesses', ['id' => $access->id]);
    }

    public function test_adding_duplicate_access_fails(): void
    {
        $owner = User::factory()->create();
        $recipient = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $owner->id]);
        $contact = Contact::factory()->resolvedTo($recipient)->create([
            'user_id' => $owner->id,
        ]);
        SharedFolderAccess::factory()->create([
            'shared_folder_id' => $folder->id,
            'user_id'          => $recipient->id,
            'contact_id'       => $contact->id,
        ]);

        $response = $this->actingAs($owner)
            ->postJson("/api/v1/shared-folders/{$folder->id}/accesses", [
                'contact_id'  => $contact->id,
                'access_type' => 'view',
            ]);

        $response->assertStatus(422)
            ->assertJsonPath('data.code', 'DUPLICATE_ACCESS');
    }

    // ─── Links ───────────────────────────────────────────────────────────────

    public function test_owner_can_list_links(): void
    {
        $user = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $user->id]);

        $response = $this->actingAs($user)
            ->getJson("/api/v1/shared-folders/{$folder->id}/links");

        $response->assertOk()
            ->assertJsonPath('result', 'success');
    }

    public function test_owner_can_create_link(): void
    {
        $user = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $user->id]);

        $response = $this->actingAs($user)
            ->postJson("/api/v1/shared-folders/{$folder->id}/links", [
                'access_type' => 'view',
                'ttl_hours'   => 24,
                'allow_save'  => false,
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('result', 'success')
            ->assertJsonStructure(['data' => ['link' => ['id', 'url', 'status', 'access_type', 'expires_at']]]);
    }

    public function test_owner_can_disable_link(): void
    {
        $user = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $user->id]);
        $link = SharedFolderLink::create([
            'shared_folder_id' => $folder->id,
            'created_by'       => $user->id,
            'access_type'      => 'view',
            'allow_save'       => false,
            'status'           => 'active',
            'ttl_hours'        => 24,
            'expires_at'       => now()->addHours(24),
        ]);

        $response = $this->actingAs($user)
            ->postJson("/api/v1/shared-folders/{$folder->id}/links/{$link->id}/disable");

        $response->assertOk();
        $this->assertDatabaseHas('shared_folder_links', [
            'id'     => $link->id,
            'status' => 'disabled',
        ]);
    }

    public function test_non_owner_cannot_create_link(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $owner->id]);

        $response = $this->actingAs($other)
            ->postJson("/api/v1/shared-folders/{$folder->id}/links", [
                'access_type' => 'view',
                'ttl_hours'   => 24,
                'allow_save'  => false,
            ]);

        $response->assertStatus(403);
    }

    // ─── Leave ───────────────────────────────────────────────────────────────

    public function test_member_can_leave_shared_folder(): void
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $owner->id]);
        SharedFolderAccess::factory()->create([
            'shared_folder_id' => $folder->id,
            'user_id'          => $member->id,
        ]);

        $response = $this->actingAs($member)
            ->deleteJson("/api/v1/shared-folders/{$folder->id}/leave");

        $response->assertOk();
    }

    public function test_owner_cannot_leave_their_own_folder(): void
    {
        $user = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $user->id]);

        $response = $this->actingAs($user)
            ->deleteJson("/api/v1/shared-folders/{$folder->id}/leave");

        $response->assertStatus(422)
            ->assertJsonPath('data.code', 'OWNER_CANNOT_LEAVE');
    }

    // ─── Public link ─────────────────────────────────────────────────────────

    public function test_public_can_resolve_valid_shared_link(): void
    {
        $user = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $user->id]);
        $link = SharedFolderLink::create([
            'shared_folder_id' => $folder->id,
            'created_by'       => $user->id,
            'access_type'      => 'view',
            'allow_save'       => false,
            'status'           => 'active',
            'ttl_hours'        => 24,
            'expires_at'       => now()->addHours(24),
        ]);

        $response = $this->postJson("/api/v1/shared-links/{$link->token}/resolve");

        $response->assertOk()
            ->assertJsonPath('result', 'success')
            ->assertJsonPath('data.folder.name', $folder->name);
    }

    public function test_resolving_expired_shared_link_fails(): void
    {
        $user = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $user->id]);
        $link = SharedFolderLink::create([
            'shared_folder_id' => $folder->id,
            'created_by'       => $user->id,
            'access_type'      => 'view',
            'allow_save'       => false,
            'status'           => 'active',
            'ttl_hours'        => 1,
            'expires_at'       => now()->subHour(),
        ]);

        $response = $this->postJson("/api/v1/shared-links/{$link->token}/resolve");

        $response->assertStatus(410)
            ->assertJsonPath('data.code', 'LINK_INVALID');
    }

    // ─── All flat ────────────────────────────────────────────────────────────

    public function test_user_can_get_all_flat_shared_folders(): void
    {
        $user = User::factory()->create();
        SharedFolder::factory()->count(2)->create(['owner_id' => $user->id]);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/shared-folders/all-flat');

        $response->assertOk()
            ->assertJsonPath('result', 'success');
    }

    public function test_unauthenticated_user_cannot_access_shared_folders(): void
    {
        $response = $this->getJson('/api/v1/shared-folders');
        $response->assertUnauthorized();
    }

    // ─── Files listing ──────────────────────────────────────────────────────

    public function test_owner_can_list_files_in_shared_folder(): void
    {
        $user = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $user->id]);
        $file = File::factory()->create(['owner_id' => $user->id]);
        SharedFolderFile::create([
            'shared_folder_id' => $folder->id,
            'file_id'          => $file->id,
            'added_by'         => $user->id,
        ]);

        $response = $this->actingAs($user)
            ->getJson("/api/v1/shared-folders/{$folder->id}/files");

        $response->assertOk()
            ->assertJsonPath('result', 'success')
            ->assertJsonStructure(['data' => ['items', 'pagination']]);
    }

    public function test_non_member_cannot_list_files_in_shared_folder(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $owner->id]);

        $response = $this->actingAs($other)
            ->getJson("/api/v1/shared-folders/{$folder->id}/files");

        $response->assertStatus(403);
    }

    // ─── Init upload (permission only — upload logic tested in FileUploadTest) ─

    public function test_viewer_cannot_init_upload_to_folder(): void
    {
        $owner = User::factory()->create();
        $viewer = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $owner->id]);
        SharedFolderAccess::factory()->create([
            'shared_folder_id' => $folder->id,
            'user_id'          => $viewer->id,
        ]);

        $response = $this->actingAs($viewer)
            ->postJson("/api/v1/shared-folders/{$folder->id}/init-upload", [
                'original_name' => 'doc.pdf',
                'size'          => 1024,
                'mime_type'     => 'application/pdf',
            ]);

        $response->assertStatus(403);
    }

    // ─── URL file ───────────────────────────────────────────────────────────

    public function test_user_with_edit_access_can_add_url_file_to_folder(): void
    {
        $owner = User::factory()->create();
        $editor = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $owner->id]);
        SharedFolderAccess::factory()->edit()->create([
            'shared_folder_id' => $folder->id,
            'user_id'          => $editor->id,
        ]);

        $response = $this->actingAs($editor)
            ->postJson("/api/v1/shared-folders/{$folder->id}/url-file", [
                'url' => 'https://example.com',
            ]);

        $response->assertStatus(201)
            ->assertJsonStructure(['data' => ['file']]);

        $fileId = $response->json('data.file.id');
        $this->assertDatabaseHas('shared_folder_files', [
            'shared_folder_id' => $folder->id,
            'file_id'          => $fileId,
        ]);
    }

    public function test_add_url_file_requires_valid_url(): void
    {
        $owner = User::factory()->create();
        $editor = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $owner->id]);
        SharedFolderAccess::factory()->edit()->create([
            'shared_folder_id' => $folder->id,
            'user_id'          => $editor->id,
        ]);

        $response = $this->actingAs($editor)
            ->postJson("/api/v1/shared-folders/{$folder->id}/url-file", [
                'url' => 'not-a-url',
            ]);

        $response->assertStatus(422);
    }

    // ─── Subfolders listing ─────────────────────────────────────────────────

    public function test_user_can_list_subfolders(): void
    {
        $user = User::factory()->create();
        $parent = SharedFolder::factory()->create(['owner_id' => $user->id]);
        SharedFolder::factory()->create([
            'owner_id'  => $user->id,
            'parent_id' => $parent->id,
        ]);

        $response = $this->actingAs($user)
            ->getJson("/api/v1/shared-folders/{$parent->id}/subfolders");

        $response->assertOk()
            ->assertJsonPath('result', 'success')
            ->assertJsonStructure(['data' => ['items']]);
    }

    public function test_non_member_cannot_list_subfolders(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $owner->id]);

        $response = $this->actingAs($other)
            ->getJson("/api/v1/shared-folders/{$folder->id}/subfolders");

        $response->assertStatus(403);
    }

    // ─── Public shared-link files ───────────────────────────────────────────

    public function test_public_can_list_files_via_shared_link(): void
    {
        $user = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $user->id]);
        $link = SharedFolderLink::create([
            'shared_folder_id' => $folder->id,
            'created_by'       => $user->id,
            'access_type'      => 'view',
            'allow_save'       => false,
            'status'           => 'active',
            'ttl_hours'        => 24,
            'expires_at'       => now()->addHours(24),
        ]);
        $file = File::factory()->create(['owner_id' => $user->id]);
        SharedFolderFile::create([
            'shared_folder_id' => $folder->id,
            'file_id'          => $file->id,
            'added_by'         => $user->id,
        ]);

        $response = $this->getJson("/api/v1/shared-links/{$link->token}/files");

        $response->assertOk()
            ->assertJsonPath('result', 'success')
            ->assertJsonStructure(['data' => ['items', 'pagination']]);
    }

    public function test_public_files_via_expired_link_returns_410(): void
    {
        $user = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $user->id]);
        $link = SharedFolderLink::create([
            'shared_folder_id' => $folder->id,
            'created_by'       => $user->id,
            'access_type'      => 'view',
            'allow_save'       => false,
            'status'           => 'active',
            'ttl_hours'        => 1,
            'expires_at'       => now()->subHour(),
        ]);

        $response = $this->getJson("/api/v1/shared-links/{$link->token}/files");

        $response->assertStatus(410)
            ->assertJsonPath('data.code', 'LINK_INVALID');
    }
}
