<?php

namespace Tests\Feature\Files;

use App\Models\File;
use App\Models\FileUserAccess;
use App\Models\User;
use Tests\TestCase;

class FileRenameTest extends TestCase
{
    private User $owner;
    private File $file;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = User::factory()->create();
        $this->file  = File::factory()->create(['owner_id' => $this->owner->id]);

        FileUserAccess::factory()->owner()->create([
            'file_id' => $this->file->id,
            'user_id' => $this->owner->id,
        ]);
    }

    public function test_owner_can_set_display_name_on_regular_file(): void
    {
        $response = $this->actingAs($this->owner)
            ->patchJson("/api/v1/files/{$this->file->id}/rename", [
                'display_name' => 'My custom name',
            ]);

        $response->assertOk()
            ->assertJsonPath('data.display_name', 'My custom name');
    }

    public function test_user_with_access_can_set_display_name(): void
    {
        $other = User::factory()->create();
        FileUserAccess::factory()->create([
            'file_id' => $this->file->id,
            'user_id' => $other->id,
        ]);

        $response = $this->actingAs($other)
            ->patchJson("/api/v1/files/{$this->file->id}/rename", [
                'display_name' => 'Shared label',
            ]);

        $response->assertOk()
            ->assertJsonPath('data.display_name', 'Shared label');
    }

    public function test_user_without_access_cannot_rename(): void
    {
        $stranger = User::factory()->create();

        $response = $this->actingAs($stranger)
            ->patchJson("/api/v1/files/{$this->file->id}/rename", [
                'display_name' => 'Hacked',
            ]);

        $response->assertNotFound();
    }

    public function test_owner_can_clear_display_name(): void
    {
        $this->file->update(['display_name' => 'Old name']);

        $response = $this->actingAs($this->owner)
            ->patchJson("/api/v1/files/{$this->file->id}/rename", [
                'display_name' => null,
            ]);

        $response->assertOk()
            ->assertJsonPath('data.display_name', null);
    }

    public function test_owner_can_rename_markdown_note(): void
    {
        $note = File::factory()->create([
            'owner_id'     => $this->owner->id,
            'content_kind' => 'binary_file',
            'is_editable'  => true,
            'editor_type'  => 'markdown',
            'mime_type'    => 'text/markdown',
        ]);
        FileUserAccess::factory()->owner()->create([
            'file_id' => $note->id,
            'user_id' => $this->owner->id,
        ]);

        $response = $this->actingAs($this->owner)
            ->patchJson("/api/v1/files/{$note->id}/rename", [
                'display_name' => 'New note title',
            ]);

        $response->assertOk()
            ->assertJsonPath('data.original_name', 'New note title');
    }

    public function test_non_owner_cannot_rename_markdown_note(): void
    {
        $note = File::factory()->create([
            'owner_id'     => $this->owner->id,
            'content_kind' => 'binary_file',
            'is_editable'  => true,
            'editor_type'  => 'markdown',
            'mime_type'    => 'text/markdown',
        ]);
        $other = User::factory()->create();
        FileUserAccess::factory()->create([
            'file_id' => $note->id,
            'user_id' => $other->id,
        ]);

        $response = $this->actingAs($other)
            ->patchJson("/api/v1/files/{$note->id}/rename", [
                'display_name' => 'Hacked title',
            ]);

        $response->assertForbidden();
    }

    public function test_rename_validates_max_length(): void
    {
        $response = $this->actingAs($this->owner)
            ->patchJson("/api/v1/files/{$this->file->id}/rename", [
                'display_name' => str_repeat('a', 256),
            ]);

        $response->assertUnprocessable();
    }

    public function test_unauthenticated_user_cannot_rename(): void
    {
        $this->patchJson("/api/v1/files/{$this->file->id}/rename", [
            'display_name' => 'Test',
        ])->assertUnauthorized();
    }
}
