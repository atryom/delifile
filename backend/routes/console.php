<?php

use App\Jobs\CleanExpiredFilesJob;
use App\Jobs\ExpireShareLinksJob;
use Illuminate\Support\Facades\Schedule;

// Scheduler — runs via: php artisan schedule:run (cron every minute)

Schedule::job(new ExpireShareLinksJob)->everyThirtyMinutes()
    ->name('expire-share-links')
    ->withoutOverlapping();

Schedule::job(new CleanExpiredFilesJob)->hourly()
    ->name('clean-expired-files')
    ->withoutOverlapping();

Schedule::command('auth:block-unverified')->everyFifteenMinutes()
    ->name('block-unverified-accounts')
    ->withoutOverlapping();

Schedule::command('support:auto-close-tickets')->hourly()
    ->name('auto-close-tickets')
    ->withoutOverlapping();

Schedule::command('locks:clean')->everyFiveMinutes()
    ->name('clean-expired-locks')
    ->withoutOverlapping();
