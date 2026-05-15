<?php

namespace Tests\Feature\Support;

use App\Models\SupportTicket;
use App\Models\User;
use Tests\TestCase;

class SupportTicketTest extends TestCase
{
    public function test_user_can_create_ticket(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/support/tickets', [
                'body' => 'I need help with uploading files.',
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('result', 'success')
            ->assertJsonStructure(['data' => ['ticket' => ['id', 'status', 'messages']]]);
    }

    public function test_create_ticket_requires_body(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/support/tickets', []);

        $response->assertStatus(422);
    }

    public function test_user_can_list_own_tickets(): void
    {
        $user = User::factory()->create();
        SupportTicket::create(['user_id' => $user->id, 'status' => 'new']);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/support/tickets');

        $response->assertOk()
            ->assertJsonPath('result', 'success')
            ->assertJsonStructure(['data' => ['items', 'pagination']]);
        $this->assertCount(1, $response->json('data.items'));
    }

    public function test_list_tickets_shows_only_own(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        SupportTicket::create(['user_id' => $user->id, 'status' => 'new']);
        SupportTicket::create(['user_id' => $other->id, 'status' => 'new']);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/support/tickets');

        $response->assertOk();
        $this->assertCount(1, $response->json('data.items'));
    }

    public function test_user_can_show_own_ticket(): void
    {
        $user = User::factory()->create();
        $ticket = SupportTicket::create(['user_id' => $user->id, 'status' => 'new']);

        $response = $this->actingAs($user)
            ->getJson("/api/v1/support/tickets/{$ticket->id}");

        $response->assertOk()
            ->assertJsonPath('result', 'success')
            ->assertJsonPath('data.ticket.id', $ticket->id);
    }

    public function test_show_other_users_ticket_returns_404(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $ticket = SupportTicket::create(['user_id' => $other->id, 'status' => 'new']);

        $response = $this->actingAs($user)
            ->getJson("/api/v1/support/tickets/{$ticket->id}");

        $response->assertStatus(404);
    }

    public function test_user_can_add_message(): void
    {
        $user = User::factory()->create();
        $ticket = SupportTicket::create(['user_id' => $user->id, 'status' => 'new']);

        $response = $this->actingAs($user)
            ->postJson("/api/v1/support/tickets/{$ticket->id}/messages", [
                'body' => 'More details about my issue.',
            ]);

        $response->assertOk()
            ->assertJsonPath('result', 'success')
            ->assertJsonStructure(['data' => ['message' => ['id', 'body', 'created_at']]]);
    }

    public function test_add_message_to_other_users_ticket_returns_404(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $ticket = SupportTicket::create(['user_id' => $other->id, 'status' => 'new']);

        $response = $this->actingAs($user)
            ->postJson("/api/v1/support/tickets/{$ticket->id}/messages", [
                'body' => 'Hacked!',
            ]);

        $response->assertStatus(404);
    }

    public function test_user_can_confirm_ticket_completion(): void
    {
        $user = User::factory()->create();
        $ticket = SupportTicket::create([
            'user_id' => $user->id,
            'status'  => 'awaiting_confirmation',
        ]);

        $response = $this->actingAs($user)
            ->postJson("/api/v1/support/tickets/{$ticket->id}/confirm");

        $response->assertOk()
            ->assertJsonPath('data.status', 'completed');
    }

    public function test_confirm_ticket_wrong_status_returns_422(): void
    {
        $user = User::factory()->create();
        $ticket = SupportTicket::create(['user_id' => $user->id, 'status' => 'new']);

        $response = $this->actingAs($user)
            ->postJson("/api/v1/support/tickets/{$ticket->id}/confirm");

        $response->assertStatus(422);
    }

    public function test_user_can_mark_ticket_read(): void
    {
        $user = User::factory()->create();
        $ticket = SupportTicket::create(['user_id' => $user->id, 'status' => 'in_progress']);

        $response = $this->actingAs($user)
            ->postJson("/api/v1/support/tickets/{$ticket->id}/mark-read");

        $response->assertOk();
    }

    public function test_add_message_to_nonexistent_ticket_returns_404(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/support/tickets/nonexistent/messages', [
                'body' => 'test',
            ]);

        $response->assertStatus(404);
    }

    public function test_unauthenticated_user_cannot_access_tickets(): void
    {
        $response = $this->getJson('/api/v1/support/tickets');
        $response->assertUnauthorized();
    }

    public function test_user_can_download_attachment_with_nonexistent_ticket_id(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->getJson('/api/v1/support/tickets/nonexistent/attachments/att1');

        $response->assertStatus(404);
    }
}
