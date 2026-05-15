<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Tests\TestCase;

class SessionTest extends TestCase
{
    public function test_authenticated_user_can_get_their_profile(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->getJson('/api/v1/auth/me');

        $response->assertOk()
            ->assertJsonStructure([
                'result',
                'data' => ['user'],
            ])
            ->assertJsonPath('data.user.email', $user->email);
    }

    public function test_unauthenticated_user_cannot_get_profile(): void
    {
        $response = $this->getJson('/api/v1/auth/me');

        $response->assertUnauthorized();
    }

    public function test_user_can_logout(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('test-token');

        $response = $this->withToken($token->plainTextToken)
            ->postJson('/api/v1/auth/logout');

        $response->assertOk()
            ->assertJson(['result' => 'success']);
    }

    public function test_user_can_logout_all_sessions(): void
    {
        $user = User::factory()->create();
        $user->createToken('session-1');
        $user->createToken('session-2');

        $response = $this->actingAs($user)
            ->postJson('/api/v1/auth/logout-all');

        $response->assertOk();
        $this->assertCount(0, $user->fresh()->tokens);
    }

    public function test_user_can_list_sessions(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('test-token');

        $response = $this->withToken($token->plainTextToken)
            ->getJson('/api/v1/auth/sessions');

        $response->assertOk()
            ->assertJsonStructure([
                'result',
                'data' => ['items'],
            ]);
    }

    public function test_user_can_delete_session(): void
    {
        $user = User::factory()->create();
        $token1 = $user->createToken('session-1');
        $token2 = $user->createToken('session-2');

        $deviceSession = \App\Models\DeviceSession::factory()->create([
            'user_id'  => $user->id,
            'token_id' => $token2->accessToken->id,
        ]);

        $response = $this->withToken($token1->plainTextToken)
            ->deleteJson("/api/v1/auth/sessions/{$deviceSession->id}");

        $response->assertOk();
    }

    public function test_delete_nonexistent_session_returns_404(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->deleteJson('/api/v1/auth/sessions/nonexistent-id');

        $response->assertStatus(404);
    }
}
