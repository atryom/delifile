<?php

namespace Tests\Feature\Files;

use App\Models\File;
use App\Models\FileVersion;
use App\Models\FileUserAccess;
use App\Models\User;
use Tests\TestCase;
use Illuminate\Support\Facades\Storage;

class FileVersionTest extends TestCase
{
    public function test_init_upload_requires_owned_file(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $other->id]);

        $response = $this->actingAs($user)
            ->postJson("/api/v1/files/{$file->id}/versions/init-upload", [
                'original_name' => 'v2.txt',
                'size'          => 1024,
                'mime_type'     => 'text/plain',
            ]);

        $response->assertStatus(404);
    }

    public function test_init_upload_fails_for_url_file(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->urlFile()->create(['owner_id' => $user->id]);

        $response = $this->actingAs($user)
            ->postJson("/api/v1/files/{$file->id}/versions/init-upload", [
                'original_name' => 'v2.txt',
                'size'          => 1024,
                'mime_type'     => 'text/plain',
            ]);

        $response->assertStatus(422)
            ->assertJsonPath('data.code', 'NOT_SUPPORTED');
    }

    public function test_init_upload_requires_validation(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $user->id]);

        $response = $this->actingAs($user)
            ->postJson("/api/v1/files/{$file->id}/versions/init-upload", []);

        $response->assertStatus(422);
    }

    public function test_update_version_basic_fields(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $user->id]);
        $version = FileVersion::create([
            'file_id'        => $file->id,
            'version_number' => 1,
            'storage_key'    => 'test/key.txt',
            'original_name'  => 'doc.txt',
            'size'           => 100,
            'mime_type'      => 'text/plain',
            'status'         => 'available',
            'is_active'      => true,
        ]);

        $response = $this->actingAs($user)
            ->patchJson("/api/v1/files/{$file->id}/versions/{$version->id}", [
                'version_label' => 'Final draft',
                'comment'       => 'With corrections',
            ]);

        $response->assertOk()
            ->assertJsonPath('result', 'success');
        $version->refresh();
        $this->assertEquals('Final draft', $version->version_label);
        $this->assertEquals('With corrections', $version->comment);
    }

    public function test_update_version_not_found(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $user->id]);

        $response = $this->actingAs($user)
            ->patchJson("/api/v1/files/{$file->id}/versions/nonexistent", [
                'version_label' => 'test',
            ]);

        $response->assertStatus(404);
    }

    public function test_complete_upload_requires_valid_version(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $user->id]);

        $response = $this->actingAs($user)
            ->postJson("/api/v1/files/{$file->id}/versions/complete-upload", [
                'version_id' => 'nonexistent',
            ]);

        $response->assertStatus(404);
    }

    public function test_complete_upload_fails_for_other_users_file(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $other->id]);

        $response = $this->actingAs($user)
            ->postJson("/api/v1/files/{$file->id}/versions/complete-upload", [
                'version_id' => 'test',
            ]);

        $response->assertStatus(404);
    }

    public function test_update_display_name_requires_versions(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $user->id, 'has_versions' => false]);

        $response = $this->actingAs($user)
            ->patchJson("/api/v1/files/{$file->id}/display-name", [
                'display_name' => 'My Custom Name',
            ]);

        $response->assertStatus(422)
            ->assertJsonPath('data.code', 'NO_VERSIONS');
    }

    public function test_update_display_name_works(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $user->id, 'has_versions' => true]);

        $response = $this->actingAs($user)
            ->patchJson("/api/v1/files/{$file->id}/display-name", [
                'display_name' => 'My Custom Name',
            ]);

        $response->assertOk()
            ->assertJsonPath('data.display_name', 'My Custom Name');
    }

    public function test_update_display_name_other_users_file_returns_404(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $other->id]);

        $response = $this->actingAs($user)
            ->patchJson("/api/v1/files/{$file->id}/display-name", [
                'display_name' => 'Hacked',
            ]);

        $response->assertStatus(404);
    }

    public function test_unauthenticated_user_cannot_access_versions(): void
    {
        $response = $this->postJson('/api/v1/files/test/versions/init-upload', []);
        $response->assertUnauthorized();
    }

    // ─── Version download ───────────────────────────────────────────────────

    public function test_owner_can_download_version(): void
    {
        Storage::fake('s3');

        $user = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $user->id]);
        $version = FileVersion::create([
            'file_id'        => $file->id,
            'version_number' => 1,
            'storage_key'    => 'test/v1.txt',
            'original_name'  => 'doc.txt',
            'size'           => 100,
            'mime_type'      => 'text/plain',
            'status'         => 'available',
            'is_active'      => true,
        ]);

        $response = $this->actingAs($user)
            ->postJson("/api/v1/files/{$file->id}/versions/{$version->id}/download");

        $response->assertOk()
            ->assertJsonPath('result', 'success')
            ->assertJsonStructure(['data' => ['url', 'expires_in']]);
    }

    public function test_user_with_access_can_download_version(): void
    {
        Storage::fake('s3');

        $owner = User::factory()->create();
        $editor = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $owner->id]);
        FileUserAccess::factory()->create([
            'file_id' => $file->id,
            'user_id' => $editor->id,
        ]);
        $version = FileVersion::create([
            'file_id'        => $file->id,
            'version_number' => 1,
            'storage_key'    => 'test/v1.txt',
            'original_name'  => 'doc.txt',
            'size'           => 100,
            'mime_type'      => 'text/plain',
            'status'         => 'available',
            'is_active'      => true,
        ]);

        $response = $this->actingAs($editor)
            ->postJson("/api/v1/files/{$file->id}/versions/{$version->id}/download");

        $response->assertOk()
            ->assertJsonPath('result', 'success');
    }

    public function test_user_without_access_cannot_download_version(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $owner->id]);
        $version = FileVersion::create([
            'file_id'        => $file->id,
            'version_number' => 1,
            'storage_key'    => 'test/v1.txt',
            'original_name'  => 'doc.txt',
            'size'           => 100,
            'mime_type'      => 'text/plain',
            'status'         => 'available',
            'is_active'      => true,
        ]);

        $response = $this->actingAs($other)
            ->postJson("/api/v1/files/{$file->id}/versions/{$version->id}/download");

        $response->assertStatus(404);
    }

    public function test_download_nonexistent_version_returns_404(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $user->id]);

        $response = $this->actingAs($user)
            ->postJson("/api/v1/files/{$file->id}/versions/nonexistent/download");

        $response->assertStatus(404);
    }

    public function test_download_version_unauthenticated_returns_401(): void
    {
        $response = $this->postJson('/api/v1/files/test/versions/test/download');
        $response->assertUnauthorized();
    }

    public function test_download_uploading_version_returns_404(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $user->id]);
        $version = FileVersion::create([
            'file_id'        => $file->id,
            'version_number' => 0,
            'storage_key'    => 'test/tmp',
            'original_name'  => 'uploading.txt',
            'size'           => 100,
            'mime_type'      => 'text/plain',
            'status'         => 'uploading',
            'is_active'      => false,
        ]);

        $response = $this->actingAs($user)
            ->postJson("/api/v1/files/{$file->id}/versions/{$version->id}/download");

        $response->assertStatus(404);
    }
}
