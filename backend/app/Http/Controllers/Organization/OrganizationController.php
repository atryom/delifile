<?php

namespace App\Http\Controllers\Organization;

use App\Http\Controllers\Controller;
use App\Models\File;
use App\Models\Tag;
use App\Services\FileService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OrganizationController extends Controller
{
    public function __construct(private readonly FileService $fileService) {}

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

    // ─── File tag actions ─────────────────────────────────────────────────────

    /**
     * POST /api/v1/files/{fileId}/attach-tags
     */
    public function attachTags(Request $request, string $fileId): JsonResponse
    {
        $request->validate(['tag_ids' => 'required|array', 'tag_ids.*' => 'string']);

        $user = $request->user();
        $file = File::find($fileId);
        if (!$file || !$this->fileService->canAccess($user, $file)) {
            return $this->notFound('File not found');
        }

        $validTagIds = Tag::where('user_id', $user->id)
            ->whereIn('id', $request->tag_ids)
            ->pluck('id')
            ->toArray();

        $existing = DB::table('file_tags')
            ->where('file_id', $file->id)
            ->where('user_id', $user->id)
            ->pluck('tag_id')
            ->toArray();

        $toInsert = array_map(fn ($tagId) => [
            'file_id' => $file->id,
            'tag_id'  => $tagId,
            'user_id' => $user->id,
        ], array_diff($validTagIds, $existing));

        if (!empty($toInsert)) {
            DB::table('file_tags')->insert($toInsert);
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
        if (!$file || !$this->fileService->canAccess($user, $file)) {
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
}
