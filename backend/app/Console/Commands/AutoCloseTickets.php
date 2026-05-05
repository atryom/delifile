<?php

namespace App\Console\Commands;

use App\Models\SupportTicket;
use Illuminate\Console\Command;

class AutoCloseTickets extends Command
{
    protected $signature   = 'support:auto-close-tickets';
    protected $description = 'Auto-close support tickets that have been in awaiting_confirmation for 24+ hours';

    public function handle(): void
    {
        $cutoff = now()->subHours(24);

        $tickets = SupportTicket::where('status', 'awaiting_confirmation')
            ->where('awaiting_at', '<=', $cutoff)
            ->get();

        $now   = now();
        $count = 0;

        foreach ($tickets as $ticket) {
            $ticket->update([
                'status'            => 'completed',
                'completion_reason' => 'auto_closed',
                'auto_closed_at'    => $now,
                'completed_at'      => $now,
            ]);
            $count++;
        }

        $this->info("Auto-closed {$count} ticket(s).");
    }
}
