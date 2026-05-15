<?php

namespace Tests\Feature\Admin;

use App\Models\SupportTicket;
use App\Models\User;
use Tests\TestCase;

class SupportAdminTest extends TestCase
{
    private User $admin;
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['is_superuser' => true]);
        $this->user  = User::factory()->create();
    }

    public function test_non_superuser_cannot_access_admin_support(): void
    {
        $user = User::factory()->create(['is_superuser' => false]);

        $response = $this->actingAs($user)->getJson('/api/v1/admin/support/tickets');

        $response->assertStatus(403)
            ->assertJsonPath('data.code', 'FORBIDDEN');
    }

    public function test_admin_can_list_tickets(): void
    {
        SupportTicket::create(['user_id' => $this->user->id, 'status' => 'new']);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/v1/admin/support/tickets');

        $response->assertOk()
            ->assertJsonPath('result', 'success')
            ->assertJsonStructure(['data' => ['items', 'pagination']]);
    }

    public function test_admin_can_filter_tickets_by_status(): void
    {
        SupportTicket::create(['user_id' => $this->user->id, 'status' => 'new']);
        SupportTicket::create(['user_id' => $this->user->id, 'status' => 'in_progress']);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/v1/admin/support/tickets?status=new');

        $response->assertOk();
        $this->assertCount(1, $response->json('data.items'));
    }

    public function test_admin_can_view_ticket_detail(): void
    {
        $ticket = SupportTicket::create(['user_id' => $this->user->id, 'status' => 'new']);

        $response = $this->actingAs($this->admin)
            ->getJson("/api/v1/admin/support/tickets/{$ticket->id}");

        $response->assertOk()
            ->assertJsonStructure(['data' => ['ticket' => ['id', 'status', 'user', 'messages']]]);
    }

    public function test_admin_view_nonexistent_ticket_returns_404(): void
    {
        $response = $this->actingAs($this->admin)
            ->getJson('/api/v1/admin/support/tickets/nonexistent');

        $response->assertStatus(404);
    }

    public function test_admin_can_take_ticket_in_work(): void
    {
        $ticket = SupportTicket::create(['user_id' => $this->user->id, 'status' => 'new']);

        $response = $this->actingAs($this->admin)
            ->postJson("/api/v1/admin/support/tickets/{$ticket->id}/take");

        $response->assertOk()
            ->assertJsonPath('data.status', 'in_progress');

        $this->assertDatabaseHas('support_tickets', [
            'id'     => $ticket->id,
            'status' => 'in_progress',
        ]);
    }

    public function test_cannot_take_already_taken_ticket(): void
    {
        $ticket = SupportTicket::create(['user_id' => $this->user->id, 'status' => 'in_progress']);

        $response = $this->actingAs($this->admin)
            ->postJson("/api/v1/admin/support/tickets/{$ticket->id}/take");

        $response->assertStatus(422);
    }

    public function test_admin_can_await_confirmation(): void
    {
        $ticket = SupportTicket::create(['user_id' => $this->user->id, 'status' => 'in_progress']);

        $response = $this->actingAs($this->admin)
            ->postJson("/api/v1/admin/support/tickets/{$ticket->id}/await-confirmation");

        $response->assertOk()
            ->assertJsonPath('data.status', 'awaiting_confirmation');
    }

    public function test_await_confirmation_requires_in_progress_status(): void
    {
        $ticket = SupportTicket::create(['user_id' => $this->user->id, 'status' => 'new']);

        $response = $this->actingAs($this->admin)
            ->postJson("/api/v1/admin/support/tickets/{$ticket->id}/await-confirmation");

        $response->assertStatus(422);
    }

    public function test_admin_can_add_message_to_ticket(): void
    {
        $ticket = SupportTicket::create(['user_id' => $this->user->id, 'status' => 'in_progress']);

        $response = $this->actingAs($this->admin)
            ->postJson("/api/v1/admin/support/tickets/{$ticket->id}/messages", [
                'body' => 'We have fixed the issue',
            ]);

        $response->assertOk()
            ->assertJsonStructure(['data' => ['message' => ['id', 'body', 'is_admin_message', 'created_at']]]);
        $this->assertDatabaseHas('support_messages', [
            'ticket_id'        => $ticket->id,
            'is_admin_message' => true,
            'body'             => 'We have fixed the issue',
        ]);
    }

    public function test_add_message_requires_body(): void
    {
        $ticket = SupportTicket::create(['user_id' => $this->user->id, 'status' => 'in_progress']);

        $response = $this->actingAs($this->admin)
            ->postJson("/api/v1/admin/support/tickets/{$ticket->id}/messages", []);

        $response->assertStatus(422);
    }

    public function test_cannot_add_message_to_completed_ticket(): void
    {
        $ticket = SupportTicket::create([
            'user_id' => $this->user->id,
            'status'  => 'completed',
        ]);

        $response = $this->actingAs($this->admin)
            ->postJson("/api/v1/admin/support/tickets/{$ticket->id}/messages", [
                'body' => 'Message after close',
            ]);

        $response->assertStatus(422);
    }

    public function test_admin_can_mark_ticket_read(): void
    {
        $ticket = SupportTicket::create(['user_id' => $this->user->id, 'status' => 'in_progress']);

        $response = $this->actingAs($this->admin)
            ->postJson("/api/v1/admin/support/tickets/{$ticket->id}/mark-read");

        $response->assertOk();
    }

    public function test_admin_mark_read_nonexistent_ticket_returns_404(): void
    {
        $response = $this->actingAs($this->admin)
            ->postJson('/api/v1/admin/support/tickets/nonexistent/mark-read');

        $response->assertStatus(404);
    }

    public function test_unauthenticated_cannot_access_admin_support(): void
    {
        $response = $this->getJson('/api/v1/admin/support/tickets');
        $response->assertUnauthorized();
    }
}
