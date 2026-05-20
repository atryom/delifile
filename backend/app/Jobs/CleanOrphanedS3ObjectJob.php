<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;

class CleanOrphanedS3ObjectJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(
        private readonly array $keys
    ) {}

    public function handle(): void
    {
        foreach ($this->keys as $key) {
            try {
                Storage::disk('s3')->delete($key);
            } catch (\Throwable $e) {
                logger()->error("CleanOrphanedS3ObjectJob: failed to delete key [{$key}]: " . $e->getMessage());
            }
        }
    }
}
