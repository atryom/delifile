<?php

namespace App\Console\Commands;

use App\Models\File;
use App\Models\FileVersion;
use App\Models\SuggestionAttachment;
use App\Models\SupportAttachment;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class S3AuditOrphans extends Command
{
    protected $signature   = 'app:s3-audit {--delete : Delete orphaned objects after confirmation}';
    protected $description = 'List S3 objects not referenced in the database (orphans)';

    public function handle(): int
    {
        $this->info('Collecting known keys from database...');
        $knownKeys = $this->collectDbKeys();
        $this->line('  Known keys: ' . count($knownKeys));

        $this->info('Listing objects in S3...');
        $orphans = $this->findOrphans($knownKeys);

        if (empty($orphans)) {
            $this->info('No orphaned objects found.');
            return self::SUCCESS;
        }

        $this->warn('Orphaned objects (' . count($orphans) . '):');
        $this->table(
            ['Key', 'Size (KB)', 'Last Modified'],
            array_map(fn ($o) => [
                $o['key'],
                number_format($o['size'] / 1024, 1),
                $o['last_modified'],
            ], $orphans)
        );

        if ($this->option('delete')) {
            if (!$this->confirm('Delete all ' . count($orphans) . ' orphaned objects from S3? This cannot be undone.')) {
                $this->line('Aborted.');
                return self::SUCCESS;
            }

            $this->deleteOrphans($orphans);
        }

        return self::SUCCESS;
    }

    private function collectDbKeys(): array
    {
        $keys = [];

        File::whereNotNull('storage_key')->pluck('storage_key')->each(fn ($k) => $keys[$k] = true);
        File::whereNotNull('thumbnail_key')->pluck('thumbnail_key')->each(fn ($k) => $keys[$k] = true);

        FileVersion::whereNotNull('storage_key')->pluck('storage_key')->each(fn ($k) => $keys[$k] = true);
        FileVersion::whereNotNull('thumbnail_key')->pluck('thumbnail_key')->each(fn ($k) => $keys[$k] = true);

        SupportAttachment::whereNotNull('storage_key')->pluck('storage_key')->each(fn ($k) => $keys[$k] = true);
        SuggestionAttachment::whereNotNull('storage_key')->pluck('storage_key')->each(fn ($k) => $keys[$k] = true);

        return $keys;
    }

    /** @return array<array{key: string, size: int, last_modified: string}> */
    private function findOrphans(array $knownKeys): array
    {
        $disk   = Storage::disk('s3');
        $client = $disk->getClient();
        $bucket = config('filesystems.disks.s3.bucket');

        $orphans            = [];
        $continuationToken  = null;

        do {
            $params = ['Bucket' => $bucket, 'MaxKeys' => 1000];
            if ($continuationToken) {
                $params['ContinuationToken'] = $continuationToken;
            }

            $result = $client->listObjectsV2($params);

            foreach ($result['Contents'] ?? [] as $object) {
                $key = $object['Key'];
                if (!isset($knownKeys[$key])) {
                    $orphans[] = [
                        'key'           => $key,
                        'size'          => $object['Size'],
                        'last_modified' => $object['LastModified']->format('Y-m-d H:i:s'),
                    ];
                }
            }

            $continuationToken = $result['IsTruncated'] ? $result['NextContinuationToken'] : null;
        } while ($continuationToken);

        return $orphans;
    }

    private function deleteOrphans(array $orphans): void
    {
        $disk   = Storage::disk('s3');
        $client = $disk->getClient();
        $bucket = config('filesystems.disks.s3.bucket');

        // Batch delete in chunks of 1000 (S3 limit)
        $chunks = array_chunk($orphans, 1000);
        $total  = 0;

        foreach ($chunks as $chunk) {
            $objects = array_map(fn ($o) => ['Key' => $o['key']], $chunk);

            $result = $client->deleteObjects([
                'Bucket' => $bucket,
                'Delete' => ['Objects' => $objects, 'Quiet' => false],
            ]);

            $deleted = count($result['Deleted'] ?? []);
            $errors  = $result['Errors'] ?? [];

            $total += $deleted;

            if (!empty($errors)) {
                foreach ($errors as $err) {
                    $this->error("Failed to delete {$err['Key']}: {$err['Message']}");
                }
            }
        }

        $this->info("Deleted {$total} orphaned objects.");
    }
}
