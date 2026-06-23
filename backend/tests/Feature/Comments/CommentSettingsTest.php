<?php

namespace Tests\Feature\Comments;

use App\Models\SharedFolder;
use App\Models\SharedFolderAccess;
use App\Models\User;
use Tests\TestCase;

class CommentSettingsTest extends TestCase
{
    // ─── Shared Folder Settings — GET ──────────────────────────────────────

    public function test_owner_can_get_shared_folder_comment_settings(): void
    {
        $user = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $user->id]);

        $response = $this->actingAs($user)
            ->getJson("/api/v1/shared-folders/{$folder->id}/comment-settings");

        $response->assertOk()
            ->assertJsonPath('result', 'success')
            ->assertJsonStructure(['data' => ['settings' => ['shared_comments_mode', 'mentions_enabled']]]);
    }

    public function test_editor_can_get_shared_folder_comment_settings(): void
    {
        $owner = User::factory()->create();
        $editor = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $owner->id]);
        SharedFolderAccess::factory()->edit()->create([
            'shared_folder_id' => $folder->id,
            'user_id'          => $editor->id,
        ]);

        $response = $this->actingAs($editor)
            ->getJson("/api/v1/shared-folders/{$folder->id}/comment-settings");

        $response->assertOk();
    }

    public function test_viewer_cannot_get_shared_folder_comment_settings(): void
    {
        $owner = User::factory()->create();
        $viewer = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $owner->id]);
        SharedFolderAccess::factory()->create([
            'shared_folder_id' => $folder->id,
            'user_id'          => $viewer->id,
        ]);

        $response = $this->actingAs($viewer)
            ->getJson("/api/v1/shared-folders/{$folder->id}/comment-settings");

        $response->assertStatus(403);
    }

    public function test_get_shared_folder_settings_nonexistent_returns_404(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->getJson('/api/v1/shared-folders/nonexistent/comment-settings');

        $response->assertStatus(404);
    }

    // ─── Shared Folder Settings — PATCH ────────────────────────────────────

    public function test_owner_can_update_shared_folder_comment_settings(): void
    {
        $user = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $user->id]);

        $response = $this->actingAs($user)
            ->patchJson("/api/v1/shared-folders/{$folder->id}/comment-settings", [
                'sharedCommentsMode' => 'disabled',
                'mentionsEnabled'    => false,
            ]);

        $response->assertOk()
            ->assertJsonPath('result', 'success')
            ->assertJsonStructure(['data' => ['settings']]);
    }

    public function test_editor_can_update_shared_folder_comment_settings(): void
    {
        $owner = User::factory()->create();
        $editor = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $owner->id]);
        SharedFolderAccess::factory()->edit()->create([
            'shared_folder_id' => $folder->id,
            'user_id'          => $editor->id,
        ]);

        $response = $this->actingAs($editor)
            ->patchJson("/api/v1/shared-folders/{$folder->id}/comment-settings", [
                'mentionsEnabled' => false,
            ]);

        $response->assertOk();
    }

    public function test_viewer_cannot_update_shared_folder_comment_settings(): void
    {
        $owner = User::factory()->create();
        $viewer = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $owner->id]);
        SharedFolderAccess::factory()->create([
            'shared_folder_id' => $folder->id,
            'user_id'          => $viewer->id,
        ]);

        $response = $this->actingAs($viewer)
            ->patchJson("/api/v1/shared-folders/{$folder->id}/comment-settings", [
                'sharedCommentsMode' => 'enabled',
            ]);

        $response->assertStatus(403);
    }

    public function test_update_shared_folder_settings_invalid_value_fails(): void
    {
        $user = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $user->id]);

        $response = $this->actingAs($user)
            ->patchJson("/api/v1/shared-folders/{$folder->id}/comment-settings", [
                'sharedCommentsMode' => 'invalid_value',
            ]);

        $response->assertStatus(422);
    }

    public function test_update_local_folder_settings_nonexistent_returns_404(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->patchJson('/api/v1/local-folders/nonexistent/comment-settings', [
                'privateCommentsEnabled' => true,
            ]);

        $response->assertStatus(404);
    }

    // ─── Auth ──────────────────────────────────────────────────────────────

    public function test_unauthenticated_cannot_access_comment_settings(): void
    {
        $response = $this->getJson('/api/v1/shared-folders/some-id/comment-settings');
        $response->assertUnauthorized();
    }
}
