<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PushClearSubscriptions extends Command
{
    protected $signature   = 'push:clear-subscriptions';
    protected $description = 'Truncate all push subscriptions to force re-subscription with new VAPID keys';

    public function handle(): int
    {
        DB::table('push_subscriptions')->truncate();

        $this->info('All push subscriptions have been cleared.');

        return 0;
    }
}
