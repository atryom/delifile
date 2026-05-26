<?php

namespace Tests\Feature\User;

use App\Models\User;
use Tests\TestCase;

class NotificationTogglesTest extends TestCase
{
    // ─── All toggles can be set ────────────────────────────────────────────

    public function test_all_notification_toggles_can_be_set(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->patchJson('/api/v1/user/settings', [
                'notifications_enabled' => false,
                'notify_new_files'      => false,
                'notify_folder_shared'  => false,
                'notify_comments'       => false,
                'notify_mentions'       => false,
                'notify_support_reply'  => false,
                'notify_contacts_added' => false,
            ]);

        $response->assertOk();

        $user->refresh();
        $this->assertFalse((bool) $user->notifications_enabled);
        $this->assertFalse((bool) $user->notify_new_files);
        $this->assertFalse((bool) $user->notify_folder_shared);
        $this->assertFalse((bool) $user->notify_comments);
        $this->assertFalse((bool) $user->notify_mentions);
        $this->assertFalse((bool) $user->notify_support_reply);
        $this->assertFalse((bool) $user->notify_contacts_added);
    }

    public function test_each_toggle_persists_individually(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->patchJson('/api/v1/user/settings', ['notify_comments' => false])
            ->assertOk();

        $user->refresh();
        $this->assertFalse((bool) $user->notify_comments);
        $this->assertNotFalse((bool) $user->notify_mentions);
    }

    // ─── Boolean validation ───────────────────────────────────────────────

    public function test_invalid_boolean_fails(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->patchJson('/api/v1/user/settings', [
                'notify_folder_shared' => 'not-a-boolean',
            ]);

        $response->assertStatus(422);
    }

    // ─── GET /auth/me returns toggles ─────────────────────────────────────

    public function test_user_info_contains_toggles(): void
    {
        $user = User::factory()->create([
            'notifications_enabled' => true,
            'notify_new_files'      => true,
            'notify_folder_shared'  => false,
            'notify_comments'       => false,
            'notify_mentions'       => false,
            'notify_support_reply'  => false,
            'notify_contacts_added' => false,
        ]);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/auth/me');

        $response->assertOk()
            ->assertJsonPath('data.user.notifications_enabled', true)
            ->assertJsonPath('data.user.notify_folder_shared', false)
            ->assertJsonPath('data.user.notify_comments', false);
    }

    // ─── Unauthenticated ──────────────────────────────────────────────────

    public function test_unauthenticated_user_cannot_update_settings(): void
    {
        $this->patchJson('/api/v1/user/settings', [
            'notifications_enabled' => true,
        ])->assertUnauthorized();
    }
}
