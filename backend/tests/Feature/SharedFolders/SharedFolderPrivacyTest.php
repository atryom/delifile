<?php

namespace Tests\Feature\SharedFolders;

use App\Models\File;
use App\Models\User;
use App\Models\SharedFolder;
use App\Models\SharedFolderAccess;
use App\Models\SharedFolderFile;
use Tests\TestCase;

class SharedFolderPrivacyTest extends TestCase
{
    // ─── Folder privacy ───────────────────────────────────────────────────

    public function test_owner_can_set_folder_privacy(): void
    {
        $owner = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $owner->id]);

        $response = $this->actingAs($owner)
            ->patchJson("/api/v1/shared-folders/{$folder->id}/privacy", [
                'is_private' => true,
            ]);

        $response->assertOk();
        $this->assertDatabaseHas('shared_folders', [
            'id'         => $folder->id,
            'is_private' => true,
        ]);
    }

    public function test_owner_can_unset_folder_privacy(): void
    {
        $owner = User::factory()->create();
        $folder = SharedFolder::factory()->create([
            'owner_id'   => $owner->id,
            'is_private' => true,
        ]);

        $this->actingAs($owner)
            ->patchJson("/api/v1/shared-folders/{$folder->id}/privacy", [
                'is_private' => false,
            ])
            ->assertOk();

        $this->assertDatabaseHas('shared_folders', [
            'id'         => $folder->id,
            'is_private' => false,
        ]);
    }

    public function test_non_owner_cannot_set_folder_privacy(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $owner->id]);

        $response = $this->actingAs($other)
            ->patchJson("/api/v1/shared-folders/{$folder->id}/privacy", [
                'is_private' => true,
            ]);

        $response->assertStatus(403);
    }

    public function test_private_folder_hidden_from_viewers(): void
    {
        $owner = User::factory()->create();
        $viewer = User::factory()->create();

        $root = SharedFolder::factory()->create(['owner_id' => $owner->id]);
        $privateSub = SharedFolder::factory()->childOf($root)->create(['is_private' => true]);
        $publicSub = SharedFolder::factory()->childOf($root)->create(['is_private' => false]);

        SharedFolderAccess::factory()->create([
            'shared_folder_id' => $root->id,
            'user_id'          => $viewer->id,
        ]);

        $response = $this->actingAs($viewer)
            ->getJson("/api/v1/shared-folders/{$root->id}/subfolders");

        $response->assertOk();
        $items = $response->json('data.items');
        $visibleIds = array_column($items, 'id');

        $this->assertContains($publicSub->id, $visibleIds);
        $this->assertNotContains($privateSub->id, $visibleIds);
    }

    public function test_owner_still_sees_private_folders(): void
    {
        $owner = User::factory()->create();

        $root = SharedFolder::factory()->create(['owner_id' => $owner->id]);
        $privateSub = SharedFolder::factory()->childOf($root)->create(['is_private' => true]);

        $response = $this->actingAs($owner)
            ->getJson("/api/v1/shared-folders/{$root->id}/subfolders");

        $response->assertOk();
        $items = $response->json('data.items');
        $visibleIds = array_column($items, 'id');
        $this->assertContains($privateSub->id, $visibleIds);
    }

    // ─── File privacy ─────────────────────────────────────────────────────

    public function test_owner_can_set_file_privacy(): void
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
            ->patchJson("/api/v1/shared-folders/{$folder->id}/files/{$file->id}/privacy", [
                'is_private' => true,
            ]);

        $response->assertOk();
        $this->assertDatabaseHas('shared_folder_files', [
            'shared_folder_id' => $folder->id,
            'file_id'          => $file->id,
            'is_private'       => true,
        ]);
    }

    public function test_non_owner_cannot_set_file_privacy(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $owner->id]);
        $file = File::factory()->create(['owner_id' => $owner->id]);
        SharedFolderFile::create([
            'shared_folder_id' => $folder->id,
            'file_id'          => $file->id,
            'added_by'         => $owner->id,
        ]);

        $response = $this->actingAs($other)
            ->patchJson("/api/v1/shared-folders/{$folder->id}/files/{$file->id}/privacy", [
                'is_private' => true,
            ]);

        $response->assertStatus(403);
    }

    public function test_private_file_hidden_from_viewers_in_listing(): void
    {
        $owner = User::factory()->create();
        $viewer = User::factory()->create();

        $folder = SharedFolder::factory()->create(['owner_id' => $owner->id]);
        SharedFolderAccess::factory()->create([
            'shared_folder_id' => $folder->id,
            'user_id'          => $viewer->id,
        ]);

        $publicFile = File::factory()->create(['owner_id' => $owner->id]);
        $privateFile = File::factory()->create(['owner_id' => $owner->id]);

        SharedFolderFile::create([
            'shared_folder_id' => $folder->id,
            'file_id'          => $publicFile->id,
            'added_by'         => $owner->id,
            'is_private'       => false,
        ]);
        SharedFolderFile::create([
            'shared_folder_id' => $folder->id,
            'file_id'          => $privateFile->id,
            'added_by'         => $owner->id,
            'is_private'       => true,
        ]);

        $response = $this->actingAs($viewer)
            ->getJson("/api/v1/shared-folders/{$folder->id}/files");

        $response->assertOk();
        $items = $response->json('data.items');
        $visibleFileIds = array_column($items, 'id');

        $this->assertContains($publicFile->id, $visibleFileIds);
        $this->assertNotContains($privateFile->id, $visibleFileIds);
    }

    public function test_owner_still_sees_private_files(): void
    {
        $owner = User::factory()->create();

        $folder = SharedFolder::factory()->create(['owner_id' => $owner->id]);

        $privateFile = File::factory()->create(['owner_id' => $owner->id]);
        SharedFolderFile::create([
            'shared_folder_id' => $folder->id,
            'file_id'          => $privateFile->id,
            'added_by'         => $owner->id,
            'is_private'       => true,
        ]);

        $response = $this->actingAs($owner)
            ->getJson("/api/v1/shared-folders/{$folder->id}/files");

        $response->assertOk();
        $items = $response->json('data.items');
        $visibleFileIds = array_column($items, 'id');
        $this->assertContains($privateFile->id, $visibleFileIds);
    }
}
