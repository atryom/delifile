<?php

namespace App\Jobs;

use App\Enums\FileStatus;
use App\Models\File;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;

/**
 * CleanExpiredFilesJob
 *
 * Scheduled via Laravel Scheduler.
 * Finds files with:
 *   - status 'available' or 'uploading'
 *   - expires_at in the past
 *   - no active 'saved' type accesses
 *   - no active share links
 * Marks them as 'expired' and removes S3 objects.
 */
class CleanExpiredFilesJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function handle(): void
    {
        $files = File::query()
            ->whereIn('status', [FileStatus::Available->value, FileStatus::Uploading->value])
            ->where('expires_at', '<', now())
            ->whereNull('deleted_at')
            ->get();

        foreach ($files as $file) {
            if ($file->canBeDeleted()) {
                // Remove from S3
                try {
                    Storage::disk('s3')->delete($file->storage_key);
                } catch (\Exception $e) {
                    // Log but continue
                    logger()->error("S3 delete failed for file {$file->id}: " . $e->getMessage());
                }

                $file->update(['status' => FileStatus::Expired]);
                $file->delete();
            }
        }
    }
}
