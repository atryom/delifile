<?php

namespace App\Http\Controllers\Organization;

use App\Http\Controllers\Controller;
use App\Models\Folder;
use App\Models\Tag;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrganizationController extends Controller
{
    // ─── Folders ────────────────────────────────────────────────────────────

    /**
     * GET /api/v1/folders
     */
    public function listFolders(Request $request): JsonResponse
    {
        $folders = Folder::where('user_id', $request->user()->id)
            ->withCount('files')
            ->orderBy('name')
            ->get()
            ->map(fn ($f) => [
                'id'         => $f->id,
                'name'       => $f->name,
                'files_count' => $f->files_count,
                'created_at' => $f->created_at?->toIso8601String(),
            ]);

        return $this->success('Folders fetched successfully', ['items' => $folders]);
    }

    /**
     * POST /api/v1/folders
     */
    public function createFolder(Request $request): JsonResponse
    {
        $request->validate(['name' => 'required|string|max:100']);

        $folder = Folder::create([
            'user_id' => $request->user()->id,
            'name'    => $request->name,
        ]);

        return $this->success('Folder created successfully', [
            'folder' => ['id' => $folder->id, 'name' => $folder->name],
        ], 201);
    }

    /**
     * PATCH /api/v1/folders/{folderId}
     */
    public function updateFolder(Request $request, string $folderId): JsonResponse
    {
        $request->validate(['name' => 'required|string|max:100']);

        $folder = Folder::where('id', $folderId)
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$folder) {
            return $this->notFound('Folder not found');
        }

        $folder->update(['name' => $request->name]);

        return $this->success('Folder updated successfully', [
            'folder' => ['id' => $folder->id, 'name' => $folder->name],
        ]);
    }

    /**
     * DELETE /api/v1/folders/{folderId}
     */
    public function deleteFolder(Request $request, string $folderId): JsonResponse
    {
        $folder = Folder::where('id', $folderId)
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$folder) {
            return $this->notFound('Folder not found');
        }

        // Move files to null folder before deleting
        $folder->files()->update(['folder_id' => null]);
        $folder->delete();

        return $this->success('Folder deleted successfully');
    }

    // ─── Tags ────────────────────────────────────────────────────────────────

    /**
     * GET /api/v1/tags
     */
    public function listTags(Request $request): JsonResponse
    {
        $tags = Tag::where('user_id', $request->user()->id)
            ->withCount('files')
            ->orderBy('name')
            ->get()
            ->map(fn ($t) => [
                'id'         => $t->id,
                'name'       => $t->name,
                'files_count' => $t->files_count,
            ]);

        return $this->success('Tags fetched successfully', ['items' => $tags]);
    }

    /**
     * POST /api/v1/tags
     */
    public function createTag(Request $request): JsonResponse
    {
        $request->validate(['name' => 'required|string|max:50']);

        $tag = Tag::firstOrCreate([
            'user_id' => $request->user()->id,
            'name'    => $request->name,
        ]);

        return $this->success('Tag created successfully', [
            'tag' => ['id' => $tag->id, 'name' => $tag->name],
        ], 201);
    }

    /**
     * DELETE /api/v1/tags/{tagId}
     */
    public function deleteTag(Request $request, string $tagId): JsonResponse
    {
        $tag = Tag::where('id', $tagId)
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$tag) {
            return $this->notFound('Tag not found');
        }

        $tag->files()->detach();
        $tag->delete();

        return $this->success('Tag deleted successfully');
    }
}
