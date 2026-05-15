<?php

namespace Tests\Feature\Files;

use App\Models\User;
use App\Models\File;
use App\Models\FileUserAccess;
use App\Models\Folder;
use App\Models\Tag;
use App\Enums\AccessType;
use Tests\TestCase;

class FileActionsTest extends TestCase
{
    private User $user;
    private File $file;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
        $this->file = File::factory()->create(['owner_id' => $this->user->id]);

        FileUserAccess::factory()->owner()->create([
            'file_id' => $this->file->id,
            'user_id' => $this->user->id,
        ]);
    }

    public function test_user_can_pin_file(): void
    {
        $response = $this->actingAs($this->user)
            ->postJson("/api/v1/files/{$this->file->id}/pin");

        $response->assertOk();
    }

    public function test_user_can_unpin_file(): void
    {
        $response = $this->actingAs($this->user)
            ->postJson("/api/v1/files/{$this->file->id}/pin");

        $response->assertOk();

        $response = $this->actingAs($this->user)
            ->postJson("/api/v1/files/{$this->file->id}/unpin");

        $response->assertOk();
    }

    public function test_user_can_favorite_file(): void
    {
        $response = $this->actingAs($this->user)
            ->postJson("/api/v1/files/{$this->file->id}/favorite");

        $response->assertOk();
    }

    public function test_user_can_unfavorite_file(): void
    {
        $this->actingAs($this->user)
            ->postJson("/api/v1/files/{$this->file->id}/favorite");

        $response = $this->actingAs($this->user)
            ->postJson("/api/v1/files/{$this->file->id}/unfavorite");

        $response->assertOk();
    }

    public function test_user_can_move_file_to_folder(): void
    {
        $folder = Folder::factory()->create(['user_id' => $this->user->id]);

        $response = $this->actingAs($this->user)
            ->postJson("/api/v1/files/{$this->file->id}/move-folder", [
                'folder_id' => $folder->id,
            ]);

        $response->assertOk();
    }

    public function test_user_can_clear_folder(): void
    {
        $response = $this->actingAs($this->user)
            ->postJson("/api/v1/files/{$this->file->id}/move-folder", [
                'folder_id' => null,
            ]);

        $response->assertOk();
    }

    public function test_user_can_set_tags_on_file(): void
    {
        $tag = Tag::factory()->create(['user_id' => $this->user->id]);

        $response = $this->actingAs($this->user)
            ->postJson("/api/v1/files/{$this->file->id}/set-tags", [
                'tag_ids' => [$tag->id],
            ]);

        $response->assertOk();
    }

    public function test_user_can_update_description(): void
    {
        $response = $this->actingAs($this->user)
            ->patchJson("/api/v1/files/{$this->file->id}/description", [
                'description' => 'New description',
            ]);

        $response->assertOk();
    }

    public function test_user_can_view_file_activity(): void
    {
        $response = $this->actingAs($this->user)
            ->getJson("/api/v1/files/{$this->file->id}/activity");

        $response->assertOk()
            ->assertJsonStructure(['data' => ['items']]);
    }

    public function test_owner_can_view_file_accesses(): void
    {
        $response = $this->actingAs($this->user)
            ->getJson("/api/v1/files/{$this->file->id}/accesses");

        $response->assertOk()
            ->assertJsonStructure(['data' => ['items']]);
    }

    public function test_non_owner_cannot_view_accesses(): void
    {
        $other = User::factory()->create();

        $response = $this->actingAs($other)
            ->getJson("/api/v1/files/{$this->file->id}/accesses");

        $response->assertStatus(404);
    }
}
