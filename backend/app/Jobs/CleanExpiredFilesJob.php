<?php

namespace App\Jobs;

use App\Enums\AccessType;
use App\Enums\FileStatus;
use App\Enums\ShareLinkStatus;
use App\Models\File;
use App\Models\FileVersion;
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
            ->whereDoesntHave('accesses', fn ($q) => $q->where('access_type', AccessType::Saved->value))
            ->whereDoesntHave('shareLinks', fn ($q) => $q->where('status', ShareLinkStatus::Active->value))
            ->get();

        foreach ($files as $file) {
            try {
                $keys = array_filter([$file->storage_key, $file->thumbnail_key]);
                if ($keys) Storage::disk('s3')->delete(array_values($keys));
            } catch (\Exception $e) {
                logger()->error("S3 delete failed for file {$file->id}: " . $e->getMessage());
            }

            $file->update(['status' => FileStatus::Expired]);
            $file->delete();
        }

        // Clean stuck FileVersion uploads: Uploading status with expires_at in the past
        $stuckVersions = FileVersion::query()
            ->where('status', FileStatus::Uploading->value)
            ->where('expires_at', '<', now())
            ->get();

        foreach ($stuckVersions as $version) {
            try {
                $keys = array_filter([$version->storage_key, $version->thumbnail_key]);
                if ($keys) Storage::disk('s3')->delete(array_values($keys));
            } catch (\Exception $e) {
                logger()->error("S3 delete failed for version {$version->id}: " . $e->getMessage());
            }

            $version->delete();
        }

        // Clean uploading-orphans: stuck in Uploading with no expires_at for over 24 hours
        $orphans = File::query()
            ->where('status', FileStatus::Uploading->value)
            ->whereNull('expires_at')
            ->where('created_at', '<', now()->subHours(24))
            ->whereNull('deleted_at')
            ->get();

        foreach ($orphans as $file) {
            try {
                $keys = array_filter([$file->storage_key, $file->thumbnail_key]);
                if ($keys) Storage::disk('s3')->delete(array_values($keys));
            } catch (\Exception $e) {
                logger()->error("S3 delete failed for orphan {$file->id}: " . $e->getMessage());
            }

            $file->update(['status' => FileStatus::Deleted]);
            $file->delete();
        }
    }
}
