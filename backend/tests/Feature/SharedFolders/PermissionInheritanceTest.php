<?php

namespace Tests\Feature\SharedFolders;

use App\Models\File;
use App\Models\User;
use App\Models\SharedFolder;
use App\Models\SharedFolderAccess;
use App\Models\SharedFolderFile;
use App\Enums\SharedFolderAccessType;
use Tests\TestCase;

class PermissionInheritanceTest extends TestCase
{
    // ─── Scenario E: view inherited to subfolders ──────────────────────────

    public function test_viewer_inherits_view_on_subfolders(): void
    {
        $owner = User::factory()->create();
        $viewer = User::factory()->create();

        $root = SharedFolder::factory()->create(['owner_id' => $owner->id]);
        $sub1 = SharedFolder::factory()->childOf($root)->create();
        $sub2 = SharedFolder::factory()->childOf($sub1)->create();

        SharedFolderAccess::factory()->create([
            'shared_folder_id' => $root->id,
            'user_id'          => $viewer->id,
        ]);

        $response = $this->actingAs($viewer)
            ->getJson("/api/v1/shared-folders/{$root->id}/subfolders");

        $response->assertOk();
        $items = $response->json('data.items');
        $sub1Ids = array_column($items, 'id');
        $this->assertContains($sub1->id, $sub1Ids);
    }

    public function test_viewer_can_access_nested_subfolder_by_inheritance(): void
    {
        $owner = User::factory()->create();
        $viewer = User::factory()->create();

        $root = SharedFolder::factory()->create(['owner_id' => $owner->id]);
        $sub1 = SharedFolder::factory()->childOf($root)->create();
        $sub2 = SharedFolder::factory()->childOf($sub1)->create();

        SharedFolderAccess::factory()->create([
            'shared_folder_id' => $root->id,
            'user_id'          => $viewer->id,
        ]);

        $response = $this->actingAs($viewer)
            ->getJson("/api/v1/shared-folders/{$sub1->id}/subfolders");

        $response->assertOk();
        $items = $response->json('data.items');
        $sub2Ids = array_column($items, 'id');
        $this->assertContains($sub2->id, $sub2Ids);
    }

    public function test_viewer_can_list_files_in_inherited_subfolder(): void
    {
        $owner = User::factory()->create();
        $viewer = User::factory()->create();

        $root = SharedFolder::factory()->create(['owner_id' => $owner->id]);
        $sub1 = SharedFolder::factory()->childOf($root)->create();

        SharedFolderAccess::factory()->create([
            'shared_folder_id' => $root->id,
            'user_id'          => $viewer->id,
        ]);

        $file = File::factory()->create(['owner_id' => $owner->id]);
        SharedFolderFile::create([
            'shared_folder_id' => $sub1->id,
            'file_id'          => $file->id,
            'added_by'         => $owner->id,
        ]);

        $response = $this->actingAs($viewer)
            ->getJson("/api/v1/shared-folders/{$sub1->id}/files");

        $response->assertOk()
            ->assertJsonPath('result', 'success');
    }

    // ─── Scenario F: direct access to subfolder without root ──────────────

    public function test_user_with_access_on_subfolder_only_cannot_access_root(): void
    {
        $owner = User::factory()->create();
        $viewer = User::factory()->create();

        $root = SharedFolder::factory()->create(['owner_id' => $owner->id]);
        $sub1 = SharedFolder::factory()->childOf($root)->create();

        SharedFolderAccess::factory()->create([
            'shared_folder_id' => $sub1->id,
            'user_id'          => $viewer->id,
        ]);

        $response = $this->actingAs($viewer)
            ->getJson("/api/v1/shared-folders/{$root->id}/subfolders");

        $response->assertStatus(403);
    }

    public function test_user_with_access_on_subfolder_can_access_subfolder_directly(): void
    {
        $owner = User::factory()->create();
        $viewer = User::factory()->create();

        $root = SharedFolder::factory()->create(['owner_id' => $owner->id]);
        $sub1 = SharedFolder::factory()->childOf($root)->create();

        SharedFolderAccess::factory()->create([
            'shared_folder_id' => $sub1->id,
            'user_id'          => $viewer->id,
        ]);

        $response = $this->actingAs($viewer)
            ->getJson("/api/v1/shared-folders/{$sub1->id}/subfolders");

        $response->assertOk();
    }

    // ─── Scenario K: mixed access types on different levels ───────────────

