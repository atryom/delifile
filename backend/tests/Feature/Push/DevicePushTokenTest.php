<?php

namespace Tests\Feature\Push;

use App\Models\DevicePushToken;
use App\Models\User;
use Tests\TestCase;

class DevicePushTokenTest extends TestCase
{
    // ── Registration ─────────────────────────────────────────────────────────

    public function test_authenticated_user_can_register_android_token(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/push/device-token', [
                'token'    => 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxxxx]',
                'platform' => 'android',
            ]);

        $response->assertOk()->assertJsonPath('result', 'success');

        $this->assertDatabaseHas('device_push_tokens', [
            'user_id'  => $user->id,
            'platform' => 'android',
        ]);
    }

    public function test_authenticated_user_can_register_ios_token(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/push/device-token', [
                'token'     => 'ExponentPushToken[iiiiiiiiiiiiiiiiiiiiii]',
                'platform'  => 'ios',
                'device_id' => 'test-device-uuid',
            ]);

        $response->assertOk()->assertJsonPath('result', 'success');

        $this->assertDatabaseHas('device_push_tokens', [
            'user_id'   => $user->id,
            'platform'  => 'ios',
            'device_id' => 'test-device-uuid',
        ]);
    }

    public function test_registering_same_token_twice_does_not_create_duplicate(): void
    {
        $user  = User::factory()->create();
        $token = 'ExponentPushToken[duplicate]';

        $this->actingAs($user)->postJson('/api/v1/push/device-token', [
            'token' => $token, 'platform' => 'android',
        ]);

        $this->actingAs($user)->postJson('/api/v1/push/device-token', [
            'token' => $token, 'platform' => 'android',
        ]);

        $this->assertSame(1, DevicePushToken::where('user_id', $user->id)->count());
    }

    public function test_register_token_requires_token_and_platform(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->postJson('/api/v1/push/device-token', [])
            ->assertStatus(422);
    }

    public function test_register_token_rejects_invalid_platform(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->postJson('/api/v1/push/device-token', [
                'token'    => 'ExponentPushToken[xxx]',
                'platform' => 'windows',
            ])
            ->assertStatus(422);
    }

    public function test_unauthenticated_cannot_register_token(): void
    {
        $this->postJson('/api/v1/push/device-token', [
            'token'    => 'ExponentPushToken[xxx]',
            'platform' => 'android',
        ])->assertUnauthorized();
    }

    // ── Unregistration ───────────────────────────────────────────────────────

    public function test_authenticated_user_can_unregister_token(): void
    {
        $user  = User::factory()->create();
        $token = 'ExponentPushToken[toremove]';

        DevicePushToken::create([
            'user_id'  => $user->id,
            'token'    => $token,
            'platform' => 'android',
        ]);

        $response = $this->actingAs($user)
            ->deleteJson('/api/v1/push/device-token', ['token' => $token]);

        $response->assertOk()->assertJsonPath('result', 'success');

        $this->assertDatabaseMissing('device_push_tokens', [
            'user_id' => $user->id,
            'token'   => $token,
        ]);
    }

    public function test_unregister_token_requires_token_field(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->deleteJson('/api/v1/push/device-token', [])
            ->assertStatus(422);
    }

    public function test_unregister_nonexistent_token_returns_success(): void
    {
        $user = User::factory()->create();

        // Should not throw — idempotent
        $this->actingAs($user)
            ->deleteJson('/api/v1/push/device-token', ['token' => 'nonexistent'])
            ->assertOk();
    }

    public function test_user_cannot_remove_another_users_token(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $token = 'ExponentPushToken[foreign]';

        DevicePushToken::create([
            'user_id'  => $owner->id,
            'token'    => $token,
            'platform' => 'android',
        ]);

        $this->actingAs($other)
            ->deleteJson('/api/v1/push/device-token', ['token' => $token])
            ->assertOk();

        // Owner's token must still exist
        $this->assertDatabaseHas('device_push_tokens', [
            'user_id' => $owner->id,
            'token'   => $token,
        ]);
    }

    public function test_unauthenticated_cannot_unregister_token(): void
    {
        $this->deleteJson('/api/v1/push/device-token', ['token' => 'ExponentPushToken[xxx]'])
            ->assertUnauthorized();
    }

    // ── Token cleanup on cascade ──────────────────────────────────────────────

    public function test_tokens_deleted_when_user_is_deleted(): void
    {
        $user  = User::factory()->create();
        $token = 'ExponentPushToken[cascade]';

        DevicePushToken::create([
            'user_id'  => $user->id,
            'token'    => $token,
            'platform' => 'android',
        ]);

        $user->delete();

        $this->assertDatabaseMissing('device_push_tokens', ['token' => $token]);
    }
}
