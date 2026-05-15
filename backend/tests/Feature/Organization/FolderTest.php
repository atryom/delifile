<?php

namespace Tests\Feature\Organization;

use App\Models\User;
use App\Models\Folder;
use App\Models\File;
use App\Models\FileUserAccess;
use Tests\TestCase;

class FolderTest extends TestCase
{
    public function test_user_can_list_folders(): void
    {
        $user = User::factory()->create();
        Folder::factory()->count(2)->create(['user_id' => $user->id]);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/folders');

        $response->assertOk()
            ->assertJsonPath('result', 'success')
            ->assertJsonStructure(['data' => ['items' => [['id', 'name', 'parent_id']]]]);
    }

    public function test_user_can_get_folder_tree(): void
    {
        $user = User::factory()->create();
        Folder::factory()->create(['user_id' => $user->id, 'name' => 'Root']);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/folders/tree');

        $response->assertOk()
            ->assertJsonPath('result', 'success');
    }

    public function test_user_can_create_folder(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/folders', ['name' => 'My Folder']);

        $response->assertStatus(201)
            ->assertJsonPath('result', 'success')
            ->assertJsonPath('data.folder.name', 'My Folder');

        $this->assertDatabaseHas('folders', [
            'user_id' => $user->id,
            'name'    => 'My Folder',
        ]);
    }

    public function test_user_can_create_subfolder(): void
    {
        $user = User::factory()->create();
        $parent = Folder::factory()->create(['user_id' => $user->id]);

        $response = $this->actingAs($user)
            ->postJson('/api/v1/folders', [
                'name'      => 'Subfolder',
                'parent_id' => $parent->id,
            ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('folders', [
            'name'      => 'Subfolder',
            'parent_id' => $parent->id,
        ]);
    }

    public function test_creating_folder_with_invalid_parent_fails(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/folders', [
                'name'      => 'Orphan',
                'parent_id' => 'nonexistent',
            ]);

        $response->assertStatus(404);
    }

    public function test_user_can_update_folder(): void
    {
        $user = User::factory()->create();
        $folder = Folder::factory()->create(['user_id' => $user->id, 'name' => 'Old Name']);

        $response = $this->actingAs($user)
            ->patchJson("/api/v1/folders/{$folder->id}", ['name' => 'New Name']);

        $response->assertOk()
            ->assertJsonPath('data.folder.name', 'New Name');
    }

    public function test_updating_other_users_folder_returns_404(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $folder = Folder::factory()->create(['user_id' => $other->id]);

        $response = $this->actingAs($user)
            ->patchJson("/api/v1/folders/{$folder->id}", ['name' => 'Hacked']);

        $response->assertStatus(404);
    }

    public function test_user_can_delete_empty_folder(): void
    {
        $user = User::factory()->create();
        $folder = Folder::factory()->create(['user_id' => $user->id]);

        $response = $this->actingAs($user)
            ->deleteJson("/api/v1/folders/{$folder->id}");

        $response->assertOk();
        $this->assertDatabaseMissing('folders', ['id' => $folder->id]);
    }

    public function test_user_can_force_delete_folder_with_files(): void
    {
        $user = User::factory()->create();
        $folder = Folder::factory()->create(['user_id' => $user->id]);
        $file = File::factory()->create(['owner_id' => $user->id]);
        FileUserAccess::factory()->owner()->create([
            'file_id'   => $file->id,
            'user_id'   => $user->id,
            'folder_id' => $folder->id,
        ]);

        $response = $this->actingAs($user)
            ->deleteJson("/api/v1/folders/{$folder->id}?force=1");

        $response->assertOk();
        $this->assertDatabaseMissing('folders', ['id' => $folder->id]);
    }

    public function test_deleting_folder_with_children_fails(): void
    {
        $user = User::factory()->create();
        $parent = Folder::factory()->create(['user_id' => $user->id]);
        Folder::factory()->childOf($parent)->create();

        $response = $this->actingAs($user)
            ->deleteJson("/api/v1/folders/{$parent->id}");

        $response->assertStatus(422)
            ->assertJsonPath('data.code', 'HAS_CHILDREN');
    }

    public function test_folder_cycle_detection_on_update(): void
    {
        $user = User::factory()->create();
        $parent = Folder::factory()->create(['user_id' => $user->id]);
        $child = Folder::factory()->childOf($parent)->create();

        $response = $this->actingAs($user)
            ->patchJson("/api/v1/folders/{$parent->id}", [
                'parent_id' => $child->id,
            ]);

        $response->assertStatus(422)
            ->assertJsonPath('data.code', 'CYCLE_DETECTED');
    }

    public function test_unauthenticated_user_cannot_access_folders(): void
    {
        $response = $this->getJson('/api/v1/folders');
        $response->assertUnauthorized();
    }
}