    public function test_view_only_on_root_blocks_edit_operations(): void
    {
        $owner = User::factory()->create();
        $viewer = User::factory()->create();

        $root = SharedFolder::factory()->create(['owner_id' => $owner->id]);

        SharedFolderAccess::factory()->create([
            'shared_folder_id' => $root->id,
            'user_id'          => $viewer->id,
        ]);

        $response = $this->actingAs($viewer)
            ->postJson("/api/v1/shared-folders/{$root->id}/init-upload", [
                'original_name' => 'doc.pdf',
                'size'          => 1024,
                'mime_type'     => 'application/pdf',
            ]);

        $response->assertStatus(403);
    }

    public function test_edit_on_subfolder_allows_upload_there(): void
    {
        $owner = User::factory()->create();
        $editor = User::factory()->create();

        $root = SharedFolder::factory()->create(['owner_id' => $owner->id]);
        $sub1 = SharedFolder::factory()->childOf($root)->create();

        SharedFolderAccess::factory()->edit()->create([
            'shared_folder_id' => $sub1->id,
            'user_id'          => $editor->id,
        ]);

        $response = $this->actingAs($editor)
            ->postJson("/api/v1/shared-folders/{$sub1->id}/init-upload", [
                'original_name' => 'doc.pdf',
                'size'          => 1024,
                'mime_type'     => 'application/pdf',
            ]);

        $response->assertStatus(201);
    }

    public function test_edit_inherited_to_nested_subfolder(): void
    {
        $owner = User::factory()->create();
        $editor = User::factory()->create();

        $root = SharedFolder::factory()->create(['owner_id' => $owner->id]);
        $sub1 = SharedFolder::factory()->childOf($root)->create();
        $sub2 = SharedFolder::factory()->childOf($sub1)->create();

        SharedFolderAccess::factory()->edit()->create([
            'shared_folder_id' => $sub1->id,
            'user_id'          => $editor->id,
        ]);

        $response = $this->actingAs($editor)
            ->postJson("/api/v1/shared-folders/{$sub2->id}/init-upload", [
                'original_name' => 'doc.pdf',
                'size'          => 1024,
                'mime_type'     => 'application/pdf',
            ]);

        $response->assertStatus(201);
    }

    public function test_mixed_access_view_on_root_edit_on_subfolder(): void
    {
        $owner = User::factory()->create();
        $editor = User::factory()->create();

        $root = SharedFolder::factory()->create(['owner_id' => $owner->id]);
        $sub1 = SharedFolder::factory()->childOf($root)->create();

        SharedFolderAccess::factory()->create([
            'shared_folder_id' => $root->id,
            'user_id'          => $editor->id,
        ]);
        SharedFolderAccess::factory()->edit()->create([
            'shared_folder_id' => $sub1->id,
            'user_id'          => $editor->id,
        ]);

        $this->actingAs($editor)
            ->postJson("/api/v1/shared-folders/{$root->id}/init-upload", [
                'original_name' => 'doc.pdf',
                'size'          => 1024,
                'mime_type'     => 'application/pdf',
            ])
            ->assertStatus(403);

        $this->actingAs($editor)
            ->postJson("/api/v1/shared-folders/{$sub1->id}/init-upload", [
                'original_name' => 'doc.pdf',
                'size'          => 1024,
                'mime_type'     => 'application/pdf',
            ])
            ->assertStatus(201);
    }

    // ─── Owner always has access ──────────────────────────────────────────

    public function test_owner_always_has_access_in_inheritance_chain(): void
    {
        $owner = User::factory()->create();

        $root = SharedFolder::factory()->create(['owner_id' => $owner->id]);
        $sub1 = SharedFolder::factory()->childOf($root)->create();
        $sub2 = SharedFolder::factory()->childOf($sub1)->create();

        $this->actingAs($owner)
            ->getJson("/api/v1/shared-folders/{$root->id}/subfolders")
            ->assertOk();

        $this->actingAs($owner)
            ->getJson("/api/v1/shared-folders/{$sub2->id}/files")
            ->assertOk();
    }

    // ─── Unauthenticated user cannot access ──────────────────────────────

    public function test_unauthenticated_user_cannot_access_shared_folder(): void
    {
        $owner = User::factory()->create();
        $root = SharedFolder::factory()->create(['owner_id' => $owner->id]);

        $this->getJson("/api/v1/shared-folders/{$root->id}/subfolders")
            ->assertUnauthorized();
    }
}
