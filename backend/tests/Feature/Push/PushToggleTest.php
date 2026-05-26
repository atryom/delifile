<?php

namespace Tests\Feature\Push;

use App\Models\PushSubscription;
use App\Models\User;
use App\Services\PushNotificationService;
use Tests\TestCase;

class PushToggleTest extends TestCase
{
    // ─── Global toggle via service ─────────────────────────────────────────

    public function test_send_to_user_skips_when_notifications_disabled(): void
    {
        $user = User::factory()->create([
            'notifications_enabled' => false,
        ]);

        $endpoint = 'https://fcm.example.com/push-test';
        PushSubscription::create([
            'user_id'       => $user->id,
            'endpoint'      => $endpoint,
            'endpoint_hash' => hash('sha256', $endpoint),
            'p256dh'        => 'BNcRvLgEXAMPLEp2s=',
            'auth'          => 'Zx9CEXAMPLEvG3A=',
        ]);

        $pushService = $this->app->make(PushNotificationService::class);

        $pushService->sendToUser($user, 'Test title', 'Test body');

        $subscription = PushSubscription::where('endpoint', $endpoint)->first();
        $this->assertNotNull($subscription);
    }

    // ─── Toggle is included in /auth/me ───────────────────────────────────

    public function test_me_endpoint_returns_notification_toggles(): void
    {
        $user = User::factory()->create([
            'notifications_enabled' => true,
            'notify_new_files'      => false,
            'notify_folder_shared'  => true,
            'notify_comments'       => false,
            'notify_mentions'       => true,
            'notify_support_reply'  => false,
            'notify_contacts_added' => true,
        ]);

        $response = $this->actingAs($user)->getJson('/api/v1/auth/me');

        $response->assertOk()
            ->assertJsonPath('data.user.notifications_enabled', true)
            ->assertJsonPath('data.user.notify_new_files', false)
            ->assertJsonPath('data.user.notify_folder_shared', true)
            ->assertJsonPath('data.user.notify_comments', false)
            ->assertJsonPath('data.user.notify_mentions', true)
            ->assertJsonPath('data.user.notify_support_reply', false)
            ->assertJsonPath('data.user.notify_contacts_added', true);
    }
}
