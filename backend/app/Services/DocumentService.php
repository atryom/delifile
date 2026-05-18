<?php

namespace App\Services;

use App\Enums\AccessType;
use App\Enums\ActivityType;
use App\Enums\FileStatus;
use App\Models\DocumentLock;
use App\Models\File;
use App\Models\FileUserAccess;
use App\Models\SharedFolder;
use App\Models\SharedFolderAccess;
use App\Models\SharedFolderFile;
use App\Models\User;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use App\Services\FileService;

class DocumentService
{
    private const LOCK_TTL_MINUTES = 5;
    private const EDITOR_TYPE      = 'markdown';
    private const MIME_TYPE        = 'text/markdown';

    public function __construct(
        private readonly ActivityService $activityService,
        private readonly FileService     $fileService,
    ) {}

    public function createDocument(User $user, string $fileName): array
    {
        $ulid       = Str::ulid();
        $storageKey = 'files/' . $user->id . '/' . $ulid . '/' . $fileName;

        $file = File::create([
            'owner_id'     => $user->id,
            'original_name'=> $fileName,
            'storage_key'  => $storageKey,
            'size'         => 0,
            'mime_type'    => self::MIME_TYPE,
            'status'       => FileStatus::Available,
            'content_kind' => 'binary_file',
            'is_editable'  => true,
            'editor_type'  => self::EDITOR_TYPE,
        ]);

        Storage::disk('s3')->put($storageKey, '', [
            'ContentType' => self::MIME_TYPE,
        ]);

        // Obtain ETag from S3
        $etag = $this->fetchEtagFromS3($storageKey);

        $file->update(['etag' => $etag, 'updated_by' => $user->id]);

        FileUserAccess::create([
            'file_id'     => $file->id,
            'user_id'     => $user->id,
            'access_type' => AccessType::Owner,
            'can_edit'    => true,
        ]);

        $this->activityService->log($file, $user, ActivityType::Uploaded);

        return $this->buildDocumentResponse($file, $user, '');
    }

    public function getDocument(File $file, User $user): array
    {
        try {
            $content = Storage::disk('s3')->get($file->storage_key) ?? '';
        } catch (\Throwable) {
            $content = '';
        }

        // Replace stable API image URLs with fresh presigned S3 URLs so <img> tags load.
        $content = $this->hydrateImageUrls($content);

        return $this->buildDocumentResponse($file, $user, $content);
    }

    public function saveDocument(File $file, User $user, string $content, string $clientEtag): array
    {
        if ($file->etag !== $clientEtag) {
            return [
                'conflict' => true,
                'current'  => [
                    'etag'       => $file->etag,
                    'updatedAt'  => $file->updated_at?->toIso8601String(),
                    'updatedBy'  => $this->formatUser($file->updatedByUser),
                ],
            ];
        }

        // Quota check: only the size delta matters — the current file is already counted.
        $newSize = strlen($content);
        $delta   = max(0, $newSize - (int) $file->size);
        if ($delta > 0 && !$this->fileService->checkStorageQuota($user, $delta)) {
            return ['quota_exceeded' => true];
        }

        // Normalize any presigned S3 URLs back to stable /api/v1/files/{id}/content paths.
        $content = $this->normalizeImageUrls($content);

        Storage::disk('s3')->put($file->storage_key, $content, [
            'ContentType' => self::MIME_TYPE,
        ]);

        $newEtag = $this->fetchEtagFromS3($file->storage_key);

        $file->update([
            'size'       => strlen($content),
            'etag'       => $newEtag,
            'updated_by' => $user->id,
        ]);

        $this->activityService->log($file, $user, ActivityType::Uploaded);

        return [
            'conflict'  => false,
            'id'        => $file->id,
            'etag'      => $newEtag,
            'updatedAt' => $file->fresh()->updated_at?->toIso8601String(),
            'updatedBy' => $this->formatUser($user),
        ];
    }

    public function canEditDocument(User $user, File $file): bool
    {
        if ($file->isOwnedBy($user)) {
            return true;
        }

        $access = FileUserAccess::where('file_id', $file->id)
            ->where('user_id', $user->id)
            ->where('access_type', AccessType::Shared)
            ->first();

        return $access?->can_edit === true;
    }

    public function canViewDocument(User $user, File $file): bool
    {
        if ($file->isOwnedBy($user)) {
            return true;
        }

        if (FileUserAccess::where('file_id', $file->id)->where('user_id', $user->id)->exists()) {
            return true;
        }

        // Access via shared folder
        $sharedFolderIds = SharedFolderFile::where('file_id', $file->id)->pluck('shared_folder_id');

        foreach ($sharedFolderIds as $folderId) {
            $current = SharedFolder::find($folderId);
            $visited = [];
            while ($current) {
                if (isset($visited[$current->id])) {
                    break; // cycle guard
                }
                $visited[$current->id] = true;

                if ($current->owner_id === $user->id) {
                    return true;
                }
                if (SharedFolderAccess::where('shared_folder_id', $current->id)
                    ->where('user_id', $user->id)->exists()) {
                    return true;
                }
                $current = $current->parent;
            }
        }

        return false;
    }

