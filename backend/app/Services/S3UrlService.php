<?php

namespace App\Services;

use App\Models\File;
use App\Models\FileVersion;
use Illuminate\Support\Facades\Storage;

class S3UrlService
{
    private const TTL_PREVIEW  = 60;   // minutes — image/video thumbnail preview
    private const TTL_VIEW     = 120;  // minutes — video/audio/pdf streaming
    private const TTL_OG_IMAGE = 60;   // minutes — OG meta image
    private const TTL_CONTENT  = 15;   // minutes — /content redirect
    private const TTL_PREVIEW_REDIRECT = 60; // minutes — /preview redirect

    /**
     * Generate a presigned S3 PUT URL for direct upload.
     * Uses AWS SDK because Storage facade does not support PUT presigning.
     */
    public function generatePresignedPutUrl(string $key, string $mimeType): string
    {
        $client = Storage::disk('s3')->getClient();
        $bucket = config('filesystems.disks.s3.bucket');
        $ttl    = config('filesystems.disks.s3.presigned_url_ttl', 3600);

        $cmd = $client->getCommand('PutObject', [
            'Bucket'      => $bucket,
            'Key'         => $key,
            'ContentType' => $mimeType,
        ]);

        return (string) $client->createPresignedRequest($cmd, '+' . $ttl . ' seconds')->getUri();
    }

    /**
     * Generate a download URL for a file (attachment disposition).
     */
    public function generateDownloadUrl(File $file): string
    {
        $ttl = config('filesystems.disks.s3.presigned_url_ttl', 3600);
        return Storage::disk('s3')->temporaryUrl(
            $file->storage_key,
            now()->addSeconds($ttl),
            ['ResponseContentDisposition' => 'attachment; filename="' . $file->original_name . '"']
        );
    }

    /**
     * Generate a download URL for a file version (attachment disposition).
     */
    public function generateVersionDownloadUrl(FileVersion $version): string
    {
        $ttl = config('filesystems.disks.s3.presigned_url_ttl', 3600);
        return Storage::disk('s3')->temporaryUrl(
            $version->storage_key,
            now()->addSeconds($ttl),
            ['ResponseContentDisposition' => 'attachment; filename="' . $version->original_name . '"']
        );
    }

    /**
     * Resolve preview and view URLs for a file based on its MIME type.
     * Returns [$previewUrl, $viewUrl] — either may be null.
     */
    public function resolvePreviewAndViewUrls(File $file, string $mime): array
    {
        $previewUrl = null;
        $viewUrl    = null;

        if (str_starts_with($mime, 'image/')) {
            $url = $this->tryTemporaryUrl($file->storage_key, self::TTL_PREVIEW);
            $previewUrl = $url;
            $viewUrl    = $url;
        } elseif (str_starts_with($mime, 'video/')) {
            if ($file->thumbnail_key) {
                $previewUrl = $this->tryTemporaryUrl($file->thumbnail_key, self::TTL_PREVIEW);
            }
            $viewUrl = $this->tryTemporaryUrl($file->storage_key, self::TTL_VIEW);
        } elseif (str_starts_with($mime, 'audio/') || str_contains($mime, 'pdf')) {
            $viewUrl = $this->tryTemporaryUrl($file->storage_key, self::TTL_VIEW);
        }

        return [$previewUrl, $viewUrl];
    }

    /**
     * Resolve a preview-only URL for list items (image or video thumbnail).
     */
    public function resolveListPreviewUrl(File $file): ?string
    {
        $mime = $file->mime_type ?? '';
        if (str_starts_with($mime, 'image/') && $file->storage_key) {
            return $this->tryTemporaryUrl($file->storage_key, self::TTL_PREVIEW);
        }
        if (str_starts_with($mime, 'video/') && $file->thumbnail_key) {
            return $this->tryTemporaryUrl($file->thumbnail_key, self::TTL_PREVIEW);
        }
        return null;
    }

    /**
     * Resolve a preview URL for a file version.
     */
    public function resolveVersionPreviewUrl(FileVersion $version): ?string
    {
        $mime = $version->mime_type ?? '';
        if (str_starts_with($mime, 'image/') && $version->storage_key) {
            return $this->tryTemporaryUrl($version->storage_key, self::TTL_PREVIEW);
        }
        if (str_starts_with($mime, 'video/') && $version->thumbnail_key) {
            return $this->tryTemporaryUrl($version->thumbnail_key, self::TTL_PREVIEW);
        }
        return null;
    }

    /**
     * Resolve an OG image URL for social sharing preview.
     */
    public function resolveOgImageUrl(File $file, string $mime): string
    {
        if (!$file->isAvailable()) return '';

        $key = $file->thumbnail_key
            ?? (str_starts_with($mime, 'image/') ? $file->storage_key : null);

        if (!$key) return '';

        return $this->tryTemporaryUrl($key, self::TTL_OG_IMAGE) ?? '';
    }

    /**
     * Generate a content redirect URL (/content endpoint).
     * Throws on failure — caller must ensure the file key exists.
     */
    public function contentRedirectUrl(string $key): string
    {
        return Storage::disk('s3')->temporaryUrl($key, now()->addMinutes(self::TTL_CONTENT));
    }

    /**
     * Generate a preview redirect URL (/preview endpoint).
     * Throws on failure — caller must ensure the file key exists.
     */
    public function previewRedirectUrl(string $key): string
    {
        return Storage::disk('s3')->temporaryUrl($key, now()->addMinutes(self::TTL_PREVIEW_REDIRECT));
    }

    /**
     * Generate a temporary URL, logging and returning null on S3 errors.
     */
    public function tryTemporaryUrl(string $key, int $ttlMinutes, array $options = []): ?string
    {
        try {
            return Storage::disk('s3')->temporaryUrl($key, now()->addMinutes($ttlMinutes), $options);
        } catch (\Throwable $e) {
            logger()->error("S3UrlService: presigned URL failed for [{$key}]: " . $e->getMessage());
            return null;
        }
    }
}
