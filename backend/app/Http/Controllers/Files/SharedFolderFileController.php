<?php

namespace App\Http\Controllers\Files;

use App\Http\Controllers\Controller;
use App\Models\File;
use App\Models\FileUserAccess;
use App\Models\SharedFolder;
use App\Models\SharedFolderAccess;
use App\Models\SharedFolderFile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SharedFolderFileController extends Controller
{
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

        $targetFolderIds = $data['folder_ids'];

        // Resolve folders user can edit
        $ownedIds = SharedFolder::where('owner_id', $user->id)->pluck('id');
        $editAccessIds = SharedFolderAccess::where('user_id', $user->id)
            ->where('access_type', 'edit')
            ->pluck('shared_folder_id');

        $editableFolderIds = $ownedIds->merge($editAccessIds)->unique()->values();

        DB::transaction(function () use ($file, $user, $targetFolderIds, $editableFolderIds) {
            // Remove file from editable folders not in target list
            SharedFolderFile::where('file_id', $file->id)
                ->whereIn('shared_folder_id', $editableFolderIds)
                ->whereNotIn('shared_folder_id', $targetFolderIds)
                ->delete();

            // Add file to new folders (only editable ones)
            $toAdd = array_intersect($targetFolderIds, $editableFolderIds->toArray());
            foreach ($toAdd as $folderId) {
                SharedFolderFile::firstOrCreate([
                    'shared_folder_id' => $folderId,
                    'file_id'          => $file->id,
                ], [
                    'added_by' => $user->id,
                ]);
            }
        });

        // Return the full list of folder IDs this file is now in (across all user-accessible folders)
        $currentFolderIds = SharedFolderFile::where('file_id', $file->id)
            ->whereIn('shared_folder_id', $editableFolderIds)
            ->pluck('shared_folder_id')
            ->values()
            ->toArray();

        return $this->success('Shared folders updated', ['folder_ids' => $currentFolderIds]);
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

        $isOwner     = $folder->owner_id === $user->id;
        $hasEdit     = SharedFolderAccess::where('shared_folder_id', $folderId)
            ->where('user_id', $user->id)
            ->where('access_type', 'edit')
            ->exists();
        $isFileOwner = $file->isOwnedBy($user);

        if (!$isOwner && !$hasEdit && !$isFileOwner) {
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
            'id'    => $f->id,
            'name'  => $f->name,
            'is_in' => in_array($f->id, $containingIds),
        ]);

        return $this->success('Shared folders fetched', [
            'folder_ids' => $containingIds,
            'folders'    => $foldersList,
        ]);
    }
}