    // ── Lock ─────────────────────────────────────────────────────────────────

    public function acquireLock(File $file, User $user): array
    {
        $existing = DocumentLock::find($file->id);

        if ($existing && !$existing->isExpired() && !$existing->isOwnedBy($user)) {
            return [
                'acquired' => false,
                'lock'     => $this->formatLock($existing, $file, $user),
            ];
        }

        $lock = DocumentLock::updateOrCreate(
            ['file_id' => $file->id],
            [
                'user_id'    => $user->id,
                'expires_at' => now()->addMinutes(self::LOCK_TTL_MINUTES),
                'created_at' => now(),
            ]
        );

        return [
            'acquired' => true,
            'lock'     => $this->formatLock($lock, $file, $user),
        ];
    }

    public function renewLock(File $file, User $user): string
    {
        $lock = DocumentLock::find($file->id);

        if (!$lock || $lock->isExpired()) {
            return 'LOCK_EXPIRED';
        }

        if (!$lock->isOwnedBy($user)) {
            return 'LOCK_TAKEN_OVER';
        }

        $lock->update(['expires_at' => now()->addMinutes(self::LOCK_TTL_MINUTES)]);

        return 'OK';
    }

    public function releaseLock(File $file, User $user): bool
    {
        $lock = DocumentLock::find($file->id);

        if (!$lock || !$lock->isOwnedBy($user)) {
            return false;
        }

        $lock->delete();

        return true;
    }

    public function takeoverLock(File $file, User $user): array
    {
        $lock = DocumentLock::updateOrCreate(
            ['file_id' => $file->id],
            [
                'user_id'    => $user->id,
                'expires_at' => now()->addMinutes(self::LOCK_TTL_MINUTES),
                'created_at' => now(),
            ]
        );

        return $this->formatLock($lock, $file, $user);
    }

    public function hasValidLock(File $file, User $user): bool
    {
        $lock = DocumentLock::find($file->id);

        return $lock && !$lock->isExpired() && $lock->isOwnedBy($user);
    }

    // ── Images ───────────────────────────────────────────────────────────────

