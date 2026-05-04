<?php

namespace App\Services;

use App\Enums\AccessType;
use App\Enums\ActivityType;
use App\Enums\FileStatus;
use App\Models\File;
use App\Models\FileUserAccess;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class FileService
{
    public function __construct(
        private readonly ActivityService $activityService
    ) {}

    /**
     * Step 1 of upload flow.
     * Create file record in 'uploading' status and return S3 presigned PUT URL.
     */
    public function initUpload(User $user, array $data): array
    {
        return DB::transaction(function () use ($user, $data) {
            $storageKey = 'files/' . $user->id . '/' . Str::ulid() . '/' . $data['original_name'];

            $file = File::create([
                'owner_id'      => $user->id,
                'original_name' => $data['original_name'],
                'storage_key'   => $storageKey,
                'size'          => $data['size'],
                'mime_type'     => $data['mime_type'],
                'checksum'      => $data['checksum'] ?? null,
                'status'        => FileStatus::Uploading,
                'expires_at'    => now()->addHours(config('app.file_default_ttl_hours', 12)),
            ]);

            // Generate S3 presigned upload URL
            $presignedUrl = $this->generatePresignedPutUrl($storageKey, $data['mime_type']);

            return [
                'file'   => [
                    'id'     => $file->id,
                    'status' => $file->status->value,
                ],
                'upload' => [
                    'method'  => 'PUT',
                    'url'     => $presignedUrl,
                    'headers' => [
                        'Content-Type' => $data['mime_type'],
                    ],
                ],
            ];
        });
    }

    /**
     * Step 3 of upload flow.
     * Mark file as available, create owner access record, log activity.
     */
    public function completeUpload(File $file, User $user): array
    {
        return DB::transaction(function () use ($file, $user) {
            $file->update(['status' => FileStatus::Available]);

            // Create owner access record
            FileUserAccess::firstOrCreate([
                'file_id'     => $file->id,
                'user_id'     => $user->id,
                'access_type' => AccessType::Owner,
            ]);

            // Log activity
            $this->activityService->log($file, $user, ActivityType::Uploaded);

            return [
                'file' => [
                    'id'     => $file->id,
                    'status' => $file->fresh()->status->value,
                ],
            ];
        });
    }

    /**
     * Cancel an upload in progress.
     */
    public function cancelUpload(File $file): void
    {
        $file->update(['status' => FileStatus::Deleted]);
        // Optionally: dispatch job to clean S3 object
    }

    /**
     * Check if a user has any access to a file.
     */
    public function canAccess(User $user, File $file): bool
    {
        if ($file->isOwnedBy($user)) {
            return true;
        }

        return FileUserAccess::where('file_id', $file->id)
            ->where('user_id', $user->id)
            ->exists();
    }

    /**
     * Logical delete of file by owner.
     */
    public function deleteFile(File $file, User $user): void
    {
        DB::transaction(function () use ($file, $user) {
            $file->update(['status' => FileStatus::Deleted]);
            $file->delete(); // soft delete
            $this->activityService->log($file, $user, ActivityType::Deleted);
        });
    }

    /**
     * Generate a signed S3 download URL after access check.
     */
    public function generateDownloadUrl(File $file): string
    {
        $ttl = config('filesystems.disks.s3.presigned_url_ttl', 3600);

        // Using Laravel's Storage facade with S3 driver
        return Storage::disk('s3')->temporaryUrl(
            $file->storage_key,
            now()->addSeconds($ttl),
            ['ResponseContentDisposition' => 'attachment; filename="' . $file->original_name . '"']
        );
    }

    /**
     * Pin (logically save) a file for current user.
     */
    public function pin(File $file, User $user): void
    {
        DB::transaction(function () use ($file, $user) {
            $access = FileUserAccess::where('file_id', $file->id)
                ->where('user_id', $user->id)
                ->first();

            if ($access) {
                // If recipient pins = they "save" the file forever
                if ($access->access_type === AccessType::Shared) {
                    $access->update([
                        'access_type' => AccessType::Saved,
                        'saved_at'    => now(),
                    ]);
                    $access->update(['pinned_at' => now()]);
                    // Notify owner
                    $this->activityService->log($file, $user, ActivityType::SavedByRecipient);
                } else {
                    $access->update(['pinned_at' => now()]);
                }
            } else {
                // Owner or someone with direct access
                FileUserAccess::create([
                    'file_id'     => $file->id,
                    'user_id'     => $user->id,
                    'access_type' => AccessType::Saved,
                    'pinned_at'   => now(),
                    'saved_at'    => now(),
                ]);
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
                ->whereNot('access_type', AccessType::Owner)
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
        $access = FileUserAccess::where('file_id', $file->id)
            ->where('user_id', $user->id)
            ->first();

        if ($access) {
            $access->update(['is_favorite' => $isFavorite]);
        }

        $type = $isFavorite ? ActivityType::Favorited : ActivityType::Unfavorited;
        $this->activityService->log($file, $user, $type);
    }

    /**
     * Move file to a folder.
     */
    public function moveToFolder(File $file, User $user, ?string $folderId): void
    {
        $file->update(['folder_id' => $folderId]);
        $this->activityService->log($file, $user, ActivityType::MovedToFolder, [
            'folder_id' => $folderId,
        ]);
    }

    /**
     * Sync tags for a file.
     */
    public function setTags(File $file, User $user, array $tagIds): void
    {
        $file->tags()->sync($tagIds);
        $this->activityService->log($file, $user, ActivityType::TagUpdated, [
            'tag_ids' => $tagIds,
        ]);
    }

    /**
     * Create a url_file object from a URL with preview metadata.
     */
    public function createUrlFile(User $user, string $url, array $preview): array
    {
        return DB::transaction(function () use ($user, $url, $preview) {
            $hostname = $preview['hostname'] ?? parse_url($url, PHP_URL_HOST) ?? $url;
            $title    = $preview['title'] ?? $hostname;

            $file = File::create([
                'owner_id'        => $user->id,
                'original_name'   => mb_substr($title, 0, 255) . '.url',
                'storage_key'     => null,
                'size'            => 0,
                'mime_type'       => 'application/internet-shortcut',
                'status'          => FileStatus::Available,
                'content_kind'    => 'url_file',
                'link_url'        => $url,
                'link_title'      => $preview['title'] ?? null,
                'link_description'=> $preview['description'] ?? null,
                'link_image_url'  => $preview['image_url'] ?? null,
                'link_site_name'  => $preview['site_name'] ?? $hostname,
                'link_fetched_at' => now(),
            ]);

            FileUserAccess::create([
                'file_id'     => $file->id,
                'user_id'     => $user->id,
                'access_type' => AccessType::Owner,
            ]);

            $this->activityService->log($file, $user, ActivityType::Uploaded);

            return ['file' => $this->buildFileCard($file->load(['owner', 'tags']), $user)];
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
        $access = FileUserAccess::where('file_id', $file->id)
            ->where('user_id', $user->id)
            ->first();

        $base = [
            'id'            => $file->id,
            'content_kind'  => $file->content_kind ?? 'binary_file',
            'original_name' => $file->original_name,
            'size'          => $file->size,
            'mime_type'     => $file->mime_type,
            'status'        => $file->status->value,
            'uploaded_at'   => $file->created_at?->toIso8601String(),
            'expires_at'    => $file->expires_at?->toIso8601String(),
            'is_owner'      => $file->isOwnedBy($user),
            'access_type'   => $access?->access_type?->value,
            'is_favorite'   => $access?->is_favorite ?? false,
            'is_pinned'     => $access?->pinned_at !== null,
            'folder_id'     => $file->folder_id,
            'tags'          => $file->tags->map(fn ($t) => ['id' => $t->id, 'name' => $t->name]),
            'owner'         => [
                'id'    => $file->owner->id,
                'email' => $file->owner->email,
                'name'  => $file->owner->name,
            ],
        ];

        if ($file->isUrlFile()) {
            $base['link_url']         = $file->link_url;
            $base['link_title']       = $file->link_title;
            $base['link_description'] = $file->link_description;
            $base['link_image_url']   = $file->link_image_url;
            $base['link_site_name']   = $file->link_site_name;
            $base['preview_url']      = null;
        } elseif ($file->storage_key && str_starts_with($file->mime_type ?? '', 'image/') && $file->isAvailable()) {
            try {
                $base['preview_url'] = Storage::disk('s3')->temporaryUrl(
                    $file->storage_key,
                    now()->addMinutes(60)
                );
            } catch (\Throwable) {
                $base['preview_url'] = null;
            }
        } else {
            $base['preview_url'] = null;
        }

        return $base;
    }

    /**
     * List files for a user based on filter with tag/folder/content_kind filters.
     */
    public function listFiles(User $user, string $filter, ?string $search, int $page, int $perPage, array $options = []): array
    {
        $query = File::query()->whereNull('deleted_at');

        match ($filter) {
            'mine'      => $query->where('owner_id', $user->id),
            'received'  => $query->whereHas('accesses', fn ($q) =>
                                $q->where('user_id', $user->id)
                                  ->whereIn('access_type', ['shared', 'saved'])
                           ),
            'favorites' => $query->whereHas('accesses', fn ($q) =>
                                $q->where('user_id', $user->id)->where('is_favorite', true)
                           ),
            default     => $query->where('owner_id', $user->id),
        };

        if ($search) {
            $query->where('original_name', 'like', "%{$search}%");
        }

        if (!empty($options['tag_id'])) {
            $query->whereHas('tags', fn ($q) => $q->where('tags.id', $options['tag_id']));
        }

        if (array_key_exists('folder_id', $options)) {
            if ($options['folder_id'] === null) {
                $query->whereNull('folder_id');
            } else {
                $query->where('folder_id', $options['folder_id']);
            }
        }

        if (!empty($options['content_kind'])) {
            $query->where('content_kind', $options['content_kind']);
        }

        $total = $query->count();
        $items = $query->orderByDesc('created_at')
                       ->offset(($page - 1) * $perPage)
                       ->limit($perPage)
                       ->get();

        return [
            'items'      => $items->map(fn ($f) => $this->buildListItem($f)),
            'pagination' => [
                'page'     => $page,
                'per_page' => $perPage,
                'total'    => $total,
            ],
        ];
    }

    private function buildListItem(File $f): array
    {
        $item = [
            'id'            => $f->id,
            'content_kind'  => $f->content_kind ?? 'binary_file',
            'original_name' => $f->original_name,
            'size'          => $f->size,
            'mime_type'     => $f->mime_type,
            'status'        => $f->status->value,
            'expires_at'    => $f->expires_at?->toIso8601String(),
            'uploaded_at'   => $f->created_at?->toIso8601String(),
            'preview_url'   => null,
        ];

        if ($f->content_kind === 'url_file') {
            $item['link_url']       = $f->link_url;
            $item['link_title']     = $f->link_title;
            $item['link_image_url'] = $f->link_image_url;
            $item['link_site_name'] = $f->link_site_name;
        } elseif ($f->storage_key && str_starts_with($f->mime_type ?? '', 'image/') && $f->isAvailable()) {
            try {
                $item['preview_url'] = Storage::disk('s3')->temporaryUrl(
                    $f->storage_key,
                    now()->addMinutes(60)
                );
            } catch (\Throwable) {
                $item['preview_url'] = null;
            }
        }

        return $item;
    }

    /**
     * Generate a presigned S3 PUT URL for direct upload.
     */
    private function generatePresignedPutUrl(string $key, string $mimeType): string
    {
        // Uses AWS SDK via Storage facade
        $client = Storage::disk('s3')->getClient();
        $bucket = config('filesystems.disks.s3.bucket');
        $ttl    = config('filesystems.disks.s3.presigned_url_ttl', 3600);

        $cmd = $client->getCommand('PutObject', [
            'Bucket'      => $bucket,
            'Key'         => $key,
            'ContentType' => $mimeType,
        ]);

        $request = $client->createPresignedRequest($cmd, '+' . $ttl . ' seconds');

        return (string) $request->getUri();
    }
}
