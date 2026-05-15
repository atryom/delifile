<?php

namespace Tests\Feature\SharedFolders;

use App\Models\File;
use App\Models\FileUserAccess;
use App\Models\SharedFolder;
use App\Models\SharedFolderAccess;
use App\Models\SharedFolderFile;
use App\Models\User;
use Tests\TestCase;

class SharedFolderFileTest extends TestCase
{
    // ─── addToMyFiles ───────────────────────────────────────────────────────

    public function test_user_can_add_shared_folder_only_file_to_my_files(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->create([
            'owner_id'           => $user->id,
            'shared_folder_only' => true,
        ]);

        $response = $this->actingAs($user)
            ->postJson("/api/v1/files/{$file->id}/add-to-my-files");

        $response->assertOk();
        $this->assertDatabaseHas('files', [
            'id'                 => $file->id,
            'shared_folder_only' => false,
        ]);
    }

    public function test_add_to_my_files_fails_if_not_shared_folder_only(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->create([
            'owner_id'           => $user->id,
            'shared_folder_only' => false,
        ]);

        $response = $this->actingAs($user)
            ->postJson("/api/v1/files/{$file->id}/add-to-my-files");

        $response->assertStatus(422)
            ->assertJsonPath('data.code', 'ALREADY_IN_MY_FILES');
    }

    public function test_add_to_my_files_fails_for_other_users_file(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $file = File::factory()->create([
            'owner_id'           => $owner->id,
            'shared_folder_only' => true,
        ]);

        $response = $this->actingAs($other)
            ->postJson("/api/v1/files/{$file->id}/add-to-my-files");

        $response->assertStatus(403);
    }

    // ─── updateSharedFolders ────────────────────────────────────────────────

