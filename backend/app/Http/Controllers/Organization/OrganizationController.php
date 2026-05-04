<?php

namespace App\Http\Controllers\Organization;

use App\Http\Controllers\Controller;
use App\Models\File;
use App\Models\Folder;
use App\Models\Tag;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OrganizationController extends Controller
{
    // ─── Folders ────────────────────────────────────────────────────────────

    /**
     * GET /api/v1/folders/tree
     */
    public function folderTree(Request $request): JsonResponse
    {
        $folders = Folder::where('user_id', $request->user()->id)
            ->withCount('files')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        $tree = $this->buildTree($folders, null);

        return $this->success('Folder tree fetched successfully', ['items' => $tree]);
    }

    /**
     * GET /api/v1/folders
     */
    public function listFolders(Request $request): JsonResponse
    {
        $folders = Folder::where('user_id', $request->user()->id)
            ->withCount('files')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->map(fn ($f) => [
                'id'          => $f->id,
                'name'        => $f->name,
                'parent_id'   => $f->parent_id,
                'sort_order'  => $f->sort_order,
                'files_count' => $f->files_count,
                'created_at'  => $f->created_at?->toIso8601String(),
            ]);

        return $this->success('Folders fetched successfully', ['items' => $folders]);
    }

    /**
     * POST /api/v1/folders
     */
    public function createFolder(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'       => 'required|string|max:100',
            'parent_id'  => 'nullable|string',
            'sort_order' => 'nullable|integer',
        ]);

        if (!empty($data['parent_id'])) {
            $parent = Folder::where('id', $data['parent_id'])
                ->where('user_id', $request->user()->id)
                ->first();

            if (!$parent) {
                return $this->notFound('Parent folder not found');
            }
        }

        $folder = Folder::create([
            'user_id'    => $request->user()->id,
            'name'       => $data['name'],
            'parent_id'  => $data['parent_id'] ?? null,
            'sort_order' => $data['sort_order'] ?? null,
        ]);

        return $this->success('Folder created successfully', [
            'folder' => $this->formatFolder($folder),
        ], 201);
    }

    /**
     * PATCH /api/v1/folders/{folderId}
     */
    public function updateFolder(Request $request, string $folderId): JsonResponse
    {
        $data = $request->validate([
            'name'       => 'sometimes|string|max:100',
            'parent_id'  => 'nullable|string',
            'sort_order' => 'nullable|integer',
        ]);

        $folder = Folder::where('id', $folderId)
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$folder) {
            return $this->notFound('Folder not found');
        }

        // Cycle detection: the new parent cannot be a descendant of this folder
        if (isset($data['parent_id']) && $data['parent_id'] !== null) {
            if ($data['parent_id'] === $folderId) {
                return $this->error('Папка не может быть родителем самой себя', 'CYCLE_DETECTED', [], 422);
            }

            $parent = Folder::where('id', $data['parent_id'])
                ->where('user_id', $request->user()->id)
                ->first();

            if (!$parent) {
                return $this->notFound('Parent folder not found');
            }

            // Check if new parent is a descendant of current folder
            if ($this->isDescendant($folder, $parent)) {
                return $this->error('Обнаружена цикличная вложенность папок', 'CYCLE_DETECTED', [], 422);
            }
        }

        $folder->update(array_filter($data, fn ($v) => $v !== null || array_key_exists('parent_id', $data)));

        return $this->success('Folder updated successfully', [
            'folder' => $this->formatFolder($folder->fresh()),
        ]);
    }

    /**
     * DELETE /api/v1/folders/{folderId}
     */
    public function deleteFolder(Request $request, string $folderId): JsonResponse
    {
        $data = $request->validate([
            'force' => 'nullable|boolean',
        ]);

        $folder = Folder::where('id', $folderId)
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$folder) {
            return $this->notFound('Folder not found');
        }

        if ($folder->hasChildren()) {
            return $this->error(
                'Нельзя удалить папку с вложенными папками. Сначала удалите или переместите их.',
                'HAS_CHILDREN',
                [],
                422
            );
        }

        $force = $data['force'] ?? false;

        if (!$force && $folder->files()->count() > 0) {
            return $this->error(
                'В папке есть файлы. Передайте force=true для подтверждения снятия привязки файлов.',
                'HAS_FILES',
                ['files_count' => $folder->files()->count()],
                422
            );
        }

        DB::transaction(function () use ($folder) {
            $folder->files()->update(['folder_id' => null]);
            $folder->delete();
        });

        return $this->success('Folder deleted successfully');
    }

    // ─── Tags ────────────────────────────────────────────────────────────────

    /**
     * GET /api/v1/tags
     */
    public function listTags(Request $request): JsonResponse
    {
        $search = $request->query('search');

        $query = Tag::where('user_id', $request->user()->id)
            ->withCount('files')
            ->orderBy('name');

        if ($search) {
            $query->where('name', 'like', "%{$search}%");
        }

        $tags = $query->get()->map(fn ($t) => [
            'id'          => $t->id,
            'name'        => $t->name,
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

        $exists = Tag::where('user_id', $request->user()->id)
            ->where('name', $request->name)
            ->exists();

        if ($exists) {
            return $this->error('Тег с таким именем уже существует', 'TAG_EXISTS', [], 422);
        }

        $tag = Tag::create([
            'user_id' => $request->user()->id,
            'name'    => $request->name,
        ]);

        return $this->success('Tag created successfully', [
            'tag' => ['id' => $tag->id, 'name' => $tag->name, 'files_count' => 0],
        ], 201);
    }

    /**
     * PATCH /api/v1/tags/{tagId}
     */
    public function updateTag(Request $request, string $tagId): JsonResponse
    {
        $request->validate(['name' => 'required|string|max:50']);

        $tag = Tag::where('id', $tagId)
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$tag) {
            return $this->notFound('Tag not found');
        }

        $duplicate = Tag::where('user_id', $request->user()->id)
            ->where('name', $request->name)
            ->where('id', '!=', $tagId)
            ->exists();

        if ($duplicate) {
            return $this->error('Тег с таким именем уже существует', 'TAG_EXISTS', [], 422);
        }

        $tag->update(['name' => $request->name]);

        return $this->success('Tag updated successfully', [
            'tag' => ['id' => $tag->id, 'name' => $tag->name],
        ]);
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

        DB::transaction(function () use ($tag) {
            $tag->files()->detach();
            $tag->delete();
        });

        return $this->success('Tag deleted and removed from files');
    }

    // ─── File tag/folder actions ─────────────────────────────────────────────

    /**
     * POST /api/v1/files/{fileId}/attach-tags
     */
    public function attachTags(Request $request, string $fileId): JsonResponse
    {
        $request->validate(['tag_ids' => 'required|array', 'tag_ids.*' => 'string']);

        $file = File::where('id', $fileId)->where('owner_id', $request->user()->id)->first();
        if (!$file) {
            return $this->notFound('File not found');
        }

        $file->tags()->syncWithoutDetaching($request->tag_ids);

        return $this->success('Tags attached', [
            'tags' => $file->fresh()->tags->map(fn ($t) => ['id' => $t->id, 'name' => $t->name]),
        ]);
    }

    /**
     * POST /api/v1/files/{fileId}/detach-tags
     */
    public function detachTags(Request $request, string $fileId): JsonResponse
    {
        $request->validate(['tag_ids' => 'required|array', 'tag_ids.*' => 'string']);

        $file = File::where('id', $fileId)->where('owner_id', $request->user()->id)->first();
        if (!$file) {
            return $this->notFound('File not found');
        }

        $file->tags()->detach($request->tag_ids);

        return $this->success('Tags detached', [
            'tags' => $file->fresh()->tags->map(fn ($t) => ['id' => $t->id, 'name' => $t->name]),
        ]);
    }

    /**
     * POST /api/v1/files/{fileId}/clear-folder
     */
    public function clearFolder(Request $request, string $fileId): JsonResponse
    {
        $file = File::where('id', $fileId)->where('owner_id', $request->user()->id)->first();
        if (!$file) {
            return $this->notFound('File not found');
        }

        $file->update(['folder_id' => null]);

        return $this->success('File removed from folder');
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private function buildTree($folders, ?string $parentId): array
    {
        return $folders
            ->where('parent_id', $parentId)
            ->values()
            ->map(fn ($f) => [
                'id'          => $f->id,
                'name'        => $f->name,
                'sort_order'  => $f->sort_order,
                'files_count' => $f->files_count,
                'children'    => $this->buildTree($folders, $f->id),
            ])
            ->toArray();
    }

    private function formatFolder(Folder $folder): array
    {
        return [
            'id'          => $folder->id,
            'name'        => $folder->name,
            'parent_id'   => $folder->parent_id,
            'sort_order'  => $folder->sort_order,
            'created_at'  => $folder->created_at?->toIso8601String(),
        ];
    }

    private function isDescendant(Folder $ancestor, Folder $candidate): bool
    {
        $node = $candidate;
        while ($node->parent_id) {
            if ($node->parent_id === $ancestor->id) {
                return true;
            }
            $node = $node->parent;
            if (!$node) {
                break;
            }
        }
        return false;
    }
}
