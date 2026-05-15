<?php

namespace App\Http\Controllers\User;

use App\Enums\AccessType;
use App\Http\Controllers\Controller;
use App\Models\FileUserAccess;
use App\Models\PendingReceivedFile;
use App\Models\PendingReceivedSharedFolder;
use App\Models\SharedFolderAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InboxController extends Controller
{
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
                    'description'   => $p->file->description,
                    'size'          => $p->file->size,
                    'mime_type'     => $p->file->mime_type,
                    'thumbnail_url' => $p->file->thumbnail_url ?? null,
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
            foreach ($pending as $p) {
                FileUserAccess::firstOrCreate([
                    'file_id'     => $p->file_id,
                    'user_id'     => $user->id,
                    'access_type' => AccessType::Shared,
                ]);
                $p->delete();
            }
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
            foreach ($pending as $p) {
                SharedFolderAccess::firstOrCreate([
                    'shared_folder_id' => $p->shared_folder_id,
                    'user_id'          => $user->id,
                ], [
                    'access_type' => $p->access_type,
                ]);
                $p->delete();
            }
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
