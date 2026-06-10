<?php

namespace App\Console\Commands;

use App\Jobs\GeneratePdfPreview;
use App\Models\File;
use Illuminate\Console\Command;

class GeneratePdfPreviews extends Command
{
    protected $signature = 'pdf:generate-previews
                            {--force : Re-queue files that already have a thumbnail}';

    protected $description = 'Dispatch GeneratePdfPreview jobs for PDF files without a thumbnail';

    public function handle(): int
    {
        $query = File::where('status', 'available')
            ->whereNotNull('storage_key')
            ->where('mime_type', 'like', '%pdf%');

        if (!$this->option('force')) {
            $query->whereNull('thumbnail_key');
        }

        $total = $query->count();

        if ($total === 0) {
            $this->info('No PDF files need processing.');
            return self::SUCCESS;
        }

        $this->info("Found {$total} PDF file(s) to process.");

        $dispatched = 0;
        $query->chunkById(100, function ($files) use (&$dispatched) {
            foreach ($files as $file) {
                GeneratePdfPreview::dispatch($file->id)->onQueue('default');
                $dispatched++;
                $this->line("  Queued: [{$file->id}] {$file->original_name}");
            }
        });

        $this->info("Dispatched {$dispatched} job(s). Run queue worker to process them:");
        $this->line('  php artisan queue:work --queue=default --tries=2');

        return self::SUCCESS;
    }
}
