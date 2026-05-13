<?php

namespace App\Jobs;

use App\Models\ShareLink;
use App\Models\SharedFolderLink;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ExpireShareLinksJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(): void
    {
        ShareLink::whereNotNull('expires_at')
            ->where('expires_at', '<', now())
            ->delete();

        SharedFolderLink::whereNotNull('expires_at')
            ->where('expires_at', '<', now())
            ->delete();
    }
}
