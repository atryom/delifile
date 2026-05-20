<?php

namespace App\Services;

use Illuminate\Database\Eloquent\Builder;

class MimeService
{
    private const DOCUMENT_PATTERNS = [
        'pdf', 'msword', 'wordprocessingml', 'spreadsheetml', 'presentationml',
        'opendocument', 'ms-excel', 'ms-powerpoint', 'text/plain', 'text/csv', 'text/rtf',
    ];

    private const ARCHIVE_PATTERNS = ['zip', 'x-rar', 'x-7z', 'x-tar', 'gzip', 'bzip'];

    /**
     * Classify a file into a UI group (image/video/audio/document/archive/note/link/other).
     */
    public function classify(string $contentKind, string $mimeType): string
    {
        if ($contentKind === 'url_file') return 'link';
        if ($mimeType === 'text/markdown') return 'note';
        if (str_starts_with($mimeType, 'image/')) return 'image';
        if (str_starts_with($mimeType, 'video/')) return 'video';
        if (str_starts_with($mimeType, 'audio/')) return 'audio';

        foreach (self::DOCUMENT_PATTERNS as $pattern) {
            if (str_contains($mimeType, $pattern)) return 'document';
        }

        foreach (self::ARCHIVE_PATTERNS as $pattern) {
            if (str_contains($mimeType, $pattern)) return 'archive';
        }

        return 'other';
    }

    /**
     * Classify a MIME type into a broad group (image/video/audio/other).
     * Used for version compatibility checks.
     */
    public function getGroup(string $mimeType): string
    {
        if (str_starts_with($mimeType, 'image/')) return 'image';
        if (str_starts_with($mimeType, 'video/')) return 'video';
        if (str_starts_with($mimeType, 'audio/')) return 'audio';
        return 'other';
    }

    /**
     * Human-readable label for a MIME type (used in OG descriptions).
     */
    public function label(string $mimeType): string
    {
        return match(true) {
            str_starts_with($mimeType, 'image/')       => 'Изображение',
            str_starts_with($mimeType, 'video/')       => 'Видео',
            str_starts_with($mimeType, 'audio/')       => 'Аудио',
            str_contains($mimeType, 'pdf')             => 'PDF-документ',
            str_contains($mimeType, 'spreadsheet') ||
            str_contains($mimeType, 'excel')           => 'Таблица',
            str_contains($mimeType, 'word') ||
            str_contains($mimeType, 'document')        => 'Документ',
            str_contains($mimeType, 'zip') ||
            str_contains($mimeType, 'archive') ||
            str_contains($mimeType, 'rar')             => 'Архив',
            default                                    => 'Файл',
        };
    }

    /**
     * Whether a file can be previewed (has a thumbnail or inline view).
     */
    public function isPreviewable(string $mimeType): bool
    {
        return str_starts_with($mimeType, 'image/')
            || str_starts_with($mimeType, 'video/')
            || str_starts_with($mimeType, 'audio/')
            || str_contains($mimeType, 'pdf');
    }

    /**
     * Whether a file can be shown inline in the browser.
     */
    public function isViewableInBrowser(string $mimeType): bool
    {
        return str_starts_with($mimeType, 'image/')
            || str_starts_with($mimeType, 'video/')
            || str_starts_with($mimeType, 'audio/')
            || str_contains($mimeType, 'pdf');
    }

    /**
     * Apply a UI type-group filter to an Eloquent query.
     */
    public function buildSqlTypeGroupFilter(Builder $query, string $group): void
    {
        match($group) {
            'image'    => $query->where('mime_type', 'like', 'image/%'),
            'video'    => $query->where('mime_type', 'like', 'video/%'),
            'audio'    => $query->where('mime_type', 'like', 'audio/%'),
            'link'     => $query->where('content_kind', 'url_file'),
            'note'     => $query->where('mime_type', 'text/markdown'),
            'document' => $query->where('content_kind', 'binary_file')->where(
                fn($q) => $q
                    ->where('mime_type', 'like', '%pdf%')
                    ->orWhere('mime_type', 'like', '%msword%')
                    ->orWhere('mime_type', 'like', '%wordprocessingml%')
                    ->orWhere('mime_type', 'like', '%spreadsheetml%')
                    ->orWhere('mime_type', 'like', '%presentationml%')
                    ->orWhere('mime_type', 'like', '%opendocument%')
                    ->orWhere('mime_type', 'like', '%ms-excel%')
                    ->orWhere('mime_type', 'like', '%ms-powerpoint%')
                    ->orWhere('mime_type', 'like', 'text/plain')
                    ->orWhere('mime_type', 'like', 'text/csv')
                    ->orWhere('mime_type', 'like', 'text/rtf')
            ),
            'archive'  => $query->where('content_kind', 'binary_file')->where(
                fn($q) => $q
                    ->where('mime_type', 'like', '%zip%')
                    ->orWhere('mime_type', 'like', '%x-rar%')
                    ->orWhere('mime_type', 'like', '%x-7z%')
                    ->orWhere('mime_type', 'like', '%x-tar%')
                    ->orWhere('mime_type', 'like', '%gzip%')
                    ->orWhere('mime_type', 'like', '%bzip%')
            ),
            'other'    => $query->where('content_kind', 'binary_file')
                ->where('mime_type', 'not like', 'image/%')
                ->where('mime_type', 'not like', 'video/%')
                ->where('mime_type', 'not like', 'audio/%')
                ->where('mime_type', '!=', 'text/markdown')
                ->where(fn($q) => $q
                    ->where('mime_type', 'not like', '%pdf%')
                    ->where('mime_type', 'not like', '%msword%')
                    ->where('mime_type', 'not like', '%wordprocessingml%')
                    ->where('mime_type', 'not like', '%spreadsheetml%')
                    ->where('mime_type', 'not like', '%presentationml%')
                    ->where('mime_type', 'not like', '%opendocument%')
                    ->where('mime_type', 'not like', '%ms-excel%')
                    ->where('mime_type', 'not like', '%ms-powerpoint%')
                    ->where('mime_type', 'not like', 'text/plain')
                    ->where('mime_type', 'not like', 'text/csv')
                    ->where('mime_type', 'not like', 'text/rtf')
                    ->where('mime_type', 'not like', '%zip%')
                    ->where('mime_type', 'not like', '%x-rar%')
                    ->where('mime_type', 'not like', '%x-7z%')
                    ->where('mime_type', 'not like', '%x-tar%')
                    ->where('mime_type', 'not like', '%gzip%')
                    ->where('mime_type', 'not like', '%bzip%')
                ),
            default    => null,
        };
    }
}
