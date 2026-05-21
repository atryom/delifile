<?php

namespace Tests\Feature\Invitations;

use App\Models\Invitation;
use App\Models\User;
use Tests\TestCase;

class InvitationTest extends TestCase
{
    public function test_user_can_send_invitation(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/invitations', [
                'email' => 'invitee@example.com',
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('result', 'success')
            ->assertJsonStructure(['data' => ['invitation' => ['id', 'target_email', 'status']]]);
    }

    public function test_send_invitation_requires_email(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/invitations', []);

        $response->assertStatus(422);
    }

    public function test_user_can_show_invitation_by_token(): void
    {
        $sender = User::factory()->create();
        $invitation = Invitation::factory()->create(['sender_user_id' => $sender->id]);

        $response = $this->actingAs(User::factory()->create())
            ->getJson("/api/v1/invitations/{$invitation->token}");

        $response->assertOk()
            ->assertJsonPath('result', 'success')
            ->assertJsonPath('data.target_email', $invitation->target_email)
            ->assertJsonStructure(['data' => ['invitation', 'sender', 'target_email', 'user_exists']]);
    }

    public function test_show_invitation_with_invalid_token_returns_404(): void
    {
        $response = $this->actingAs(User::factory()->create())
            ->getJson('/api/v1/invitations/invalid-token-12345');

        $response->assertStatus(404)
            ->assertJsonPath('result', 'error');
    }

    public function test_user_can_accept_invitation(): void
    {
        $sender = User::factory()->create();
        $recipient = User::factory()->create();
        $invitation = Invitation::factory()->create([
            'sender_user_id' => $sender->id,
            'target_email'   => $recipient->email,
        ]);

        $response = $this->actingAs($recipient)
            ->postJson("/api/v1/invitations/{$invitation->token}/accept");

        $response->assertOk()
            ->assertJsonPath('result', 'success');
    }

    public function test_accept_expired_invitation_fails(): void
    {
        $sender = User::factory()->create();
        $recipient = User::factory()->create();
        $invitation = Invitation::factory()->create([
            'sender_user_id' => $sender->id,
            'target_email'   => $recipient->email,
            'expires_at'     => now()->subDay(),
        ]);

        $response = $this->actingAs($recipient)
            ->postJson("/api/v1/invitations/{$invitation->token}/accept");

        $response->assertStatus(422)
            ->assertJsonPath('data.code', 'EXPIRED');
    }

    public function test_accept_already_accepted_invitation_fails(): void
    {
        $sender = User::factory()->create();
        $recipient = User::factory()->create();
        $invitation = Invitation::factory()->accepted($recipient)->create([
            'sender_user_id' => $sender->id,
        ]);

        $response = $this->actingAs(User::factory()->create())
            ->postJson("/api/v1/invitations/{$invitation->token}/accept");

        $response->assertStatus(422)
            ->assertJsonPath('data.code', 'NOT_PENDING');
    }

    public function test_user_can_reject_invitation(): void
    {
        $sender = User::factory()->create();
        $invitation = Invitation::factory()->create(['sender_user_id' => $sender->id]);

        $response = $this->actingAs($sender)
            ->postJson("/api/v1/invitations/{$invitation->token}/reject");

        $response->assertOk()
            ->assertJsonPath('result', 'success');
    }

    public function test_reject_with_invalid_token_returns_404(): void
    {
        $response = $this->actingAs(User::factory()->create())
            ->postJson('/api/v1/invitations/invalid-token/reject');

        $response->assertStatus(404);
    }

    public function test_sender_can_cancel_own_invitation(): void
    {
        $sender = User::factory()->create();
        $invitation = Invitation::factory()->create(['sender_user_id' => $sender->id]);

        $response = $this->actingAs($sender)
            ->postJson("/api/v1/invitations/{$invitation->id}/cancel");

        $response->assertOk()
            ->assertJsonPath('result', 'success');
        $this->assertDatabaseHas('invitations', ['id' => $invitation->id, 'status' => 'cancelled']);
    }

    public function test_other_user_cannot_cancel_invitation(): void
    {
        $sender = User::factory()->create();
        $other = User::factory()->create();
        $invitation = Invitation::factory()->create(['sender_user_id' => $sender->id]);

        $response = $this->actingAs($other)
            ->postJson("/api/v1/invitations/{$invitation->id}/cancel");

        $response->assertStatus(403);
    }

    public function test_unauthenticated_user_cannot_access_invitations(): void
    {
        $response = $this->postJson('/api/v1/invitations', ['email' => 'test@test.com']);
        $response->assertUnauthorized();
    }
}
