<?php

namespace Tests\Feature\Files;

use App\Models\User;
use App\Models\File;
use App\Enums\FileStatus;
use App\Services\FileService;
use Tests\TestCase;

class FileUploadTest extends TestCase
{
    public function test_init_upload_returns_presigned_url(): void
    {
        $mock = \Mockery::mock(FileService::class);
        $mock->shouldReceive('validateFileSizeLimit')->andReturn(null);
        $mock->shouldReceive('validateStorageQuota')->andReturn(null);
        $mock->shouldReceive('initUpload')->andReturn([
            'file'       => ['id' => 'mock-id', 'status' => 'uploading'],
            'upload_url' => 'https://fake-s3.example.com/upload',
        ]);
        $this->app->instance(FileService::class, $mock);

        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/files/init-upload', [
                'original_name' => 'test.pdf',
                'size'          => 1024,
                'mime_type'     => 'application/pdf',
            ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'result',
                'data' => ['file', 'upload_url'],
            ]);
    }

    public function test_init_upload_exceeding_file_size_limit_fails(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/files/init-upload', [
                'original_name' => 'huge.pdf',
                'size'          => 999999999999,
                'mime_type'     => 'application/pdf',
            ]);

        $response->assertStatus(422)
            ->assertJsonPath('data.code', 'VALIDATION_ERROR');
    }

    public function test_init_upload_exceeding_storage_quota_fails(): void
    {
        $user = User::factory()->create();
        // Fill the storage to exceed free plan limit (500MB)
        File::factory()->count(10)->create([
            'owner_id' => $user->id,
            'size'     => 52428800, // 50MB each
        ]);

        $response = $this->actingAs($user)
            ->postJson('/api/v1/files/init-upload', [
                'original_name' => 'test.pdf',
                'size'          => 1048576, // 1MB
                'mime_type'     => 'application/pdf',
            ]);

        $response->assertStatus(422)
            ->assertJsonPath('data.code', 'STORAGE_LIMIT_EXCEEDED');
    }

    public function test_complete_upload(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->uploading()->create([
            'owner_id' => $user->id,
        ]);

        $response = $this->actingAs($user)
            ->postJson('/api/v1/files/complete-upload', [
                'file_id' => $file->id,
            ]);

        $response->assertOk()
            ->assertJson(['result' => 'success']);
    }

    public function test_complete_upload_not_owner_fails(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $file = File::factory()->uploading()->create([
            'owner_id' => $owner->id,
        ]);

        $response = $this->actingAs($other)
            ->postJson('/api/v1/files/complete-upload', [
                'file_id' => $file->id,
            ]);

        $response->assertStatus(403);
    }

    public function test_cancel_upload(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->uploading()->create([
            'owner_id' => $user->id,
        ]);

        $response = $this->actingAs($user)
            ->postJson("/api/v1/files/{$file->id}/cancel-upload");

        $response->assertOk();
    }
}
