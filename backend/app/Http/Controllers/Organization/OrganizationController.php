<?php

namespace App\Http\Controllers\Organization;

use App\Http\Controllers\Controller;
use App\Models\File;
use App\Models\FileUserAccess;
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
        $userId = $request->user()->id;
        $folders = Folder::where('user_id', $userId)
            ->addSelect([
                'files_count' => FileUserAccess::selectRaw('COUNT(DISTINCT file_user_access.file_id)')
                    ->join('files', function ($join) {
                        $join->on('files.id', '=', 'file_user_access.file_id')
                             ->whereNull('files.deleted_at');
                    })
                    ->whereColumn('file_user_access.folder_id', 'folders.id')
                    ->where('file_user_access.user_id', $userId)
                    ->where(function ($q) use ($userId) {
                        $q->where(fn ($q2) => $q2->where('files.owner_id', $userId)->where('files.shared_folder_only', false))
                          ->orWhereIn('file_user_access.access_type', ['shared', 'saved']);
                    }),
            ])
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
        $userId = $request->user()->id;
        $folders = Folder::where('user_id', $userId)
            ->addSelect([
                'files_count' => FileUserAccess::selectRaw('COUNT(DISTINCT file_user_access.file_id)')
                    ->join('files', function ($join) {
                        $join->on('files.id', '=', 'file_user_access.file_id')
                             ->whereNull('files.deleted_at');
                    })
                    ->whereColumn('file_user_access.folder_id', 'folders.id')
                    ->where('file_user_access.user_id', $userId)
                    ->where(function ($q) use ($userId) {
                        $q->where(fn ($q2) => $q2->where('files.owner_id', $userId)->where('files.shared_folder_only', false))
                          ->orWhereIn('file_user_access.access_type', ['shared', 'saved']);
                    }),
            ])
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
        $userId = $request->user()->id;

        $folder = Folder::where('id', $folderId)
            ->where('user_id', $userId)
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

        $force = filter_var($request->query('force', $request->input('force', false)), FILTER_VALIDATE_BOOLEAN);

        $filesCount = FileUserAccess::where('folder_id', $folder->id)
            ->where('user_id', $userId)
            ->count();

        if (!$force && $filesCount > 0) {
            return $this->error(
                'В папке есть файлы. Передайте force=true для подтверждения снятия привязки файлов.',
                'HAS_FILES',
                ['files_count' => $filesCount],
                422
            );
        }

        DB::transaction(function () use ($folder, $userId) {
            FileUserAccess::where('folder_id', $folder->id)
                ->where('user_id', $userId)
                ->update(['folder_id' => null]);
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

        $userId = $request->user()->id;
        $query = Tag::where('user_id', $userId)
            ->withCount(['files' => fn($q) => $q->where('file_tags.user_id', $userId)])
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

        $user = $request->user();
        $file = File::find($fileId);
        if (!$file || !$file->hasAccessFor($user)) {
            return $this->notFound('File not found');
        }

        $existing = DB::table('file_tags')
            ->where('file_id', $file->id)
            ->where('user_id', $user->id)
            ->pluck('tag_id')
            ->toArray();

        foreach (array_diff($request->tag_ids, $existing) as $tagId) {
            DB::table('file_tags')->insert([
                'file_id' => $file->id,
                'tag_id'  => $tagId,
                'user_id' => $user->id,
            ]);
        }

        $tags = DB::table('file_tags')
            ->join('tags', 'tags.id', '=', 'file_tags.tag_id')
            ->where('file_tags.file_id', $file->id)
            ->where('file_tags.user_id', $user->id)
            ->select('tags.id', 'tags.name')
            ->get();

        return $this->success('Tags attached', ['tags' => $tags]);
    }

    /**
     * POST /api/v1/files/{fileId}/detach-tags
     */
    public function detachTags(Request $request, string $fileId): JsonResponse
    {
        $request->validate(['tag_ids' => 'required|array', 'tag_ids.*' => 'string']);

        $user = $request->user();
        $file = File::find($fileId);
        if (!$file || !$file->hasAccessFor($user)) {
            return $this->notFound('File not found');
        }

        DB::table('file_tags')
            ->where('file_id', $file->id)
            ->where('user_id', $user->id)
            ->whereIn('tag_id', $request->tag_ids)
            ->delete();

        $tags = DB::table('file_tags')
            ->join('tags', 'tags.id', '=', 'file_tags.tag_id')
            ->where('file_tags.file_id', $file->id)
            ->where('file_tags.user_id', $user->id)
            ->select('tags.id', 'tags.name')
            ->get();

        return $this->success('Tags detached', ['tags' => $tags]);
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