    public function test_user_can_sync_file_shared_folders(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $user->id]);
        $folder = SharedFolder::factory()->create(['owner_id' => $user->id]);

        $response = $this->actingAs($user)
            ->postJson("/api/v1/files/{$file->id}/shared-folders", [
                'folder_ids' => [$folder->id],
            ]);

        $response->assertOk()
            ->assertJsonPath('data.folder_ids', [$folder->id]);

        $this->assertDatabaseHas('shared_folder_files', [
            'shared_folder_id' => $folder->id,
            'file_id'          => $file->id,
        ]);
    }

    public function test_update_shared_folders_fails_for_shared_folder_only_file(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->create([
            'owner_id'           => $user->id,
            'shared_folder_only' => true,
        ]);

        $response = $this->actingAs($user)
            ->postJson("/api/v1/files/{$file->id}/shared-folders", [
                'folder_ids' => [],
            ]);

        $response->assertStatus(403);
    }

    public function test_update_shared_folders_requires_folder_ids(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $user->id]);

        $response = $this->actingAs($user)
            ->postJson("/api/v1/files/{$file->id}/shared-folders", []);

        $response->assertStatus(422);
    }

    public function test_update_shared_folders_only_affects_editable_folders(): void
    {
        $owner = User::factory()->create();
        $editor = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $owner->id]);
        FileUserAccess::create([
            'file_id'     => $file->id,
            'user_id'     => $editor->id,
            'access_type' => 'shared',
        ]);

        $editableFolder = SharedFolder::factory()->create(['owner_id' => $editor->id]);
        $otherFolder = SharedFolder::factory()->create(['owner_id' => $owner->id]);

        $response = $this->actingAs($editor)
            ->postJson("/api/v1/files/{$file->id}/shared-folders", [
                'folder_ids' => [$editableFolder->id, $otherFolder->id],
            ]);

        $response->assertOk();
        $this->assertDatabaseHas('shared_folder_files', [
            'shared_folder_id' => $editableFolder->id,
            'file_id'          => $file->id,
        ]);
        $this->assertDatabaseMissing('shared_folder_files', [
            'shared_folder_id' => $otherFolder->id,
            'file_id'          => $file->id,
        ]);
    }

    // ─── getSharedFolders ───────────────────────────────────────────────────

    public function test_user_can_get_shared_folders_for_file(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $user->id]);
        $folder = SharedFolder::factory()->create(['owner_id' => $user->id]);
        SharedFolderFile::create([
            'shared_folder_id' => $folder->id,
            'file_id'          => $file->id,
            'added_by'         => $user->id,
        ]);

        $response = $this->actingAs($user)
            ->getJson("/api/v1/files/{$file->id}/shared-folders");

        $response->assertOk()
            ->assertJsonStructure(['data' => ['folder_ids', 'folders']]);
        $this->assertContains($folder->id, $response->json('data.folder_ids'));
    }

    public function test_get_shared_folders_fails_without_access(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $owner->id]);

        $response = $this->actingAs($other)
            ->getJson("/api/v1/files/{$file->id}/shared-folders");

        $response->assertStatus(403);
    }

    // ─── addFile ────────────────────────────────────────────────────────────

    public function test_user_with_edit_access_can_add_file_to_folder(): void
    {
        $owner = User::factory()->create();
        $editor = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $owner->id]);
        SharedFolderAccess::factory()->edit()->create([
            'shared_folder_id' => $folder->id,
            'user_id'          => $editor->id,
        ]);
        $file = File::factory()->create(['owner_id' => $editor->id]);

        $response = $this->actingAs($editor)
            ->postJson("/api/v1/shared-folders/{$folder->id}/files/{$file->id}");

        $response->assertOk();
        $this->assertDatabaseHas('shared_folder_files', [
            'shared_folder_id' => $folder->id,
            'file_id'          => $file->id,
        ]);
    }

    public function test_add_file_fails_without_edit_access(): void
    {
        $owner = User::factory()->create();
        $viewer = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $owner->id]);
        SharedFolderAccess::factory()->create([
            'shared_folder_id' => $folder->id,
            'user_id'          => $viewer->id,
        ]);
        $file = File::factory()->create(['owner_id' => $viewer->id]);

        $response = $this->actingAs($viewer)
            ->postJson("/api/v1/shared-folders/{$folder->id}/files/{$file->id}");

        $response->assertStatus(403);
    }

    public function test_add_file_to_nonexistent_folder_returns_404(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $user->id]);

        $response = $this->actingAs($user)
            ->postJson("/api/v1/shared-folders/nonexistent/files/{$file->id}");

        $response->assertStatus(404);
    }

    // ─── removeFile ─────────────────────────────────────────────────────────

    public function test_user_with_edit_access_can_remove_file_from_folder(): void
    {
        $owner = User::factory()->create();
        $editor = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $owner->id]);
        SharedFolderAccess::factory()->edit()->create([
            'shared_folder_id' => $folder->id,
            'user_id'          => $editor->id,
        ]);
        $file = File::factory()->create(['owner_id' => $editor->id]);
        SharedFolderFile::create([
            'shared_folder_id' => $folder->id,
            'file_id'          => $file->id,
            'added_by'         => $editor->id,
        ]);

        $response = $this->actingAs($editor)
            ->deleteJson("/api/v1/shared-folders/{$folder->id}/files/{$file->id}");

        $response->assertOk();
        $this->assertDatabaseMissing('shared_folder_files', [
            'shared_folder_id' => $folder->id,
            'file_id'          => $file->id,
        ]);
    }

    public function test_file_owner_can_remove_file_from_folder(): void
    {
        $owner = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $owner->id]);
        $file = File::factory()->create(['owner_id' => $owner->id]);
        SharedFolderFile::create([
            'shared_folder_id' => $folder->id,
            'file_id'          => $file->id,
            'added_by'         => $owner->id,
        ]);

        $response = $this->actingAs($owner)
            ->deleteJson("/api/v1/shared-folders/{$folder->id}/files/{$file->id}");

        $response->assertOk();
    }

    public function test_remove_file_fails_without_permission(): void
    {
        $owner = User::factory()->create();
        $viewer = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $owner->id]);
        SharedFolderAccess::factory()->create([
            'shared_folder_id' => $folder->id,
            'user_id'          => $viewer->id,
        ]);
        $file = File::factory()->create(['owner_id' => $owner->id]);
        SharedFolderFile::create([
            'shared_folder_id' => $folder->id,
            'file_id'          => $file->id,
            'added_by'         => $owner->id,
        ]);

        $response = $this->actingAs($viewer)
            ->deleteJson("/api/v1/shared-folders/{$folder->id}/files/{$file->id}");

        $response->assertStatus(403);
    }

    // ─── Auth ───────────────────────────────────────────────────────────────

    public function test_unauthenticated_cannot_access_shared_folder_files(): void
    {
        $response = $this->getJson('/api/v1/files/some-id/shared-folders');
        $response->assertUnauthorized();
    }
}
