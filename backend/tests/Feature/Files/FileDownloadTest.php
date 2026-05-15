<?php

namespace Tests\Feature\Files;

use App\Models\User;
use App\Models\File;
use App\Models\FileUserAccess;
use Tests\TestCase;
use Illuminate\Support\Facades\Storage;

class FileDownloadTest extends TestCase
{
    public function test_user_can_download_file(): void
    {
        Storage::fake('s3');

        $user = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $user->id]);

        FileUserAccess::factory()->owner()->create([
            'file_id' => $file->id,
            'user_id' => $user->id,
        ]);

        $response = $this->actingAs($user)
            ->postJson("/api/v1/files/{$file->id}/download");

        $response->assertOk()
            ->assertJsonStructure(['data' => ['url']]);
    }

    public function test_download_unavailable_file_fails(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->uploading()->create(['owner_id' => $user->id]);

        FileUserAccess::factory()->owner()->create([
            'file_id' => $file->id,
            'user_id' => $user->id,
        ]);

        $response = $this->actingAs($user)
            ->postJson("/api/v1/files/{$file->id}/download");

        $response->assertStatus(422)
            ->assertJsonPath('data.code', 'FILE_NOT_AVAILABLE');
    }

    public function test_user_without_access_cannot_download(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $owner->id]);

        $response = $this->actingAs($other)
            ->postJson("/api/v1/files/{$file->id}/download");

        $response->assertStatus(403);
    }
}
