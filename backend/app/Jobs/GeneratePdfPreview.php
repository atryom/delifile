<?php

namespace App\Jobs;

use App\Models\File;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;

class GeneratePdfPreview implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;
    public int $timeout = 120;

    public function __construct(public readonly string $fileId) {}

    public function handle(): void
    {
        $file = File::find($this->fileId);
        if (!$file || !$file->storage_key || $file->thumbnail_key) {
            return;
        }

        $tmpPdf  = tempnam(sys_get_temp_dir(), 'pdf_') . '.pdf';
        $tmpBase = tempnam(sys_get_temp_dir(), 'pdft_');

        try {
            // Download PDF from S3
            $stream = Storage::disk('s3')->readStream($file->storage_key);
            if (!$stream) return;
            file_put_contents($tmpPdf, $stream);

            // Generate first page as JPEG (150 dpi)
            $cmd = sprintf(
                'pdftoppm -jpeg -r 150 -f 1 -l 1 %s %s 2>/dev/null',
                escapeshellarg($tmpPdf),
                escapeshellarg($tmpBase)
            );
            exec($cmd, $output, $exitCode);
            if ($exitCode !== 0) return;

            // pdftoppm creates {base}-1.jpg or {base}-01.jpg depending on version
            $jpegFile = null;
            foreach (glob($tmpBase . '-*.jpg') ?: glob($tmpBase . '-*.jpeg') ?: [] as $f) {
                $jpegFile = $f;
                break;
            }
            if (!$jpegFile || !file_exists($jpegFile)) return;

            // Upload thumbnail to S3
            $thumbKey = 'files/' . $file->owner_id . '/' . $file->id . '/thumb_preview.jpg';
            Storage::disk('s3')->put($thumbKey, file_get_contents($jpegFile), [
                'ContentType' => 'image/jpeg',
                'visibility'  => 'private',
            ]);

            // Save thumbnail key
            File::where('id', $file->id)
                ->whereNull('thumbnail_key')
                ->update(['thumbnail_key' => $thumbKey]);

        } finally {
            @unlink($tmpPdf);
            @unlink($tmpBase);
            foreach (glob($tmpBase . '-*.jpg') ?: glob($tmpBase . '-*.jpeg') ?: [] as $f) {
                @unlink($f);
            }
        }
    }
}
