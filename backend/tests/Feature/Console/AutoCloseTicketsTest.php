<?php

namespace Tests\Feature\Console;

use App\Models\SupportTicket;
use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class AutoCloseTicketsTest extends TestCase
{
    public function test_auto_closes_overdue_tickets(): void
    {
        $user = User::factory()->create();
        SupportTicket::create([
            'user_id'  => $user->id,
            'topic'    => 'Test issue',
            'body'     => 'Please help',
            'status'   => 'awaiting_confirmation',
            'awaiting_at' => now()->subHours(25),
        ]);

        Artisan::call('support:auto-close-tickets');

        $this->assertDatabaseHas('support_tickets', [
            'status'            => 'completed',
            'completion_reason' => 'auto_closed',
        ]);
    }

    public function test_does_not_close_recent_tickets(): void
    {
        $user = User::factory()->create();
        SupportTicket::create([
            'user_id'  => $user->id,
            'topic'    => 'Recent issue',
            'body'     => 'Still active',
            'status'   => 'awaiting_confirmation',
            'awaiting_at' => now()->subHours(2),
        ]);

        Artisan::call('support:auto-close-tickets');

        $this->assertDatabaseMissing('support_tickets', [
            'status'            => 'completed',
            'completion_reason' => 'auto_closed',
        ]);
    }

    public function test_does_not_close_tickets_in_other_statuses(): void
    {
        $user = User::factory()->create();
        $ticket = SupportTicket::create([
            'user_id'  => $user->id,
            'topic'    => 'New ticket',
            'body'     => 'Brand new',
            'status'   => 'new',
        ]);

        Artisan::call('support:auto-close-tickets');

        $this->assertDatabaseHas('support_tickets', [
            'id'     => $ticket->id,
            'status' => 'new',
        ]);
    }
}
