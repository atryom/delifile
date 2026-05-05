<?php

namespace App\Services;

use App\Models\SupportAttachment;
use App\Models\SuggestionAttachment;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class SupportAttachmentService
{
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
        foreach ($files as $file) {
            /** @var UploadedFile $file */
            $storageKey = 'support/' . $messageId . '/' . Str::ulid() . '/' . $file->getClientOriginalName();
            Storage::disk(config('filesystems.default'))->put($storageKey, file_get_contents($file->getRealPath()));

            SupportAttachment::create([
                'message_id'    => $messageId,
                'original_name' => $file->getClientOriginalName(),
                'storage_key'   => $storageKey,
                'mime_type'     => $file->getMimeType(),
                'size'          => $file->getSize(),
            ]);
        }
    }

    /**
     * Store uploaded files and create SuggestionAttachment records.
     */
    public function storeSuggestionAttachments(string $suggestionId, array $files): void
    {
        foreach ($files as $file) {
            /** @var UploadedFile $file */
            $storageKey = 'suggestions/' . $suggestionId . '/' . Str::ulid() . '/' . $file->getClientOriginalName();
            Storage::disk(config('filesystems.default'))->put($storageKey, file_get_contents($file->getRealPath()));

            SuggestionAttachment::create([
                'suggestion_id' => $suggestionId,
                'original_name' => $file->getClientOriginalName(),
                'storage_key'   => $storageKey,
                'mime_type'     => $file->getMimeType(),
                'size'          => $file->getSize(),
            ]);
        }
    }

    /**
     * Generate a short-lived presigned download URL for an attachment.
     */
    public function downloadUrl(string $storageKey): string
    {
        $disk = Storage::disk(config('filesystems.default'));

        if (method_exists($disk, 'temporaryUrl')) {
            return $disk->temporaryUrl($storageKey, now()->addMinutes(30));
        }

        return $disk->url($storageKey);
    }
}
