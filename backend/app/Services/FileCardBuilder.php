<?php

namespace App\Services;

use App\Enums\FileStatus;
use App\Models\File;
use App\Models\FileUserAccess;
use App\Models\FileVersion;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class FileCardBuilder
{
    public function __construct(
        private readonly S3UrlService $s3
    ) {}

    /**
     * Build the full file card returned by GET /files/{id}.
     */
    public function buildCard(File $file, User $user): array
    {
        $access = $file->relationLoaded('accesses')
            ? $file->accesses->firstWhere('user_id', $user->id)
            : FileUserAccess::where('file_id', $file->id)->where('user_id', $user->id)->first();

        $base = [
            'id'                 => $file->id,
            'content_kind'       => $file->content_kind ?? 'binary_file',
            'original_name'      => $file->original_name,
            'display_name'       => $file->display_name,
            'has_versions'       => (bool) $file->has_versions,
            'size'               => $file->size,
            'mime_type'          => $file->mime_type,
            'status'             => $file->status->value,
            'uploaded_at'        => $file->created_at?->toIso8601String(),
            'expires_at'         => $file->expires_at?->toIso8601String(),
            'is_owner'           => $file->isOwnedBy($user),
            'access_type'        => $access?->access_type?->value,
            'is_favorite'        => $access?->is_favorite ?? false,
            'is_pinned'          => $access?->pinned_at !== null,
            'description'        => $access?->description,
            'folder_id'          => $access?->folder_id,
            'shared_folder_only' => (bool) $file->shared_folder_only,
            'tags'               => $file->tags()
                ->wherePivot('user_id', $user->id)
                ->get(['tags.id', 'tags.name'])
                ->map(fn($t) => ['id' => $t->id, 'name' => $t->name])
                ->values(),
            'owner'              => [
                'id'    => $file->owner->id,
                'email' => $file->owner->email,
                'name'  => $file->owner->name,
            ],
            'versions'           => $file->has_versions ? $this->buildVersionsList($file) : [],
        ];

        if ($file->isUrlFile()) {
            $base['link_url']         = $file->link_url;
            $base['link_title']       = $file->link_title;
            $base['link_description'] = $file->link_description;
            $base['link_image_url']   = $file->link_image_url;
            $base['link_site_name']   = $file->link_site_name;
            $base['preview_url']      = null;
            $base['view_url']         = null;
        } elseif ($file->storage_key && $file->isAvailable()) {
            [$previewUrl, $viewUrl] = $this->s3->resolvePreviewAndViewUrls($file, $file->mime_type ?? '');
            $base['preview_url'] = $previewUrl;
            $base['view_url']    = $viewUrl;
        } else {
            $base['preview_url'] = null;
            $base['view_url']    = null;
        }

        return $base;
    }

    /**
     * Build a compact list item returned by GET /files (list endpoint).
     * Includes is_owner, access_type, is_favorite so the frontend does not need
     * to open the full card to render access state and star icon.
     */
    public function buildListItem(File $file, ?User $user = null, ?int $addedBy = null): array
    {
        $access = $user
            ? ($file->relationLoaded('accesses')
                ? $file->accesses->firstWhere('user_id', $user->id)
                : FileUserAccess::where('file_id', $file->id)->where('user_id', $user->id)->first())
            : null;

        $inSharedFolderContext = $addedBy !== null;

        $item = [
            'id'            => $file->id,
            'content_kind'  => $file->content_kind ?? 'binary_file',
            'original_name' => $file->original_name,
            'display_name'  => $file->display_name,
            'has_versions'  => (bool) $file->has_versions,
            'size'          => $file->size,
            'mime_type'     => $file->mime_type,
            'status'        => $file->status->value,
            'expires_at'    => $file->expires_at?->toIso8601String(),
            'uploaded_at'   => $file->created_at?->toIso8601String(),
            'is_owner'      => $user ? $file->isOwnedBy($user) : null,
            'access_type'   => $access?->access_type?->value,
            'is_favorite'   => $access?->is_favorite ?? false,
            'description'   => $access?->description,
            'preview_url'   => null,
        ];

        if ($inSharedFolderContext) {
            $item['added_by']           = $addedBy;
            $item['shared_folder_only'] = (bool) $file->shared_folder_only;
            $item['view_url']           = null;
        }

        if ($file->content_kind === 'url_file') {
            $item['link_url']       = $file->link_url;
            $item['link_title']     = $file->link_title;
            $item['link_image_url'] = $file->link_image_url;
            $item['link_site_name'] = $file->link_site_name;
        } elseif ($file->storage_key && $file->isAvailable()) {
            if ($inSharedFolderContext) {
                [$previewUrl, $viewUrl] = $this->s3->resolvePreviewAndViewUrls($file, $file->mime_type ?? '');
                $item['preview_url'] = $previewUrl;
                $item['view_url']    = $viewUrl;
            } else {
                $item['preview_url'] = $this->s3->resolveListPreviewUrl($file);
            }
        }

        return $item;
    }

    /**
     * Build a minimal public file item returned via share link.
     */
    public function buildPublicItem(File $file): array
    {
        [$previewUrl, $viewUrl] = $file->storage_key && $file->isAvailable()
            ? $this->s3->resolvePreviewAndViewUrls($file, $file->mime_type ?? '')
            : [null, null];

        $item = [
            'id'            => $file->id,
            'content_kind'  => $file->content_kind ?? 'binary_file',
            'original_name' => $file->original_name,
            'size'          => $file->size,
            'mime_type'     => $file->mime_type,
            'status'        => $file->status->value,
            'expires_at'    => $file->expires_at?->toIso8601String(),
            'uploaded_at'   => $file->created_at?->toIso8601String(),
            'preview_url'   => $previewUrl,
            'view_url'      => $viewUrl,
        ];

        if ($file->isUrlFile()) {
            $item['link_url']         = $file->link_url;
            $item['link_title']       = $file->link_title;
            $item['link_description'] = $file->link_description;
            $item['link_image_url']   = $file->link_image_url;
            $item['link_site_name']   = $file->link_site_name;
        }

        return $item;
    }

    /**
     * Build the version list for a file.
     */
    public function buildVersionsList(File $file): array
    {
        return FileVersion::where('file_id', $file->id)
            ->where('status', FileStatus::Available->value)
            ->orderBy('version_number')
            ->get()
            ->map(fn($v) => $this->buildVersionItem($v))
            ->values()
            ->toArray();
    }

    /**
     * Build a single version item.
     */
    public function buildVersionItem(FileVersion $version): array
    {
        return [
            'id'             => $version->id,
            'version_number' => $version->version_number,
            'version_label'  => $version->version_label,
            'comment'        => $version->comment,
            'original_name'  => $version->original_name,
            'size'           => $version->size,
            'mime_type'      => $version->mime_type,
            'is_active'      => $version->is_active,
            'preview_url'    => $this->s3->resolveVersionPreviewUrl($version),
            'created_at'     => $version->created_at?->toIso8601String(),
        ];
    }
}
