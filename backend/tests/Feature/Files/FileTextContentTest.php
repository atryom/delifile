<?php

namespace Tests\Feature\Files;

use App\Models\User;
use App\Models\File;
use App\Models\FileUserAccess;
use Tests\TestCase;
use Illuminate\Support\Facades\Storage;

class FileTextContentTest extends TestCase
{
    public function test_owner_can_read_text_file_content(): void
    {
        Storage::fake('s3');

        $user = User::factory()->create();
        $file = File::factory()->create([
            'owner_id'      => $user->id,
            'mime_type'     => 'text/plain',
            'original_name' => 'server.log',
            'size'          => 11,
        ]);
        FileUserAccess::factory()->owner()->create(['file_id' => $file->id, 'user_id' => $user->id]);
        Storage::disk('s3')->put($file->storage_key, 'hello world');

        $response = $this->actingAs($user)
            ->getJson("/api/v1/files/{$file->id}/text-content");

        $response->assertOk()
            ->assertJsonPath('data.content', 'hello world');
    }

    public function test_markdown_is_not_served_as_text(): void
    {
        Storage::fake('s3');

        $user = User::factory()->create();
        $file = File::factory()->create([
            'owner_id'      => $user->id,
            'mime_type'     => 'text/markdown',
            'original_name' => 'doc.md',
        ]);
        FileUserAccess::factory()->owner()->create(['file_id' => $file->id, 'user_id' => $user->id]);

        $response = $this->actingAs($user)
            ->getJson("/api/v1/files/{$file->id}/text-content");

        $response->assertStatus(422)
            ->assertJsonPath('data.code', 'NOT_TEXT_VIEWABLE');
    }

    public function test_binary_file_is_not_served_as_text(): void
    {
        Storage::fake('s3');

        $user = User::factory()->create();
        $file = File::factory()->create([
            'owner_id'      => $user->id,
            'mime_type'     => 'image/png',
            'original_name' => 'photo.png',
        ]);
        FileUserAccess::factory()->owner()->create(['file_id' => $file->id, 'user_id' => $user->id]);

        $response = $this->actingAs($user)
            ->getJson("/api/v1/files/{$file->id}/text-content");

        $response->assertStatus(422)
            ->assertJsonPath('data.code', 'NOT_TEXT_VIEWABLE');
    }

    public function test_user_without_access_cannot_read_text(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $file = File::factory()->create([
            'owner_id'      => $owner->id,
            'mime_type'     => 'text/plain',
            'original_name' => 'notes.txt',
        ]);

        $response = $this->actingAs($other)
            ->getJson("/api/v1/files/{$file->id}/text-content");

        $response->assertStatus(403);
    }
}
