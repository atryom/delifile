<?php

namespace App\Http\Controllers\Files;

use App\Http\Controllers\Controller;
use App\Models\File;
use App\Models\FileUserAccess;
use App\Models\SharedFolder;
use App\Enums\SharedFolderAccessType;
use App\Models\SharedFolderAccess;
use App\Models\SharedFolderFile;
use App\Models\User;
use App\Services\FileService;
use App\Services\NotificationService;
use App\Services\PushNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SharedFolderFileController extends Controller
{
    public function __construct(
        private readonly FileService             $fileService,
        private readonly NotificationService     $notificationService,
        private readonly PushNotificationService $pushService,
    ) {}

    private function notifyFolderMembers(SharedFolder $folder, User $adder, string $contentType, ?string $contentId = null): void
    {
        $memberIds = array_unique(array_merge(
            [$folder->owner_id],
            SharedFolderAccess::where('shared_folder_id', $folder->id)
                ->whereNotNull('user_id')
                ->pluck('user_id')
                ->toArray()
        ));
        $adderName    = $adder->name ?? $adder->email;
        $contentLabel = match($contentType) {
            'link' => 'ссылку',
            'note' => 'заметку',
            default => 'файл',
        };
        $notifUrl = $contentId
            ? config('app.url') . '/files/' . $contentId
            : config('app.url') . '/folders?tab=shared&shared_folder_id=' . $folder->id;

        foreach ($memberIds as $memberId) {
            if ($memberId === $adder->id) continue;
            $member = User::find($memberId);
            if (!$member) continue;

            $this->notificationService->notifySharedFolderContentAdded(
                $member, $adderName, $folder->name, $folder->id, $contentType, $contentId,
            );
            if ($member->notifications_enabled ?? true) {
                $this->pushService->sendToUser(
                    $member,
                    'Новое в общей папке',
                    "{$adderName} добавил {$contentLabel} в «{$folder->name}»",
                    $notifUrl,
                );
            }
        }
    }
    /**
     * Check folder access with ancestor inheritance — mirrors SharedFolderController::canAccess().
     */
    private function canAccessSharedFolder(User $user, SharedFolder $folder, string $requiredType = SharedFolderAccessType::View->value): bool
    {
        $folder->loadMissing('parent.parent.parent.parent');

        $ancestorIds = [];
        $current     = $folder;
        $visited     = [];
        while ($current) {
            if (isset($visited[$current->id])) break;
            $visited[$current->id] = true;
            if ($current->owner_id === $user->id) return true;
            $ancestorIds[] = $current->id;
            $current = $current->parent;
        }

        if (empty($ancestorIds)) return false;

        $query = SharedFolderAccess::where('user_id', $user->id)
            ->whereIn('shared_folder_id', $ancestorIds);

        if ($requiredType === SharedFolderAccessType::Edit->value) {
            $query->where('access_type', SharedFolderAccessType::Edit->value);
        }

        return $query->exists();
    }

    /**
     * POST /api/v1/files/{id}/add-to-my-files
     * Move an owned file back to personal root (clear folder_id).
     */
    public function addToMyFiles(Request $request, string $fileId): JsonResponse
    {
        $file = File::find($fileId);
        if (!$file) {
            return $this->notFound('File not found');
        }

        if (!$file->isOwnedBy($request->user())) {
            return $this->forbidden('You do not own this file');
        }

        $file->update(['folder_id' => null]);

        return $this->success('File added to your files');
    }

    /**
     * POST /api/v1/files/{id}/shared-folders
     * Sync the shared folders that contain this file (for folders user can edit).
     */
    public function updateSharedFolders(Request $request, string $fileId): JsonResponse
    {
        $user = $request->user();

        $file = File::find($fileId);
        if (!$file) {
            return $this->notFound('File not found');
        }

        $hasAccess = $file->isOwnedBy($user)
            || $this->fileService->canAccess($user, $file);

        if (!$hasAccess) {
            return $this->forbidden('File must be accessible');
        }

        $data = $request->validate([
            'folder_ids'   => 'required|array',
            'folder_ids.*' => 'string',
        ]);

        $targetFolderIds = collect($data['folder_ids'])->unique()->values()->toArray();

        // All folder IDs relevant to this operation (current + requested)
        $currentFolderIds = SharedFolderFile::where('file_id', $file->id)
            ->pluck('shared_folder_id')->toArray();

        $allFolderIds = array_unique(array_merge($targetFolderIds, $currentFolderIds));
        $allFolders   = SharedFolder::whereIn('id', $allFolderIds)->get()->keyBy('id');

        // Determine which folders the user can actually edit (with ancestor inheritance)
        $editableIds = [];
        foreach ($allFolderIds as $folderId) {
            $folder = $allFolders->get($folderId);
            if ($folder && $this->canAccessSharedFolder($user, $folder, SharedFolderAccessType::Edit->value)) {
                $editableIds[] = $folderId;
            }
        }

        $toRemove = array_diff(array_intersect($currentFolderIds, $editableIds), $targetFolderIds);
        $toAdd    = array_diff(array_intersect($targetFolderIds, $editableIds), $currentFolderIds);

        DB::transaction(function () use ($file, $user, $toAdd, $toRemove) {
            if (!empty($toRemove)) {
                SharedFolderFile::where('file_id', $file->id)
                    ->whereIn('shared_folder_id', $toRemove)
                    ->delete();
            }
            if (!empty($toAdd)) {
                $now = now();
                DB::table('shared_folder_files')->insertOrIgnore(
                    array_map(fn ($folderId) => [
                        'id'               => (string) \Illuminate\Support\Str::ulid(),
                        'shared_folder_id' => $folderId,
                        'file_id'          => $file->id,
                        'added_by'         => $user->id,
                        'created_at'       => $now,
                        'updated_at'       => $now,
                    ], $toAdd)
                );
            }
        });

        foreach ($toAdd as $folderId) {
            $folder = $allFolders->get($folderId);
            if ($folder) {
                $this->notifyFolderMembers($folder, $user, 'file', $file->id);
            }
        }

        $updatedFolderIds = SharedFolderFile::where('file_id', $file->id)
            ->pluck('shared_folder_id')->values()->toArray();

        return $this->success('Shared folders updated', ['folder_ids' => $updatedFolderIds]);
    }

    /**
     * POST /api/v1/shared-folders/{folderId}/files/{fileId}
     * Add an existing file to a shared folder.
     */
    public function addFile(Request $request, string $folderId, string $fileId): JsonResponse
    {
        $user   = $request->user();
        $folder = SharedFolder::find($folderId);
        if (!$folder) {
            return $this->notFound('Folder not found');
        }

        $file = File::find($fileId);
        if (!$file) {
            return $this->notFound('File not found');
        }

        if (!$this->fileService->canAccess($user, $file)) {
            return $this->forbidden('You do not have access to this file');
        }

        if (!$file->isAvailable()) {
            return $this->error('File is not available', 'FILE_NOT_AVAILABLE', [], 422);
        }

        if (!$this->canAccessSharedFolder($user, $folder, SharedFolderAccessType::Edit->value)) {
            return $this->forbidden('Edit access required to add files');
        }

        $sff = SharedFolderFile::firstOrCreate([
            'shared_folder_id' => $folderId,
            'file_id'          => $fileId,
        ], ['added_by' => $user->id]);

        if ($request->boolean('move') && $file->isOwnedBy($user)) {
            $file->update(['folder_id' => $folderId]);
        }

        if ($sff->wasRecentlyCreated) {
            $this->notifyFolderMembers($folder, $user, 'file', $file->id);
        }

        return $this->success('File added to folder');
    }

    /**
     * DELETE /api/v1/shared-folders/{folderId}/files/{fileId}
     * Remove a file from a shared folder (does not delete the file from the system).
     */
    public function removeFile(Request $request, string $folderId, string $fileId): JsonResponse
    {
        $user   = $request->user();
        $folder = SharedFolder::find($folderId);
        if (!$folder) {
            return $this->notFound('Folder not found');
        }

        $file = File::find($fileId);
        if (!$file) {
            return $this->notFound('File not found');
        }

        $isFileOwner = $file->isOwnedBy($user);

        if (!$this->canAccessSharedFolder($user, $folder, SharedFolderAccessType::Edit->value) && !$isFileOwner) {
            return $this->forbidden('You do not have permission to remove this file');
        }

        SharedFolderFile::where('shared_folder_id', $folderId)
            ->where('file_id', $fileId)
            ->delete();

        if ($file->folder_id === $folderId && $file->isOwnedBy($user)) {
            $file->update(['folder_id' => null]);
        }

        return $this->success('File removed from folder');
    }

    /**
     * GET /api/v1/files/{id}/shared-folders
     * Return the shared folders that contain this file along with membership flags.
     */
    public function getSharedFolders(Request $request, string $fileId): JsonResponse
    {
        $user = $request->user();

        $file = File::find($fileId);
        if (!$file) {
            return $this->notFound('File not found');
        }

        $hasAccess = $file->isOwnedBy($user)
            || FileUserAccess::where('file_id', $file->id)->where('user_id', $user->id)->exists();

        if (!$hasAccess) {
            return $this->forbidden('You do not have access to this file');
        }

        // All folders accessible to this user
        $ownedIds = SharedFolder::where('owner_id', $user->id)->pluck('id');
        $accessIds = SharedFolderAccess::where('user_id', $user->id)->pluck('shared_folder_id');
        $allIds = $ownedIds->merge($accessIds)->unique();

        $folders = SharedFolder::whereIn('id', $allIds)->get();

        // Which of those folders contain this file
        $containingIds = SharedFolderFile::where('file_id', $file->id)
            ->whereIn('shared_folder_id', $allIds)
            ->pluck('shared_folder_id')
            ->toArray();

        $foldersList = $folders->map(fn (SharedFolder $f) => [
            'id'        => $f->id,
            'name'      => $f->name,
            'parent_id' => $f->parent_id,
            'is_in'     => in_array($f->id, $containingIds),
        ]);

        return $this->success('Shared folders fetched', [
            'folder_ids' => $containingIds,
            'folders'    => $foldersList,
        ]);
    }
}