    public function getAccessibleImages(User $user, ?string $search, int $perPage, ?string $cursor): array
    {
        $imageMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

        $query = File::query()
            ->whereIn('mime_type', $imageMimes)
            ->where('status', FileStatus::Available)
            ->where(function ($q) use ($user) {
                $q->where('owner_id', $user->id)
                  ->orWhereHas('accesses', fn ($a) => $a->where('user_id', $user->id))
                  ->orWhereHas('sharedFolderFiles', function ($sfq) use ($user) {
                      $sfq->whereHas('folder', function ($fq) use ($user) {
                          $fq->where('owner_id', $user->id)
                             ->orWhereHas('accesses', fn ($a) => $a->where('user_id', $user->id));
                      });
                  });
            });

        if ($search) {
            $query->where('original_name', 'like', '%' . $search . '%');
        }

        if ($cursor) {
            $query->where('id', '<', $cursor);
        }

        $items = $query->orderByDesc('id')->limit($perPage + 1)->get();

        $hasMore    = $items->count() > $perPage;
        $items      = $items->take($perPage);
        $nextCursor = $hasMore ? $items->last()?->id : null;

        return [
            'items'      => $items->map(fn ($f) => $this->formatImageItem($f))->values(),
            'nextCursor' => $nextCursor,
        ];
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private function buildDocumentResponse(File $file, User $user, string $content): array
    {
        $lock   = DocumentLock::find($file->id);
        $canEdit = $this->canEditDocument($user, $file);

        if ($lock && !$lock->isExpired()) {
            $lockData = [
                'isLocked'    => true,
                'lockedBy'    => $this->formatUser($lock->user),
                'expiresAt'   => $lock->expires_at->toIso8601String(),
                'canTakeOver' => $file->isOwnedBy($user),
            ];
        } else {
            $lockData = ['isLocked' => false];
        }

        return [
            'id'         => $file->id,
            'fileName'   => $file->original_name,
            'mimeType'   => $file->mime_type,
            'isEditable' => $file->is_editable,
            'editorType' => $file->editor_type,
            'content'    => $content,
            'etag'       => $file->etag,
            'updatedAt'  => $file->updated_at?->toIso8601String(),
            'updatedBy'  => $this->formatUser($file->updatedByUser),
            'lock'       => $lockData,
            'capabilities' => [
                'canEdit'         => $canEdit,
                'canRename'       => $file->isOwnedBy($user),
                'canDelete'       => $file->isOwnedBy($user),
                'canInsertImages' => $this->canViewDocument($user, $file),
                'canTakeOverLock' => $file->isOwnedBy($user),
            ],
        ];
    }

    private function formatLock(DocumentLock $lock, File $file, User $currentUser): array
    {
        return [
            'isLocked'    => true,
            'lockedBy'    => $this->formatUser($lock->user),
            'expiresAt'   => $lock->expires_at->toIso8601String(),
            'canTakeOver' => $file->isOwnedBy($currentUser),
        ];
    }

    private function formatUser(?User $user): ?array
    {
        if (!$user) {
            return null;
        }

        return ['id' => $user->id, 'name' => $user->name ?? $user->email];
    }

    private function formatImageItem(File $file): array
    {
        $ttl        = now()->addHour();
        $previewKey = $file->thumbnail_key ?? $file->storage_key;

        try {
            $previewUrl = Storage::disk('s3')->temporaryUrl($previewKey, $ttl);
            $assetUrl   = Storage::disk('s3')->temporaryUrl($file->storage_key, $ttl);
        } catch (\Throwable) {
            $previewUrl = '/api/v1/files/' . $file->id . '/preview';
            $assetUrl   = '/api/v1/files/' . $file->id . '/content';
        }

        return [
            'id'         => $file->id,
            'fileName'   => $file->original_name,
            'mimeType'   => $file->mime_type,
            'size'       => $file->size,
            'width'      => $file->width,
            'height'     => $file->height,
            'previewUrl' => $previewUrl,
            'assetUrl'   => $assetUrl,
            'stableUrl'  => '/api/v1/files/' . $file->id . '/content',
            'updatedAt'  => $file->updated_at?->toIso8601String(),
        ];
    }

    /**
     * Replace stable /api/v1/files/{id}/content URLs in markdown content
     * with fresh presigned S3 URLs so <img> tags render without auth headers.
     */
    private function hydrateImageUrls(string $content): string
    {
        return preg_replace_callback(
            '#/api/v1/files/([a-z0-9]+)/content#',
            function (array $m): string {
                $file = File::find($m[1]);
                if (!$file) {
                    return $m[0];
                }
                try {
                    return Storage::disk('s3')->temporaryUrl($file->storage_key, now()->addHour());
                } catch (\Throwable) {
                    return $m[0];
                }
            },
            $content
        ) ?? $content;
    }

    /**
     * Replace presigned S3 URLs in markdown content with stable API URLs
     * so the stored document always contains durable, auth-independent paths.
     */
    private function normalizeImageUrls(string $content): string
    {
        $endpoint = rtrim((string) config('filesystems.disks.s3.endpoint', ''), '/');
        $bucket   = (string) config('filesystems.disks.s3.bucket', '');

        if (!$endpoint || !$bucket) {
            return $content;
        }

        // Match presigned S3 URLs: https://<host>/<bucket>/<key>?X-Amz-...
        // or https://<bucket>.<host>/<key>?X-Amz-...
        $pattern = '#https?://[^\s"\')\]]+X-Amz-[^\s"\')\]]+#';

        // Collect all matches first to batch a single DB query.
        $matches = [];
        preg_match_all($pattern, $content, $matches);
        $allUrls = array_unique($matches[0] ?? []);

        if (empty($allUrls)) {
            return $content;
        }

        // Resolve storage keys for every matched URL.
        $urlToKey = [];
        foreach ($allUrls as $url) {
            $parsed = parse_url($url);
            if (!$parsed || empty($parsed['path'])) {
                continue;
            }
            $path = ltrim($parsed['path'], '/');
            if ($bucket && str_starts_with($path, $bucket . '/')) {
                $path = substr($path, strlen($bucket) + 1);
            }
            $urlToKey[$url] = urldecode($path);
        }

        $storageKeys = array_values($urlToKey);
        $files = File::whereIn('storage_key', $storageKeys)->get()->keyBy('storage_key');

        return preg_replace_callback($pattern, function (array $m) use ($urlToKey, $files): string {
            $url = $m[0];
            $key = $urlToKey[$url] ?? null;
            if (!$key) {
                return $url;
            }
            $file = $files->get($key);
            return $file ? '/api/v1/files/' . $file->id . '/content' : $url;
        }, $content) ?? $content;
    }

    private function fetchEtagFromS3(string $storageKey): ?string
    {
        try {
            $client = Storage::disk('s3')->getClient();
            $bucket = config('filesystems.disks.s3.bucket');

            $result = $client->headObject([
                'Bucket' => $bucket,
                'Key'    => $storageKey,
            ]);

            return $result['ETag'] ?? null;
        } catch (\Throwable) {
            return null;
        }
    }
}
