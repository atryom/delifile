<?php

namespace App\Http\Controllers\Files;

use App\Http\Controllers\Controller;
use App\Models\File;
use App\Models\FileUserAccess;
use App\Models\SharedFolder;
use App\Models\SharedFolderAccess;
use App\Models\SharedFolderFile;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SharedFolderFileController extends Controller
{
    /**
     * Check folder access with ancestor inheritance — mirrors SharedFolderController::canAccess().
     */
    private function canAccessSharedFolder(User $user, SharedFolder $folder, string $requiredType = 'view'): bool
    {
        $current = $folder;
        while ($current) {
            if ($current->owner_id === $user->id) return true;

            $query = SharedFolderAccess::where('shared_folder_id', $current->id)
                ->where('user_id', $user->id);
            if ($requiredType === 'edit') {
                $query->where('access_type', 'edit');
            }
            if ($query->exists()) return true;

            $current = $current->parent_id ? SharedFolder::find($current->parent_id) : null;
        }
        return false;
    }

    /**
     * POST /api/v1/files/{id}/add-to-my-files
     * Move a shared_folder_only file into the user's regular files.
     */
    public function addToMyFiles(Request $request, string $fileId): JsonResponse
    {
        $user = $request->user();

        $file = File::find($fileId);
        if (!$file) {
            return $this->notFound('File not found');
        }

        if (!$file->isOwnedBy($user)) {
            return $this->forbidden('You do not own this file');
        }

        if (!$file->shared_folder_only) {
            return $this->error('File is already in your files', 'ALREADY_IN_MY_FILES', [], 422);
        }

        $file->update(['shared_folder_only' => false]);

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
            || FileUserAccess::where('file_id', $file->id)->where('user_id', $user->id)->exists();

        if (!$hasAccess || $file->shared_folder_only) {
            return $this->forbidden('File must be accessible and not shared_folder_only');
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
        $allFolders   = SharedFolder::whereIn('id', $allFolderIds)->keyBy('id');

        // Determine which folders the user can actually edit (with ancestor inheritance)
        $editableIds = [];
        foreach ($allFolderIds as $folderId) {
            $folder = $allFolders->get($folderId);
            if ($folder && $this->canAccessSharedFolder($user, $folder, 'edit')) {
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
            foreach ($toAdd as $folderId) {
                SharedFolderFile::firstOrCreate([
                    'shared_folder_id' => $folderId,
                    'file_id'          => $file->id,
                ], ['added_by' => $user->id]);
            }
        });

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

        if (!$this->canAccessSharedFolder($user, $folder, 'edit')) {
            return $this->forbidden('Edit access required to add files');
        }

        SharedFolderFile::firstOrCreate([
            'shared_folder_id' => $folderId,
            'file_id'          => $fileId,
        ], ['added_by' => $user->id]);

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

        if (!$this->canAccessSharedFolder($user, $folder, 'edit') && !$isFileOwner) {
            return $this->forbidden('You do not have permission to remove this file');
        }

        SharedFolderFile::where('shared_folder_id', $folderId)
            ->where('file_id', $fileId)
            ->delete();

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
