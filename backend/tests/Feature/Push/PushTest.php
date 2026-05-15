<?php

namespace Tests\Feature\Push;

use App\Models\PushSubscription;
use App\Models\User;
use Tests\TestCase;

class PushTest extends TestCase
{
    public function test_vapid_key_is_returned_publicly(): void
    {
        $response = $this->getJson('/api/v1/push/vapid-key');

        $response->assertOk()
            ->assertJsonPath('result', 'success')
            ->assertJsonStructure(['data' => ['public_key']]);
    }

    public function test_authenticated_user_can_subscribe(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/push/subscribe', [
                'endpoint' => 'https://fcm.example.com/abc123',
                'p256dh'   => 'BNcRvLg...p2s=',
                'auth'     => 'Zx9C...vG3A=',
            ]);

        $response->assertOk()
            ->assertJsonPath('result', 'success');

        $this->assertDatabaseHas('push_subscriptions', [
            'user_id' => $user->id,
        ]);
    }

    public function test_subscribe_requires_all_fields(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/push/subscribe', []);

        $response->assertStatus(422);
    }

    public function test_subscribe_updates_existing_subscription(): void
    {
        $user = User::factory()->create();
        $endpoint = 'https://fcm.example.com/abc123';

        PushSubscription::create([
            'user_id'       => $user->id,
            'endpoint'      => $endpoint,
            'endpoint_hash' => hash('sha256', $endpoint),
            'p256dh'        => 'old_key',
            'auth'          => 'old_auth',
        ]);

        $response = $this->actingAs($user)
            ->postJson('/api/v1/push/subscribe', [
                'endpoint' => $endpoint,
                'p256dh'   => 'new_key',
                'auth'     => 'new_auth',
            ]);

        $response->assertOk();
        $this->assertDatabaseHas('push_subscriptions', [
            'user_id' => $user->id,
            'p256dh'  => 'new_key',
            'auth'    => 'new_auth',
        ]);
    }

    public function test_authenticated_user_can_unsubscribe(): void
    {
        $user = User::factory()->create();
        $endpoint = 'https://fcm.example.com/abc123';

        PushSubscription::create([
            'user_id'       => $user->id,
            'endpoint'      => $endpoint,
            'endpoint_hash' => hash('sha256', $endpoint),
            'p256dh'        => 'key',
            'auth'          => 'auth',
        ]);

        $response = $this->actingAs($user)
            ->deleteJson('/api/v1/push/unsubscribe', ['endpoint' => $endpoint]);

        $response->assertOk()
            ->assertJsonPath('result', 'success');

        $this->assertDatabaseMissing('push_subscriptions', [
            'user_id' => $user->id,
            'endpoint_hash' => hash('sha256', $endpoint),
        ]);
    }

    public function test_unsubscribe_requires_endpoint(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->deleteJson('/api/v1/push/unsubscribe', []);

        $response->assertStatus(422);
    }

    public function test_unauthenticated_cannot_subscribe(): void
    {
        $response = $this->postJson('/api/v1/push/subscribe', [
            'endpoint' => 'https://fcm.example.com/abc',
            'p256dh'   => 'key',
            'auth'     => 'auth',
        ]);

        $response->assertUnauthorized();
    }

    public function test_unauthenticated_cannot_unsubscribe(): void
    {
        $response = $this->deleteJson('/api/v1/push/unsubscribe', ['endpoint' => 'https://fcm.example.com/abc']);

        $response->assertUnauthorized();
    }
}
