<?php

namespace Tests\Feature\Sharing;

use App\Models\File;
use App\Models\FileUserAccess;
use App\Models\ShareLink;
use App\Models\User;
use Tests\TestCase;

class SharingCoverageTest extends TestCase
{
    public function test_resolve_link_returns_file_info(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $user->id, 'mime_type' => 'text/plain']);
        FileUserAccess::factory()->owner()->create(['file_id' => $file->id, 'user_id' => $user->id]);
        $link = ShareLink::factory()->create(['file_id' => $file->id, 'created_by' => $user->id]);

        $response = $this->postJson("/api/v1/links/{$link->token}/resolve");

        $response->assertOk()
            ->assertJsonPath('result', 'success')
            ->assertJsonStructure(['data' => ['file' => ['id', 'original_name', 'size', 'mime_type'], 'link' => ['expires_at', 'allow_save']]]);
    }

    public function test_resolve_link_with_invalid_token_returns_404(): void
    {
        $response = $this->postJson('/api/v1/links/invalid-token/resolve');

        $response->assertStatus(404)
            ->assertJsonPath('data.code', 'LINK_INVALID');
    }

    public function test_resolve_disabled_link_returns_404(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $user->id]);
        FileUserAccess::factory()->owner()->create(['file_id' => $file->id, 'user_id' => $user->id]);
        $link = ShareLink::factory()->disabled()->create(['file_id' => $file->id, 'created_by' => $user->id]);

        $response = $this->postJson("/api/v1/links/{$link->token}/resolve");

        $response->assertStatus(404);
    }

    public function test_download_via_link_returns_url(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $user->id, 'status' => \App\Enums\FileStatus::Available]);
        FileUserAccess::factory()->owner()->create(['file_id' => $file->id, 'user_id' => $user->id]);
        $link = ShareLink::factory()->create(['file_id' => $file->id, 'created_by' => $user->id]);

        $response = $this->postJson("/api/v1/links/{$link->token}/download");

        $response->assertOk()
            ->assertJsonPath('result', 'success')
            ->assertJsonStructure(['data' => ['url', 'expires_in']]);
    }

    public function test_download_via_invalid_link_returns_404(): void
    {
        $response = $this->postJson('/api/v1/links/bad-token/download');

        $response->assertStatus(404);
    }

    public function test_save_via_link_requires_auth(): void
    {
        $response = $this->postJson('/api/v1/links/some-token/save');
        $response->assertUnauthorized();
    }

    public function test_save_via_link_works(): void
    {
        $owner = User::factory()->create();
        $saver = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $owner->id, 'status' => \App\Enums\FileStatus::Available]);
        FileUserAccess::factory()->owner()->create(['file_id' => $file->id, 'user_id' => $owner->id]);
        $link = ShareLink::factory()->withSave()->create(['file_id' => $file->id, 'created_by' => $owner->id]);

        $response = $this->actingAs($saver)
            ->postJson("/api/v1/links/{$link->token}/save");

        $response->assertOk()
            ->assertJsonPath('result', 'success')
            ->assertJsonPath('data.file_id', $file->id);
        $this->assertDatabaseHas('file_user_access', [
            'file_id' => $file->id,
            'user_id' => $saver->id,
        ]);
    }

    public function test_save_via_link_fails_for_own_file(): void
    {
        $owner = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $owner->id, 'status' => \App\Enums\FileStatus::Available]);
        FileUserAccess::factory()->owner()->create(['file_id' => $file->id, 'user_id' => $owner->id]);
        $link = ShareLink::factory()->withSave()->create(['file_id' => $file->id, 'created_by' => $owner->id]);

        $response = $this->actingAs($owner)
            ->postJson("/api/v1/links/{$link->token}/save");

        $response->assertStatus(422)
            ->assertJsonPath('data.code', 'OWN_FILE');
    }

    public function test_save_via_link_fails_without_save_permission(): void
    {
        $owner = User::factory()->create();
        $saver = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $owner->id, 'status' => \App\Enums\FileStatus::Available]);
        FileUserAccess::factory()->owner()->create(['file_id' => $file->id, 'user_id' => $owner->id]);
        $link = ShareLink::factory()->create(['file_id' => $file->id, 'created_by' => $owner->id, 'allow_save' => false]);

        $response = $this->actingAs($saver)
            ->postJson("/api/v1/links/{$link->token}/save");

        $response->assertStatus(403)
            ->assertJsonPath('data.code', 'SAVE_NOT_ALLOWED');
    }

    public function test_save_via_link_fails_when_already_saved(): void
    {
        $owner = User::factory()->create();
        $saver = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $owner->id, 'status' => \App\Enums\FileStatus::Available]);
        FileUserAccess::factory()->owner()->create(['file_id' => $file->id, 'user_id' => $owner->id]);
        FileUserAccess::factory()->create(['file_id' => $file->id, 'user_id' => $saver->id]);
        $link = ShareLink::factory()->withSave()->create(['file_id' => $file->id, 'created_by' => $owner->id]);

        $response = $this->actingAs($saver)
            ->postJson("/api/v1/links/{$link->token}/save");

        $response->assertStatus(422)
            ->assertJsonPath('data.code', 'ALREADY_SAVED');
    }
}
