<?php

namespace App\Http\Controllers\User;

use App\Enums\AccessType;
use App\Http\Controllers\Controller;
use App\Models\FileUserAccess;
use App\Models\PendingReceivedFile;
use App\Models\PendingReceivedSharedFolder;
use App\Models\SharedFolderAccess;
use App\Services\S3UrlService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class InboxController extends Controller
{
    public function __construct(private readonly S3UrlService $s3) {}
    /**
     * GET /api/v1/inbox/files
     */
    public function files(Request $request): JsonResponse
    {
        $items = PendingReceivedFile::where('recipient_user_id', $request->user()->id)
            ->with(['file', 'sender:id,email,name'])
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($p) => [
                'id'          => $p->id,
                'file_id'     => $p->file_id,
                'file'        => $p->file ? [
                    'id'            => $p->file->id,
                    'original_name' => $p->file->original_name,
                    'size'          => $p->file->size,
                    'mime_type'     => $p->file->mime_type,
                    'thumbnail_url' => $this->s3->resolveListPreviewUrl($p->file),
                ] : null,
                'sender'      => $p->sender ? [
                    'id'    => $p->sender->id,
                    'email' => $p->sender->email,
                    'name'  => $p->sender->name,
                ] : null,
                'received_at' => $p->created_at?->toIso8601String(),
            ]);

        return $this->success('Входящие файлы получены', ['items' => $items]);
    }

    /**
     * POST /api/v1/inbox/files/accept
     */
    public function acceptFiles(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ids'   => ['required', 'array', 'min:1'],
            'ids.*' => ['required', 'string'],
        ]);

        $user = $request->user();

        $pending = PendingReceivedFile::whereIn('id', $data['ids'])
            ->where('recipient_user_id', $user->id)
            ->with('file')
            ->get();

        DB::transaction(function () use ($pending, $user) {
            $existingFileIds = FileUserAccess::whereIn('file_id', $pending->pluck('file_id'))
                ->where('user_id', $user->id)
                ->pluck('file_id')
                ->toArray();

            $now = now();
            $toInsert = $pending->filter(fn ($p) => !in_array($p->file_id, $existingFileIds))
                ->map(fn ($p) => [
                    'id'          => (string) \Illuminate\Support\Str::ulid(),
                    'file_id'     => $p->file_id,
                    'user_id'     => $user->id,
                    'access_type' => AccessType::Shared->value,
                    'can_edit'    => (bool) $p->can_edit,
                    'created_at'  => $now,
                    'updated_at'  => $now,
                ])->values()->toArray();

            if (!empty($toInsert)) {
                $allowed = array_merge((new FileUserAccess)->getFillable(), ['id', 'created_at', 'updated_at']);
                $safeRows = array_map(fn($row) => Arr::only($row, $allowed), $toInsert);
                DB::table('file_user_access')->insert($safeRows);
            }

            PendingReceivedFile::whereIn('id', $pending->pluck('id'))->delete();
        });

        return $this->success('Файлы приняты');
    }

    /**
     * POST /api/v1/inbox/files/reject
     */
    public function rejectFiles(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ids'   => ['required', 'array', 'min:1'],
            'ids.*' => ['required', 'string'],
        ]);

        PendingReceivedFile::whereIn('id', $data['ids'])
            ->where('recipient_user_id', $request->user()->id)
            ->delete();

        return $this->success('Файлы отклонены');
    }

    /**
     * GET /api/v1/inbox/shared-folders
     */
    public function sharedFolders(Request $request): JsonResponse
    {
        $items = PendingReceivedSharedFolder::where('recipient_user_id', $request->user()->id)
            ->with(['sharedFolder', 'inviter:id,email,name'])
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($p) => [
                'id'               => $p->id,
                'shared_folder_id' => $p->shared_folder_id,
                'folder'           => $p->sharedFolder ? [
                    'id'   => $p->sharedFolder->id,
                    'name' => $p->sharedFolder->name,
                ] : null,
                'access_type'      => $p->access_type,
                'inviter'          => $p->inviter ? [
                    'id'    => $p->inviter->id,
                    'email' => $p->inviter->email,
                    'name'  => $p->inviter->name,
                ] : null,
                'received_at'      => $p->created_at?->toIso8601String(),
            ]);

        return $this->success('Входящие общие папки получены', ['items' => $items]);
    }

    /**
     * POST /api/v1/inbox/shared-folders/accept
     */
    public function acceptSharedFolders(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ids'   => ['required', 'array', 'min:1'],
            'ids.*' => ['required', 'string'],
        ]);

        $user = $request->user();

        $pending = PendingReceivedSharedFolder::whereIn('id', $data['ids'])
            ->where('recipient_user_id', $user->id)
            ->get();

        DB::transaction(function () use ($pending, $user) {
            $existingFolderIds = SharedFolderAccess::whereIn('shared_folder_id', $pending->pluck('shared_folder_id'))
                ->where('user_id', $user->id)
                ->pluck('shared_folder_id')
                ->toArray();

            $now = now();
            $toInsert = $pending->filter(fn ($p) => !in_array($p->shared_folder_id, $existingFolderIds))
                ->map(fn ($p) => [
                    'id'               => (string) \Illuminate\Support\Str::ulid(),
                    'shared_folder_id' => $p->shared_folder_id,
                    'user_id'          => $user->id,
                    'access_type'      => $p->access_type instanceof \BackedEnum ? $p->access_type->value : $p->access_type,
                    'created_at'       => $now,
                    'updated_at'       => $now,
                ])->values()->toArray();

            if (!empty($toInsert)) {
                $allowed = array_merge((new SharedFolderAccess)->getFillable(), ['id', 'created_at', 'updated_at']);
                $safeRows = array_map(fn($row) => Arr::only($row, $allowed), $toInsert);
                DB::table('shared_folder_accesses')->insert($safeRows);
            }

            PendingReceivedSharedFolder::whereIn('id', $pending->pluck('id'))->delete();
        });

        return $this->success('Папки приняты');
    }

    /**
     * POST /api/v1/inbox/shared-folders/reject
     */
    public function rejectSharedFolders(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ids'   => ['required', 'array', 'min:1'],
            'ids.*' => ['required', 'string'],
        ]);

        PendingReceivedSharedFolder::whereIn('id', $data['ids'])
            ->where('recipient_user_id', $request->user()->id)
            ->delete();

        return $this->success('Папки отклонены');
    }

    /**
     * GET /api/v1/inbox/count
     */
    public function count(Request $request): JsonResponse
    {
        $userId = $request->user()->id;
        $filesCount = PendingReceivedFile::where('recipient_user_id', $userId)->count();
        $foldersCount = PendingReceivedSharedFolder::where('recipient_user_id', $userId)->count();

        return $this->success('OK', [
            'files'   => $filesCount,
            'folders' => $foldersCount,
            'total'   => $filesCount + $foldersCount,
        ]);
    }
}
