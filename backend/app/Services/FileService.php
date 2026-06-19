<?php

namespace App\Services;

use App\Enums\AccessType;
use App\Enums\ActivityType;
use App\Enums\FileStatus;
use App\Jobs\CleanOrphanedS3ObjectJob;
use App\Models\File;
use App\Models\FileUserAccess;
use App\Models\FileVersion;
use App\Models\SharedFolder;
use App\Models\SharedFolderAccess;
use App\Models\SharedFolderFile;
use App\Models\Tag;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class FileService
{
    public function __construct(
        private readonly ActivityService  $activityService,
        private readonly S3UrlService     $s3,
        private readonly MimeService      $mime,
        private readonly FileCardBuilder  $cardBuilder,
    ) {}

    /**
     * Return true if user has quota to upload a file of given size.
     */
    public function checkStorageQuota(User $user, int $fileSize): bool
    {
        $filesSize = (int) File::where('owner_id', $user->id)
            ->where('status', FileStatus::Available)
            ->sum('size');

        $versionsSize = (int) FileVersion::whereHas('file', fn($q) =>
            $q->where('owner_id', $user->id)->where('status', FileStatus::Available)
        )->sum('size');

        $used = $filesSize + $versionsSize;
        return ($used + $fileSize) <= $user->getPlan()->storageLimitBytes();
    }

    /**
     * Step 1 of upload flow.
     * Create file record in 'uploading' status and return S3 presigned PUT URL.
     */
    public function initUpload(User $user, array $data): array
    {
        return DB::transaction(function () use ($user, $data) {
            $ulid       = Str::ulid();
            $storageKey = 'files/' . $user->id . '/' . $ulid . '/' . $data['original_name'];

            $file = File::create([
                'owner_id'      => $user->id,
                'original_name' => $data['original_name'],
                'storage_key'   => $storageKey,
                'size'          => $data['size'],
                'mime_type'     => $data['mime_type'],
                'checksum'      => $data['checksum'] ?? null,
                'status'        => FileStatus::Uploading,
                'expires_at'    => null,
            ]);

            $presignedUrl = $this->generatePresignedPutUrl($storageKey, $data['mime_type']);

            $result = [
                'file'   => [
                    'id'     => $file->id,
                    'status' => $file->status->value,
                ],
                'upload' => [
                    'method'  => 'PUT',
                    'url'     => $presignedUrl,
                    'headers' => ['Content-Type' => $data['mime_type']],
                ],
            ];

            // Optional video thumbnail presigned URL
            if (!empty($data['thumbnail_name']) && !empty($data['thumbnail_mime'])) {
                $thumbKey = 'files/' . $user->id . '/' . $ulid . '/thumb_' . $data['thumbnail_name'];
                $result['thumbnail'] = [
                    'key'    => $thumbKey,
                    'method' => 'PUT',
                    'url'    => $this->generatePresignedPutUrl($thumbKey, $data['thumbnail_mime']),
                    'headers' => ['Content-Type' => $data['thumbnail_mime']],
                ];
            }

            return $result;
        });
    }

    /**
     * Step 3 of upload flow.
     * Mark file as available, create owner access record, log activity.
     */
    public function completeUpload(File $file, User $user, ?string $thumbnailKey = null): array
    {
        return DB::transaction(function () use ($file, $user, $thumbnailKey) {
            $update = ['status' => FileStatus::Available];
            if ($thumbnailKey) {
                $update['thumbnail_key'] = $thumbnailKey;
            }

            // Optimistic lock: only transition from Uploading → Available once
            $affected = File::where('id', $file->id)
                ->where('status', FileStatus::Uploading)
                ->update($update);

            if (!$affected) {
                return [
                    'file' => [
                        'id'     => $file->id,
                        'status' => $file->fresh()->status->value,
                    ],
                ];
            }

            FileUserAccess::firstOrCreate([
                'file_id'     => $file->id,
                'user_id'     => $user->id,
                'access_type' => AccessType::Owner,
            ]);

            $this->activityService->log($file, $user, ActivityType::Uploaded);

            // Queue PDF thumbnail generation for mobile uploads (no thumbnail provided)
            if (!$thumbnailKey && str_contains($file->mime_type ?? '', 'pdf')) {
                \App\Jobs\GeneratePdfPreview::dispatch($file->id)->onQueue('default');
            }

            return [
                'file' => [
                    'id'     => $file->id,
                    'status' => FileStatus::Available->value,
                ],
            ];
        });
    }

    /**
     * Cancel an upload in progress.
     */
    public function cancelUpload(File $file): void
    {
        if ($file->status !== FileStatus::Uploading) {
            return;
        }

        $file->update(['status' => FileStatus::Deleted]);

        if ($file->storage_key) {
            CleanOrphanedS3ObjectJob::dispatch(
                array_filter([$file->storage_key, $file->thumbnail_key])
            )->delay(now()->addMinutes(5));
        }
    }

    /**
     * Check if a user has any access to a file.
     */
    public function canAccess(User $user, File $file): bool
    {
        if ($file->isOwnedBy($user)) {
            return true;
        }

        if (FileUserAccess::where('file_id', $file->id)->where('user_id', $user->id)->exists()) {
            return true;
        }

        // Access via shared folder membership — respects inherited access from parent folders
        $sharedFolderIds = SharedFolderFile::where('file_id', $file->id)
            ->pluck('shared_folder_id');

        if ($sharedFolderIds->isEmpty()) {
            return false;
        }

        $folders = SharedFolder::with(['parent.parent.parent.parent'])
            ->whereIn('id', $sharedFolderIds)
            ->get();

        $ancestorIds = [];
        foreach ($folders as $folder) {
            $current = $folder;
            $visited  = [];
            while ($current) {
                if (isset($visited[$current->id])) break;
                $visited[$current->id] = true;
                if ($current->owner_id === $user->id) return true;
                $ancestorIds[] = $current->id;
                $current = $current->parent;
            }
        }

        return !empty($ancestorIds) && SharedFolderAccess::where('user_id', $user->id)
            ->whereIn('shared_folder_id', $ancestorIds)
            ->exists();
    }

    /**
     * Logical delete of file by owner.
     */
    public function deleteFile(File $file, User $user): void
    {
        // Collect all S3 keys before soft-delete so they're still accessible
        $s3Keys = array_filter([$file->storage_key, $file->thumbnail_key]);

        if ($file->has_versions) {
            $versionKeys = $file->versions()
                ->whereIn('status', [FileStatus::Available->value, FileStatus::Uploading->value])
                ->get(['storage_key', 'thumbnail_key'])
                ->flatMap(fn ($v) => array_filter([$v->storage_key, $v->thumbnail_key]))
                ->toArray();
            $s3Keys = array_merge($s3Keys, $versionKeys);
        }

        DB::transaction(function () use ($file, $user) {
            $file->update(['status' => FileStatus::Deleted]);
            $file->delete(); // soft delete
            $this->activityService->log($file, $user, ActivityType::Deleted);
        });

        if (!empty($s3Keys)) {
            CleanOrphanedS3ObjectJob::dispatch(array_unique($s3Keys))->delay(now()->addMinutes(5));
        }
    }

    /**
     * Whether a file is a simple text format that can be shown read-only in-app.
     * Markdown is excluded — it has its own editor.
     */
    public function isPlainTextViewable(File $file): bool
    {
        $mime = strtolower($file->mime_type ?? '');
        if ($mime === 'text/markdown') {
            return false;
        }
        if (str_starts_with($mime, 'text/')) {
            return true;
        }
        $textMimes = [
            'application/json', 'application/xml', 'application/x-yaml', 'application/yaml',
            'application/x-sh', 'application/javascript', 'application/x-ndjson',
        ];
        if (in_array($mime, $textMimes, true)) {
            return true;
        }
        $ext = strtolower(pathinfo($file->original_name ?? '', PATHINFO_EXTENSION));
        return in_array($ext, [
            'txt', 'log', 'csv', 'tsv', 'json', 'xml', 'yml', 'yaml',
            'ini', 'conf', 'cfg', 'env', 'properties', 'sh', 'bash',
        ], true);
    }

    /**
     * Validate that a file size fits within the plan's per-file limit.
     * Returns null if OK, or ['code' => ..., 'data' => [...]] if exceeded.
     */
    public function validateFileSizeLimit(User $user, int $fileSize): ?array
    {
        $limit = $user->getPlan()->fileSizeLimitBytes();
        if ($fileSize > $limit) {
            return ['code' => 'FILE_SIZE_LIMIT_EXCEEDED', 'data' => ['limit_bytes' => $limit]];
        }
        return null;
    }

    /**
     * Validate that there is enough storage quota for a new file of given size.
     * Returns null if OK, or ['code' => 'STORAGE_LIMIT_EXCEEDED', 'data' => []] if exceeded.
     */
    public function validateStorageQuota(User $user, int $fileSize): ?array
    {
        if (!$this->checkStorageQuota($user, $fileSize)) {
            return ['code' => 'STORAGE_LIMIT_EXCEEDED', 'data' => []];
        }
        return null;
    }

    /**
     * Generate a signed S3 download URL after access check.
     */
    public function generateDownloadUrl(File $file): ?string
    {
        return $this->s3->generateDownloadUrl($file);
    }

    /**
     * Pin (logically save) a file for current user.
     */
    public function pin(File $file, User $user): void
    {
        DB::transaction(function () use ($file, $user) {
            $access = FileUserAccess::firstOrCreate(
                ['file_id' => $file->id, 'user_id' => $user->id],
                ['access_type' => AccessType::Saved, 'saved_at' => now(), 'pinned_at' => now()]
            );

            if (!$access->wasRecentlyCreated) {
                if ($access->access_type === AccessType::Shared) {
                    $access->update([
                        'access_type' => AccessType::Saved,
                        'saved_at'    => now(),
                        'pinned_at'   => now(),
                    ]);
                    $this->activityService->log($file, $user, ActivityType::SavedByRecipient);
                } else {
                    $access->update(['pinned_at' => now()]);
                }
            }

            $this->activityService->log($file, $user, ActivityType::Pinned);
        });
    }

    /**
     * Unpin a file.
     */
    public function unpin(File $file, User $user): void
    {
        DB::transaction(function () use ($file, $user) {
            $access = FileUserAccess::where('file_id', $file->id)
                ->where('user_id', $user->id)
                ->first();

            if ($access) {
                $access->update(['pinned_at' => null]);
            }

            $this->activityService->log($file, $user, ActivityType::Unpinned);
        });
    }

    /**
     * Toggle favorite status.
     */
    public function setFavorite(File $file, User $user, bool $isFavorite): void
    {
        $access = FileUserAccess::firstOrCreate(
            ['file_id' => $file->id, 'user_id' => $user->id],
            ['access_type' => AccessType::Saved, 'saved_at' => now()]
        );

        $access->update(['is_favorite' => $isFavorite]);

        $type = $isFavorite ? ActivityType::Favorited : ActivityType::Unfavorited;
        $this->activityService->log($file, $user, $type);
    }

    /**
     * Sync tags for a file (per-user: stored with user_id in file_tags).
     */
    public function setTags(File $file, User $user, array $tagIds): void
    {
        $tagIds = Tag::where('user_id', $user->id)
            ->whereIn('id', $tagIds)
            ->pluck('id')
            ->toArray();

        DB::transaction(function () use ($file, $user, $tagIds) {
            DB::table('file_tags')
                ->where('file_id', $file->id)
                ->where('user_id', $user->id)
                ->whereNotIn('tag_id', $tagIds)
                ->delete();

            $existing = DB::table('file_tags')
                ->where('file_id', $file->id)
                ->where('user_id', $user->id)
                ->pluck('tag_id')
                ->toArray();

            $toInsert = array_map(fn ($tagId) => [
                'file_id' => $file->id,
                'tag_id'  => $tagId,
                'user_id' => $user->id,
            ], array_diff($tagIds, $existing));

            if (!empty($toInsert)) {
                DB::table('file_tags')->insert($toInsert);
            }
        });

        $this->activityService->log($file, $user, ActivityType::TagUpdated, [
            'tag_ids' => $tagIds,
        ]);
    }

    /**
     * Create a url_file object from a URL with preview metadata.
     */
    public function createUrlFile(User $user, string $url, array $preview): array
    {
        $scheme = parse_url($url, PHP_URL_SCHEME);
        if (!in_array($scheme, ['http', 'https'], true)) {
            throw new \InvalidArgumentException('URL scheme must be http or https');
        }

        return DB::transaction(function () use ($user, $url, $preview) {
            $hostname = $preview['hostname'] ?? parse_url($url, PHP_URL_HOST) ?? $url;
            $rawTitle = strip_tags($preview['title'] ?? $hostname ?? '');
            // Remove characters invalid in filenames (including markdown **, iOS-problematic chars)
            $title = preg_replace('/[\/\\\\\?%\*:|"<>\[\]\{\}#\^~]/', '', $rawTitle);
            $title = trim((string) preg_replace('/\s+/', ' ', $title));
            $title = mb_substr($title ?: $hostname, 0, 200);

            $file = File::create([
                'owner_id'        => $user->id,
                'original_name'   => $title . '.url',
                'storage_key'     => null,
                'size'            => 0,
                'mime_type'       => 'application/internet-shortcut',
                'status'          => FileStatus::Available,
                'content_kind'    => 'url_file',
                'link_url'        => $url,
                'link_title'      => $preview['title'] ? strip_tags(mb_substr($preview['title'], 0, 500)) : null,
                'link_description'=> $preview['description'] ? strip_tags(mb_substr($preview['description'], 0, 1000)) : null,
                'link_image_url'  => $preview['image_url'] ?? null,
                'link_site_name'  => strip_tags(mb_substr($preview['site_name'] ?? $hostname, 0, 255)),
                'link_fetched_at' => now(),
            ]);

            FileUserAccess::create([
                'file_id'     => $file->id,
                'user_id'     => $user->id,
                'access_type' => AccessType::Owner,
            ]);

            // Auto-fetch og: metadata if the frontend didn't provide a title/image
            if (empty($preview['title']) || empty($preview['image_url'])) {
                try {
                    $ogData = app(OgFetchService::class)->fetch($url);
                    $updates = [];
                    if (!empty($ogData['link_title']) && empty($preview['title'])) {
                        $updates['link_title'] = mb_substr($ogData['link_title'], 0, 500);
                    }
                    if (!empty($ogData['link_description']) && empty($preview['description'])) {
                        $updates['link_description'] = mb_substr($ogData['link_description'], 0, 1000);
                    }
                    if (!empty($ogData['link_image_url'])) {
                        $updates['link_image_url'] = $ogData['link_image_url'];
                    }
                    if (!empty($ogData['link_site_name'])) {
                        $updates['link_site_name'] = mb_substr($ogData['link_site_name'], 0, 255);
                    }
                    if (!empty($updates)) {
                        $file->update($updates);
                    }
                } catch (\Throwable) {}
            }

            $this->activityService->log($file, $user, ActivityType::Uploaded);

            return ['file' => $this->buildFileCard($file->fresh()->load(['owner', 'tags']), $user)];
        });
    }

    /**
     * Generate .url file content for download.
     */
    public function buildUrlFileContent(File $file): string
    {
        return "[InternetShortcut]\r\nURL=" . $file->link_url . "\r\n";
    }

    /**
     * Build full file card data.
     */
    public function buildFileCard(File $file, User $user): array
    {
        return $this->cardBuilder->buildCard($file, $user);
    }

    public function resolvePreviewAndViewUrls(File $file, string $mime): array
    {
        return $this->s3->resolvePreviewAndViewUrls($file, $mime);
    }

    /**
     * List files for a user based on filter with tag/folder/content_kind filters.
     */
    public function listFiles(User $user, string $filter, ?string $search, int $page, int $perPage, array $options = []): array
    {
        $query = File::query()->whereNull('deleted_at')->where('status', FileStatus::Available);

        if ($filter === 'mine') {
            $query->where('owner_id', $user->id);
            if (!array_key_exists('folder_id', $options)) {
                $query->whereNull('folder_id');
            }
        } elseif ($filter === 'received') {
            $query->whereHas('accesses', fn ($q) =>
                $q->where('user_id', $user->id)->whereIn('access_type', [AccessType::Shared->value, AccessType::Saved->value])
            );
        } elseif ($filter === 'favorites') {
            $query->whereHas('accesses', fn ($q) =>
                $q->where('user_id', $user->id)->where('is_favorite', true)
            );
        } elseif ($filter === 'all') {
            $query->where(function ($q) use ($user) {
                $q->where('owner_id', $user->id)
                  ->orWhereHas('accesses', fn ($q2) =>
                      $q2->where('user_id', $user->id)->whereIn('access_type', [AccessType::Shared->value, AccessType::Saved->value])
                  );
            });
        } else {
            $query->where('owner_id', $user->id);
        }

        if ($search) {
            $query->where(fn ($q) =>
                $q->where('original_name', 'like', "%{$search}%")
                  ->orWhere('display_name', 'like', "%{$search}%")
            );
        }

        if (!empty($options['tag_id'])) {
            $tagId  = $options['tag_id'];
            $userId = $user->id;
            $query->whereExists(function ($q) use ($tagId, $userId) {
                $q->from('file_tags')
                  ->whereColumn('file_tags.file_id', 'files.id')
                  ->where('file_tags.user_id', $userId)
                  ->where('file_tags.tag_id', $tagId);
            });
        }

        if (array_key_exists('folder_id', $options)) {
            $query->where('folder_id', $options['folder_id']);
        }

        if (!empty($options['content_kind'])) {
            $query->where('content_kind', $options['content_kind']);
        }

        if (isset($options['is_task'])) {
            $query->where('is_task', (bool) $options['is_task']);
        }

        if (!empty($options['task_status'])) {
            $query->where('task_status', $options['task_status']);
        }

        if (!empty($options['task_assigned_user_id'])) {
            $query->where('task_assigned_user_id', $options['task_assigned_user_id']);
        }

        $dateFrom = !empty($options['task_date_from']) ? $options['task_date_from'] : null;
        $dateTo   = !empty($options['task_date_to'])   ? $options['task_date_to']   : null;

        if ($dateFrom !== null || $dateTo !== null) {
            // Task must have at least one date to participate in range filtering
            $query->where(fn ($q) => $q->whereNotNull('task_start_date')->orWhereNotNull('task_due_date'));

            // task range [start, due] overlaps filter range [from, to]:
            //   start <= to  (task starts before filter ends)
            if ($dateTo !== null) {
                $query->where(fn ($q) => $q->whereNull('task_start_date')->orWhere('task_start_date', '<=', $dateTo));
            }
            //   due >= from  (task ends after filter starts)
            if ($dateFrom !== null) {
                $query->where(fn ($q) => $q->whereNull('task_due_date')->orWhere('task_due_date', '>=', $dateFrom));
            }
        }

        $availableTypeGroups = $this->computeAvailableTypeGroups(clone $query);

        if (!empty($options['file_type_group'])) {
            $this->applyTypeGroupFilter($query, $options['file_type_group']);
        }

        // Pinned files first — LEFT JOIN keeps non-pinned rows; select('files.*') avoids column ambiguity
        $query->select('files.*')
              ->leftJoin('file_user_access as pin_access', function ($join) use ($user) {
                  $join->on('pin_access.file_id', '=', 'files.id')
                       ->where('pin_access.user_id', '=', $user->id);
              })
              ->orderByRaw('pin_access.pinned_at IS NULL ASC')
              ->orderByRaw('pin_access.pinned_at DESC');

        $sortBy    = $options['sort_by'] ?? 'date';
        $sortOrder = strtolower($options['sort_order'] ?? 'desc');
        if (!in_array($sortOrder, ['asc', 'desc'])) {
            $sortOrder = 'desc';
        }
        $sortDir = strtoupper($sortOrder);

        if ($sortBy === 'size') {
            $query->orderBy('files.size', $sortOrder);
        } elseif ($sortBy === 'extension') {
            $query->orderByRaw("SUBSTRING_INDEX(files.original_name, '.', -1) {$sortDir}");
        } else {
            $query->orderBy('files.created_at', $sortOrder);
        }

        $total = $query->count();
        $items = $query->with(['accesses' => fn ($q) => $q->where('user_id', $user->id)])
                       ->offset(($page - 1) * $perPage)->limit($perPage)->get();

        // Batch-load unread comment counts for the current user
        $fileIds = $items->pluck('id')->all();
        if (!empty($fileIds)) {
            $unreadMap = DB::table('comment_reads')
                ->join('comment_threads', 'comment_threads.id', '=', 'comment_reads.thread_id')
                ->where('comment_reads.user_id', $user->id)
                ->where('comment_threads.target_type', 'file')
                ->whereIn('comment_threads.target_id', $fileIds)
                ->select('comment_threads.target_id', DB::raw('SUM(comment_reads.unread_count_cache) as unread'))
                ->groupBy('comment_threads.target_id')
                ->pluck('unread', 'target_id')
                ->all();
            foreach ($items as $f) {
                $f->setAttribute('unread_comments_cached', (int) ($unreadMap[$f->id] ?? 0));
            }
        }

        return [
            'items'      => $items->map(fn ($f) => $this->buildListItem($f, $user)),
            'pagination' => [
                'page'                  => $page,
                'per_page'              => $perPage,
                'total'                 => $total,
                'available_type_groups' => $availableTypeGroups,
            ],
        ];
    }

    private function applyTypeGroupFilter($query, string $group): void
    {
        $this->mime->buildSqlTypeGroupFilter($query, $group);
    }

    private function computeAvailableTypeGroups($query): array
    {
        $rows = $query->select(['mime_type', 'content_kind'])->distinct()->get();
        $groups = [];
        foreach ($rows as $row) {
            $g = $this->mime->classify($row->content_kind ?? 'binary_file', $row->mime_type ?? '');
            $groups[$g] = true;
        }
        return array_keys($groups);
    }

    private function buildListItem(File $f, ?User $user = null): array
    {
        return $this->cardBuilder->buildListItem($f, $user);
    }

    /**
     * Build a list of available versions for a file.
     */
    public function buildVersionsList(File $file): array
    {
        return $this->cardBuilder->buildVersionsList($file);
    }

    public function buildVersionItem(FileVersion $version): array
    {
        return $this->cardBuilder->buildVersionItem($version);
    }

    /**
     * Generate a presigned S3 PUT URL for direct upload.
     */
    public function generatePresignedPutUrl(string $key, string $mimeType): string
    {
        return $this->s3->generatePresignedPutUrl($key, $mimeType);
    }
}
