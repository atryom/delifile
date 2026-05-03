<?php

namespace App\Console;

use App\Jobs\CleanExpiredFilesJob;
use App\Jobs\ExpireShareLinksJob;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    /**
     * Define the application's command schedule.
     */
    protected function schedule(Schedule $schedule): void
    {
        // Expire share links every 30 minutes
        $schedule->job(new ExpireShareLinksJob)->everyThirtyMinutes()
            ->name('expire-share-links')
            ->withoutOverlapping();

        // Clean expired files — runs hourly
        $schedule->job(new CleanExpiredFilesJob)->hourly()
            ->name('clean-expired-files')
            ->withoutOverlapping();
    }

    /**
     * Register the commands for the application.
     */
    protected function commands(): void
    {
        $this->load(__DIR__ . '/Commands');
        require base_path('routes/console.php');
    }
}
