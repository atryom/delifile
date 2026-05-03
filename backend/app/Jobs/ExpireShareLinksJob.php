<?php

namespace App\Jobs;

use App\Enums\ShareLinkStatus;
use App\Models\ShareLink;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * ExpireShareLinksJob
 *
 * Marks expired share links as 'expired' status.
 * Runs on scheduler every 30 minutes.
 */
class ExpireShareLinksJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(): void
    {
        ShareLink::where('status', ShareLinkStatus::Active->value)
            ->where('expires_at', '<', now())
            ->update(['status' => ShareLinkStatus::Expired->value]);
    }
}
