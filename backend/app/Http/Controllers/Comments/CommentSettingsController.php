<?php

namespace App\Http\Controllers\Comments;

use App\Http\Controllers\Controller;
use App\Models\File;
use App\Models\FileCommentSettings;
use App\Models\Folder;
use App\Models\LocalFolderCommentSettings;
use App\Models\SharedFolder;
use App\Models\SharedFolderAccess;
use App\Models\SharedFolderCommentSettings;
use App\Services\CommentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CommentSettingsController extends Controller
{
    public function __construct(
        private readonly CommentService $commentService,
    ) {}

    /**
     * PATCH /api/v1/files/{fileId}/comment-settings
     */
    public function updateFileSettings(Request $request, string $fileId): JsonResponse
    {
        $file = File::find($fileId);
        if (!$file) {
            return $this->notFound('File not found');
        }

        if (!$file->isOwnedBy($request->user())) {
            return $this->forbidden('Только владелец может изменить настройки комментариев');
        }

        $data = $request->validate([
            'sharedCommentsEnabled'  => 'nullable|boolean',
            'sharedCommentsOverride' => 'nullable|in:inherit,enabled,disabled',
            'mentionsEnabled'        => 'nullable|boolean',
        ]);

        $settings = FileCommentSettings::firstOrNew(['file_id' => $fileId]);
        $old       = $settings->toArray();

        $map = [
            'sharedCommentsEnabled'  => 'shared_comments_enabled',
            'sharedCommentsOverride' => 'shared_comments_override',
            'mentionsEnabled'        => 'mentions_enabled',
        ];

        foreach ($map as $input => $column) {
            if (array_key_exists($input, $data) && $data[$input] !== null) {
                $settings->$column = $data[$input];
            }
        }
        $settings->updated_by = $request->user()->id;
        $settings->updated_at = now();
        $settings->save();

        $this->commentService->auditSettings(
            $request->user(),
            'settings_change',
            $old,
            $settings->fresh()->toArray(),
        );

        return $this->success('Settings updated', ['settings' => $this->formatFileSettings($settings)]);
    }

    /**
     * GET /api/v1/files/{fileId}/comment-settings
     */
    public function getFileSettings(Request $request, string $fileId): JsonResponse
    {
        $file = File::find($fileId);
        if (!$file) {
            return $this->notFound('File not found');
        }

        if (!$file->isOwnedBy($request->user())) {
            return $this->forbidden();
        }

        $settings = FileCommentSettings::find($fileId);

        return $this->success('Settings loaded', ['settings' => $settings
            ? $this->formatFileSettings($settings)
            : $this->defaultFileSettingsArray($fileId)]);
    }

    /**
     * PATCH /api/v1/shared-folders/{folderId}/comment-settings
     */
    public function updateSharedFolderSettings(Request $request, string $folderId): JsonResponse
    {
        $folder = SharedFolder::find($folderId);
        if (!$folder) {
            return $this->notFound('Shared folder not found');
        }

        if (!$this->canManageSharedFolder($request->user()->id, $folder)) {
            return $this->forbidden('Недостаточно прав для изменения настроек');
        }

        $data = $request->validate([
            'sharedCommentsMode' => 'nullable|in:enabled,disabled,inherit_for_items',
            'mentionsEnabled'    => 'nullable|boolean',
        ]);

        $settings = SharedFolderCommentSettings::firstOrNew(['shared_folder_id' => $folderId]);
        $old       = $settings->toArray();

        if (isset($data['sharedCommentsMode'])) {
            $settings->shared_comments_mode = $data['sharedCommentsMode'];
        }
        if (isset($data['mentionsEnabled'])) {
            $settings->mentions_enabled = $data['mentionsEnabled'];
        }
        $settings->updated_by = $request->user()->id;
        $settings->updated_at = now();
        $settings->save();

        $this->commentService->auditSettings(
            $request->user(),
            'settings_change',
            $old,
            $settings->fresh()->toArray(),
        );

        return $this->success('Settings updated', ['settings' => $this->formatFolderSettings($settings)]);
    }

    /**
     * GET /api/v1/shared-folders/{folderId}/comment-settings
     */
    public function getSharedFolderSettings(Request $request, string $folderId): JsonResponse
    {
        $folder = SharedFolder::find($folderId);
        if (!$folder) {
            return $this->notFound('Shared folder not found');
        }

        if (!$this->canManageSharedFolder($request->user()->id, $folder)) {
            return $this->forbidden();
        }

        $settings = SharedFolderCommentSettings::find($folderId);

        return $this->success('Settings loaded', ['settings' => $settings
            ? $this->formatFolderSettings($settings)
            : ['shared_comments_mode' => 'enabled', 'mentions_enabled' => true]]);
    }

    /**
     * PATCH /api/v1/local-folders/{folderId}/comment-settings
     */
    public function updateLocalFolderSettings(Request $request, string $folderId): JsonResponse
    {
        $folder = Folder::find($folderId);
        if (!$folder || $folder->user_id !== $request->user()->id) {
            return $this->notFound('Folder not found');
        }

        $data     = $request->validate(['privateCommentsEnabled' => 'nullable|boolean']);
        $settings = LocalFolderCommentSettings::firstOrNew(['local_folder_id' => $folderId]);

        if (isset($data['privateCommentsEnabled'])) {
            $settings->private_comments_enabled = $data['privateCommentsEnabled'];
        }
        $settings->updated_by = $request->user()->id;
        $settings->updated_at = now();
        $settings->save();

        return $this->success('Settings updated', ['settings' => ['private_comments_enabled' => $settings->private_comments_enabled]]);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private function canManageSharedFolder(int $userId, SharedFolder $folder): bool
    {
        if ($folder->owner_id === $userId) return true;
        return SharedFolderAccess::where('shared_folder_id', $folder->id)
            ->where('user_id', $userId)
            ->where('access_type', 'edit')
            ->exists();
    }

    private function formatFileSettings(FileCommentSettings $s): array
    {
        return [
            'shared_comments_enabled'  => $s->shared_comments_enabled,
            'shared_comments_override' => $s->shared_comments_override?->value ?? 'inherit',
            'private_comments_enabled' => $s->private_comments_enabled,
            'mentions_enabled'         => $s->mentions_enabled,
        ];
    }

    private function defaultFileSettingsArray(string $fileId): array
    {
        return [
            'shared_comments_enabled'  => true,
            'shared_comments_override' => 'inherit',
            'private_comments_enabled' => true,
            'mentions_enabled'         => true,
        ];
    }

    private function formatFolderSettings(SharedFolderCommentSettings $s): array
    {
        return [
            'shared_comments_mode'     => $s->shared_comments_mode?->value ?? 'enabled',
            'private_comments_enabled' => $s->private_comments_enabled,
            'mentions_enabled'         => $s->mentions_enabled,
        ];
    }
}
