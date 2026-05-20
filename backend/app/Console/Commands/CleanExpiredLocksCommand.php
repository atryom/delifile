<?php

namespace App\Console\Commands;

use App\Models\DocumentLock;
use Illuminate\Console\Command;

class CleanExpiredLocksCommand extends Command
{
    protected $signature   = 'locks:clean';
    protected $description = 'Delete expired document locks (TTL = 5 min).';

    public function handle(): void
    {
        $deleted = DocumentLock::where('expires_at', '<', now())->delete();
        $this->info("Deleted {$deleted} expired lock(s).");
    }
}
