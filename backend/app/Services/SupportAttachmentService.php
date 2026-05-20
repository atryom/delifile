<?php

namespace App\Services;

use App\Models\SupportAttachment;
use App\Models\SuggestionAttachment;
use App\Services\S3UrlService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class SupportAttachmentService
{
    public function __construct(private readonly S3UrlService $s3) {}

    private const USER_ALLOWED_MIME = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
    ];
    private const USER_MAX_BYTES    = 10 * 1024 * 1024;  // 10 MB
    private const ADMIN_MAX_BYTES   = 50 * 1024 * 1024;  // 50 MB

    /**
     * Validate attachment set for user messages.
     * Returns an error string or null if valid.
     */
    public function validateUserFiles(array $files): ?string
    {
        $total = 0;
        foreach ($files as $file) {
            /** @var UploadedFile $file */
            if (!in_array($file->getMimeType(), self::USER_ALLOWED_MIME, true)) {
                return 'Разрешены только файлы JPG, JPEG, PNG, WEBP, GIF. Общий размер вложений в одном сообщении не должен превышать 10 МБ.';
            }
            $total += $file->getSize();
        }
        if ($total > self::USER_MAX_BYTES) {
            return 'Общий размер вложений в одном сообщении не должен превышать 10 МБ.';
        }
        return null;
    }

    /**
     * Validate attachment set for admin messages.
     */
    public function validateAdminFiles(array $files): ?string
    {
        $total = 0;
        foreach ($files as $file) {
            $total += $file->getSize();
        }
        if ($total > self::ADMIN_MAX_BYTES) {
            return 'Общий размер вложений в одном сообщении не должен превышать 50 МБ.';
        }
        return null;
    }

    /**
     * Store uploaded files and create SupportAttachment records for a message.
     */
    public function storeSupportAttachments(string $messageId, array $files): void
    {
        $rows        = [];
        $uploadedKeys = [];
        $now         = now();
        try {
            foreach ($files as $file) {
                /** @var UploadedFile $file */
                $storageKey = 'support/' . $messageId . '/' . Str::ulid() . '/' . $file->getClientOriginalName();
                Storage::disk('s3')->put($storageKey, file_get_contents($file->getRealPath()));
                $uploadedKeys[] = $storageKey;
                $rows[] = [
                    'id'            => Str::ulid(),
                    'message_id'    => $messageId,
                    'original_name' => $file->getClientOriginalName(),
                    'storage_key'   => $storageKey,
                    'mime_type'     => $file->getMimeType(),
                    'size'          => $file->getSize(),
                    'created_at'    => $now,
                    'updated_at'    => $now,
                ];
            }
            if (!empty($rows)) {
                SupportAttachment::insert($rows);
            }
        } catch (\Throwable $e) {
            if (!empty($uploadedKeys)) {
                Storage::disk('s3')->delete($uploadedKeys);
            }
            throw $e;
        }
    }

    /**
     * Store uploaded files and create SuggestionAttachment records.
     */
    public function storeSuggestionAttachments(string $suggestionId, array $files): void
    {
        $rows         = [];
        $uploadedKeys = [];
        $now          = now();
        try {
            foreach ($files as $file) {
                /** @var UploadedFile $file */
                $storageKey = 'suggestions/' . $suggestionId . '/' . Str::ulid() . '/' . $file->getClientOriginalName();
                Storage::disk('s3')->put($storageKey, file_get_contents($file->getRealPath()));
                $uploadedKeys[] = $storageKey;
                $rows[] = [
                    'id'            => Str::ulid(),
                    'suggestion_id' => $suggestionId,
                    'original_name' => $file->getClientOriginalName(),
                    'storage_key'   => $storageKey,
                    'mime_type'     => $file->getMimeType(),
                    'size'          => $file->getSize(),
                    'created_at'    => $now,
                    'updated_at'    => $now,
                ];
            }
            if (!empty($rows)) {
                SuggestionAttachment::insert($rows);
            }
        } catch (\Throwable $e) {
            if (!empty($uploadedKeys)) {
                Storage::disk('s3')->delete($uploadedKeys);
            }
            throw $e;
        }
    }

    /**
     * Generate a short-lived presigned download URL for an attachment.
     */
    public function downloadUrl(string $storageKey): ?string
    {
        return $this->s3->tryTemporaryUrl($storageKey, 30);
    }
}
