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

class DocumentService
{
    private const LOCK_TTL_MINUTES = 5;
    private const EDITOR_TYPE      = 'markdown';
    private const MIME_TYPE        = 'text/markdown';

    public function __construct(
        private readonly ActivityService $activityService
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
            while ($current) {
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

        $lockData = null;
        if ($lock && !$lock->isExpired()) {
            $lockData = [
                'isLocked'    => true,
                'lockedBy'    => $this->formatUser($lock->user),
                'expiresAt'   => $lock->expires_at->toIso8601String(),
                'canTakeOver' => $file->isOwnedBy($user),
            ];
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
        return [
            'id'         => $file->id,
            'fileName'   => $file->original_name,
            'mimeType'   => $file->mime_type,
            'size'       => $file->size,
            'width'      => $file->width,
            'height'     => $file->height,
            'previewUrl' => '/api/v1/files/' . $file->id . '/preview',
            'assetUrl'   => '/api/v1/files/' . $file->id . '/content',
            'updatedAt'  => $file->updated_at?->toIso8601String(),
        ];
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
