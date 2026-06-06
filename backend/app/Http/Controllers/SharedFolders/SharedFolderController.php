<?php

namespace App\Http\Controllers\SharedFolders;

use App\Enums\AccessType;
use App\Enums\FileStatus;
use App\Enums\SharedFolderAccessType;
use App\Enums\ShareLinkStatus;
use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\File;
use App\Models\FileLike;
use App\Models\FileUserAccess;
use App\Models\PendingReceivedSharedFolder;
use App\Models\SharedFolder;
use App\Models\SharedFolderCommentSettings;
use App\Models\SharedFolderAccess;
use App\Models\SharedFolderFile;
use App\Models\SharedFolderLink;
use App\Models\User;
use App\Services\FileCardBuilder;
use App\Services\FileService;
use App\Services\LinkPreviewService;
use App\Services\MimeService;
use App\Services\NotificationService;
use App\Services\PushNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class SharedFolderController extends Controller
{
    public function __construct(
        private readonly FileService             $fileService,
        private readonly FileCardBuilder         $cardBuilder,
        private readonly LinkPreviewService      $previewService,
        private readonly MimeService             $mime,
        private readonly PushNotificationService $pushService,
        private readonly NotificationService     $notificationService,
    ) {}

    // ─── Notification helpers ─────────────────────────────────────────────────

    private function getFolderMemberUserIds(SharedFolder $folder): array
    {
        $memberIds = [$folder->owner_id];
        $directIds = SharedFolderAccess::where('shared_folder_id', $folder->id)
            ->whereNotNull('user_id')
            ->pluck('user_id')
            ->toArray();
        return array_unique(array_merge($memberIds, $directIds));
    }

    private function notifyFolderMembers(SharedFolder $folder, User $adder, string $contentType, ?string $contentId = null): void
    {
        $memberIds = $this->getFolderMemberUserIds($folder);
        $adderName = $adder->name ?? $adder->email;
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

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Check if user can access the shared folder at the given level.
     * 'view': owner OR has any access record (view or edit) on this folder OR any ancestor
     * 'edit': owner OR has access_type=edit on this folder OR any ancestor
     *
     * Nested folders inherit access from ancestors; they can also have their own
     * additional participants that narrow or widen the inherited set.
     */
    private function collectDescendantIds(string $folderId): array
    {
        $ids = [];
        $children = SharedFolder::where('parent_id', $folderId)->pluck('id')->toArray();
        foreach ($children as $childId) {
            $ids[] = $childId;
            array_push($ids, ...$this->collectDescendantIds($childId));
        }
        return $ids;
    }

    private function canAccess(User $user, SharedFolder $folder, string $requiredType = SharedFolderAccessType::View->value): bool
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

    private function formatFolder(SharedFolder $folder, User $user, ?SharedFolderAccess $myAccess = null): array
    {
        return [
            'id'                => $folder->id,
            'name'              => $folder->name,
            'owner_id'          => $folder->owner_id,
            'parent_id'         => $folder->parent_id,
            'folder_type'       => $folder->folder_type ?? 'default',
            'files_count'       => $folder->files_count ?? 0,
            'tasks_count'       => $folder->tasks_count ?? 0,
            'children_count'    => $folder->children_count ?? 0,
            'is_owner'          => $folder->owner_id === $user->id,
            'my_access_type'    => $myAccess?->access_type?->value,
            'is_private'        => (bool) $folder->is_private,
            'is_personal_root'  => (bool) $folder->is_personal_root,
            'sort_order'        => $folder->sort_order,
            'has_shared_access' => ($folder->accesses_count ?? 0) > 0,
            'created_at'        => $folder->created_at?->toIso8601String(),
        ];
    }


    // ─── Folder CRUD ─────────────────────────────────────────────────────────

    /**
     * GET /api/v1/shared-folders
     *
     * Returns the "root-level" shared folders for the current user:
     * - Owned folders at the tree root (parent_id IS NULL)
     * - Directly-granted folders where NO ancestor is accessible to the user
     *   (so a subfolder granted in isolation appears at the root of the user's view)
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $ownedIds        = SharedFolder::where('owner_id', $user->id)->pluck('id')->toArray();
        $directAccessIds = SharedFolderAccess::where('user_id', $user->id)
            ->pluck('shared_folder_id')->toArray();

        // Set of all folder IDs the user can reach directly (owned or granted)
        $accessibleSet = array_flip(array_unique(array_merge($ownedIds, $directAccessIds)));

        // 1. User's own root folders (exclude personal-root helper folder)
        $showIds = SharedFolder::whereIn('id', $ownedIds)
            ->whereNull('parent_id')
            ->where(fn ($q) => $q->whereNull('is_personal_root')->orWhere('is_personal_root', false))
            ->pluck('id')
            ->toArray();

        // 2. Directly-granted folders where no ancestor is in the accessible set
        if (!empty($directAccessIds)) {
            $accessFolders = SharedFolder::whereIn('id', $directAccessIds)
                ->get(['id', 'owner_id', 'parent_id']);

            // Pre-load entire ancestor chains to avoid N+1
            $loaded   = $accessFolders->keyBy('id')->toArray();
            $toFetch  = $accessFolders->pluck('parent_id')->filter()->unique()
                ->diff(array_keys($loaded))->toArray();

            while (!empty($toFetch)) {
                $parents = SharedFolder::whereIn('id', $toFetch)->get(['id', 'owner_id', 'parent_id']);
                foreach ($parents as $p) {
                    $loaded[$p->id] = $p;
                }
                $toFetch = $parents->pluck('parent_id')->filter()->unique()
                    ->diff(array_keys($loaded))->toArray();
            }

            foreach ($accessFolders as $folder) {
                if ($folder->owner_id === $user->id) {
                    continue; // already covered by owned-root logic
                }

                $ancestorAccessible = false;
                $parentId = $folder->parent_id;

                while ($parentId !== null) {
                    if (isset($accessibleSet[$parentId])) {
                        $ancestorAccessible = true;
                        break;
                    }
                    $parent = $loaded[$parentId] ?? null;
                    if (!$parent) break;
                    if ($parent->owner_id === $user->id) {
                        $ancestorAccessible = true;
                        break;
                    }
                    $parentId = $parent->parent_id;
                }

                if (!$ancestorAccessible) {
                    $showIds[] = $folder->id;
                }
            }
        }

        $showIds = array_unique($showIds);

        $folders = SharedFolder::whereIn('id', $showIds)
            ->withCount([
                    'sharedFiles as files_count',
                    'sharedFiles as tasks_count' => fn ($q) => $q->whereHas('file', fn ($fq) => $fq->where('is_task', true)),
                    'children',
                    'accesses',
                ])
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        $myAccesses = SharedFolderAccess::where('user_id', $user->id)
            ->whereIn('shared_folder_id', $showIds)
            ->get()
            ->keyBy('shared_folder_id');

        $items = $folders->map(function (SharedFolder $folder) use ($user, $myAccesses) {
            return $this->formatFolder($folder, $user, $myAccesses->get($folder->id));
        });

        return $this->success('Shared folders fetched', ['items' => $items]);
    }

    /**
     * GET /api/v1/shared-folders/all-flat
     * All accessible folders including subfolders, for tree-picker UI.
     */
    public function allFlat(Request $request): JsonResponse
    {
        $user = $request->user();

        $ownedRootIds  = SharedFolder::where('owner_id', $user->id)->whereNull('parent_id')->pluck('id');
        $accessRootIds = SharedFolderAccess::where('user_id', $user->id)->pluck('shared_folder_id');
        $rootIds       = $ownedRootIds->merge($accessRootIds)->unique();

        // BFS to collect all descendants
        $all       = SharedFolder::whereIn('id', $rootIds)->withCount(['children', 'accesses'])->get();
        $nextIds   = $all->pluck('id');

        while ($nextIds->isNotEmpty()) {
            $children = SharedFolder::whereIn('parent_id', $nextIds)->withCount(['children', 'accesses'])->get();
            if ($children->isEmpty()) break;
            $all     = $all->merge($children);
            $nextIds = $children->pluck('id');
        }

        $myAccesses = SharedFolderAccess::where('user_id', $user->id)
            ->whereIn('shared_folder_id', $all->pluck('id'))
            ->get()->keyBy('shared_folder_id');

        $items = $all->map(fn (SharedFolder $f) => $this->formatFolder($f, $user, $myAccesses->get($f->id)));

        return $this->success('All shared folders', ['items' => $items]);
    }

    /**
     * POST /api/v1/shared-folders
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'        => 'required|string|max:100',
            'folder_type' => 'nullable|string|in:default,gallery,movies',
        ]);

        $folder = SharedFolder::create([
            'owner_id'    => $request->user()->id,
            'name'        => $data['name'],
            'folder_type' => $data['folder_type'] ?? 'default',
        ]);

        $folder->files_count    = 0;
        $folder->children_count = 0;

        return $this->success('Shared folder created', [
            'folder' => $this->formatFolder($folder, $request->user()),
        ], 201);
    }

    /**
     * POST /api/v1/shared-folders/{id}/subfolders
     * Create a nested folder inside an existing shared folder.
     * Requires edit access on the parent.
     */
    public function createSubfolder(Request $request, string $id): JsonResponse
    {
        $parent = SharedFolder::find($id);
        if (!$parent) {
            return $this->notFound('Shared folder not found');
        }

        if (!$this->canAccess($request->user(), $parent, SharedFolderAccessType::Edit->value)) {
            return $this->forbidden('Edit access required to create subfolders');
        }

        $data = $request->validate([
            'name'        => 'required|string|max:100',
            'folder_type' => 'nullable|string|in:default,gallery,movies',
        ]);

        $folder = SharedFolder::create([
            'owner_id'    => $request->user()->id,
            'parent_id'   => $parent->id,
            'name'        => $data['name'],
            'folder_type' => $data['folder_type'] ?? 'default',
        ]);

        $folder->files_count    = 0;
        $folder->children_count = 0;

        return $this->success('Subfolder created', [
            'folder' => $this->formatFolder($folder, $request->user()),
        ], 201);
    }

    /**
     * GET /api/v1/shared-folders/{id}/subfolders
     * List direct children of a shared folder.
     */
    public function subfolders(Request $request, string $id): JsonResponse
    {
        $parent = SharedFolder::find($id);
        if (!$parent) {
            return $this->notFound('Shared folder not found');
        }

        if (!$this->canAccess($request->user(), $parent)) {
            return $this->forbidden();
        }

        $user    = $request->user();
        $isOwner = $parent->owner_id === $user->id;

        $taskStatus = $request->get('task_status') ?: null;
        $dateFrom   = $request->get('task_date_from') ?: null;
        $dateTo     = $request->get('task_date_to')   ?: null;

        $children = SharedFolder::where('parent_id', $id)
            ->when(!$isOwner, fn ($q) => $q->where('is_private', false))
            ->withCount([
                    'sharedFiles as files_count',
                    'sharedFiles as tasks_count' => fn ($q) => $q->whereHas('file', function ($fq) use ($taskStatus, $dateFrom, $dateTo) {
                        $fq->where('is_task', true);
                        if ($taskStatus) {
                            $fq->where('task_status', $taskStatus);
                        }
                        if ($dateFrom !== null || $dateTo !== null) {
                            $fq->where(fn ($q2) => $q2->whereNotNull('task_start_date')->orWhereNotNull('task_due_date'));
                            if ($dateTo !== null) {
                                $fq->where(fn ($q2) => $q2->whereNull('task_start_date')->orWhere('task_start_date', '<=', $dateTo));
                            }
                            if ($dateFrom !== null) {
                                $fq->where(fn ($q2) => $q2->whereNull('task_due_date')->orWhere('task_due_date', '>=', $dateFrom));
                            }
                        }
                    }),
                    'children',
                    'accesses',
                ])
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        $myAccesses = SharedFolderAccess::where('user_id', $user->id)
            ->whereIn('shared_folder_id', $children->pluck('id'))
            ->get()
            ->keyBy('shared_folder_id');

        $items = $children->map(function (SharedFolder $folder) use ($user, $myAccesses) {
            return $this->formatFolder($folder, $user, $myAccesses->get($folder->id));
        });

        return $this->success('Subfolders fetched', ['items' => $items]);
    }

    /**
     * PATCH /api/v1/shared-folders/{id}
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $folder = SharedFolder::find($id);
        if (!$folder) {
            return $this->notFound('Shared folder not found');
        }

        if ($folder->owner_id !== $request->user()->id) {
            return $this->forbidden('Only the owner can rename this folder');
        }

        $data = $request->validate([
            'name'        => 'required|string|max:100',
            'sort_order'  => 'nullable|integer|min:0',
            'folder_type' => 'nullable|string|in:default,gallery,movies',
        ]);
        $folder->update(array_filter($data, fn ($v) => $v !== null) + ['name' => $data['name']]);

        $folder->loadCount([
            'sharedFiles as files_count',
            'sharedFiles as tasks_count' => fn ($q) => $q->whereHas('file', fn ($fq) => $fq->where('is_task', true)),
            'children',
            'accesses',
        ]);

        return $this->success('Shared folder updated', [
            'folder' => $this->formatFolder($folder, $request->user()),
        ]);
    }

    /**
     * DELETE /api/v1/shared-folders/{id}
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $folder = SharedFolder::find($id);
        if (!$folder) {
            return $this->notFound('Shared folder not found');
        }

        if ($folder->owner_id !== $request->user()->id) {
            return $this->forbidden('Only the owner can delete this folder');
        }

        DB::transaction(function () use ($folder) {
            $allIds = $this->collectDescendantIds($folder->id);
            $allIds[] = $folder->id;

            // Find shared_folder_only files that will become orphans (not in any other SF)
            $orphanFileIds = SharedFolderFile::whereIn('shared_folder_id', $allIds)
                ->join('files', 'files.id', '=', 'shared_folder_files.file_id')
                ->where('files.shared_folder_only', true)
                ->whereNotIn('shared_folder_files.file_id', function ($q) use ($allIds) {
                    $q->select('file_id')
                      ->from('shared_folder_files')
                      ->whereNotIn('shared_folder_id', $allIds);
                })
                ->pluck('shared_folder_files.file_id')
                ->toArray();

            SharedFolderFile::whereIn('shared_folder_id', $allIds)->delete();
            SharedFolderAccess::whereIn('shared_folder_id', $allIds)->delete();
            SharedFolderLink::whereIn('shared_folder_id', $allIds)->delete();
            SharedFolderCommentSettings::whereIn('shared_folder_id', $allIds)->delete();
            PendingReceivedSharedFolder::whereIn('shared_folder_id', $allIds)->delete();
            SharedFolder::whereIn('id', $allIds)->delete();

            if (!empty($orphanFileIds)) {
                \App\Models\File::whereIn('id', $orphanFileIds)->update(['shared_folder_only' => false]);
            }
        });

        return $this->success('Shared folder deleted');
    }

    /**
     * DELETE /api/v1/shared-folders/{id}/leave
     * Non-owner removes themselves from a shared folder.
     */
    public function leave(Request $request, string $id): JsonResponse
    {
        $user   = $request->user();
        $folder = SharedFolder::find($id);

        if (!$folder) {
            return $this->notFound('Shared folder not found');
        }

        if ($folder->owner_id === $user->id) {
            return $this->error('Owner cannot leave their own folder', 'OWNER_CANNOT_LEAVE', [], 422);
        }

        $access = SharedFolderAccess::where('shared_folder_id', $id)
            ->where('user_id', $user->id)
            ->first();

        if (!$access) {
            return $this->notFound('You are not a member of this folder');
        }

        $accessType = $access->access_type instanceof \BackedEnum
            ? $access->access_type->value
            : (string) $access->access_type;

        $access->delete();

        if (!($user->auto_add_received_files ?? true)) {
            PendingReceivedSharedFolder::firstOrCreate([
                'shared_folder_id'  => $folder->id,
                'recipient_user_id' => $user->id,
            ], [
                'inviter_user_id' => $folder->owner_id,
                'access_type'     => $accessType,
            ]);
        }

        return $this->success('You have left the shared folder');
    }

    // ─── Files ────────────────────────────────────────────────────────────────

    /**
     * GET /api/v1/shared-folders/{id}/files
     */
    public function files(Request $request, string $id): JsonResponse
    {
        $folder = SharedFolder::find($id);
        if (!$folder) {
            return $this->notFound('Shared folder not found');
        }

        $user = $request->user();
        if (!$this->canAccess($user, $folder, SharedFolderAccessType::View->value)) {
            return $this->forbidden();
        }

        $page    = (int) $request->get('page', 1);
        $perPage = (int) $request->get('per_page', 20);
        $isOwner = $folder->owner_id === $user->id;

        $isTaskFilter = $request->has('is_task')
            ? filter_var($request->get('is_task'), FILTER_VALIDATE_BOOLEAN)
            : null;

        $baseQuery = SharedFolderFile::where('shared_folder_id', $id)
            ->whereHas('file', function ($q) use ($isTaskFilter) {
                if ($isTaskFilter !== null) {
                    $q->where('is_task', $isTaskFilter);
                }
            })
            ->when(!$isOwner, fn ($q) => $q->where('is_private', false));

        if ($request->get('task_status')) {
            $baseQuery->whereHas('file', fn ($q) => $q->where('task_status', $request->get('task_status')));
        }
        if ($request->get('task_assigned_user_id')) {
            $baseQuery->whereHas('file', fn ($q) => $q->where('task_assigned_user_id', $request->get('task_assigned_user_id')));
        }
        $dateFrom = $request->get('task_date_from') ?: null;
        $dateTo   = $request->get('task_date_to')   ?: null;
        if ($dateFrom !== null || $dateTo !== null) {
            $baseQuery->whereHas('file', function ($q) use ($dateFrom, $dateTo) {
                $q->where(fn ($q2) => $q2->whereNotNull('task_start_date')->orWhereNotNull('task_due_date'));
                if ($dateTo !== null) {
                    $q->where(fn ($q2) => $q2->whereNull('task_start_date')->orWhere('task_start_date', '<=', $dateTo));
                }
                if ($dateFrom !== null) {
                    $q->where(fn ($q2) => $q2->whereNull('task_due_date')->orWhere('task_due_date', '>=', $dateFrom));
                }
            });
        }

        $total = $baseQuery->count();

        $sharedFiles = $baseQuery->with(['file', 'file.owner'])
            ->offset(($page - 1) * $perPage)
            ->limit($perPage)
            ->get();

        // Batch-load likes and comment counts to avoid N+1 queries
        $fileIds = $sharedFiles->pluck('file.id')->filter()->all();
        if (!empty($fileIds)) {
            $likeCounts = FileLike::whereIn('file_id', $fileIds)
                ->selectRaw('file_id, COUNT(*) as cnt')
                ->groupBy('file_id')
                ->pluck('cnt', 'file_id')
                ->all();
            $likedSet = FileLike::where('user_id', $user->id)
                ->whereIn('file_id', $fileIds)
                ->pluck('file_id')
                ->flip()
                ->all();
            $commentCounts = DB::table('comment_threads')
                ->where('target_type', 'file')
                ->whereIn('target_id', $fileIds)
                ->where('scope', 'shared')
                ->select('target_id', DB::raw('SUM(comments_count) as cnt'))
                ->groupBy('target_id')
                ->pluck('cnt', 'target_id')
                ->all();

            foreach ($sharedFiles as $sf) {
                if ($sf->file) {
                    $sf->file->setAttribute('likes_count_cached',    $likeCounts[$sf->file->id] ?? 0);
                    $sf->file->setAttribute('is_liked_cached',       isset($likedSet[$sf->file->id]));
                    $sf->file->setAttribute('comments_count_cached', $commentCounts[$sf->file->id] ?? 0);
                }
            }
        }

        $items = $sharedFiles
            ->filter(fn (SharedFolderFile $sf) => $sf->file !== null)
            ->map(function (SharedFolderFile $sf) use ($user) {
                $card = $this->cardBuilder->buildListItem($sf->file, $user, $sf->added_by);
                $card['is_private'] = (bool) $sf->is_private;
                return $card;
            })
            ->values();

        $typeRows = DB::table('shared_folder_files')
            ->join('files', 'shared_folder_files.file_id', '=', 'files.id')
            ->where('shared_folder_files.shared_folder_id', $id)
            ->when(!$isOwner, fn ($q) => $q->where('shared_folder_files.is_private', false))
            ->select('files.mime_type', 'files.content_kind')
            ->distinct()
            ->get();

        $availableTypeGroups = [];
        foreach ($typeRows as $row) {
            $g = $this->mime->classify($row->content_kind ?? 'binary_file', $row->mime_type ?? '');
            $availableTypeGroups[$g] = true;
        }

        return $this->success('Files fetched', [
            'items'      => $items,
            'pagination' => [
                'page'                  => $page,
                'per_page'              => $perPage,
                'total'                 => $total,
                'available_type_groups' => array_keys($availableTypeGroups),
            ],
        ]);
    }

    /**
     * POST /api/v1/shared-folders/{id}/init-upload
     */
    public function initUpload(Request $request, string $id): JsonResponse
    {
        $folder = SharedFolder::find($id);
        if (!$folder) {
            return $this->notFound('Shared folder not found');
        }

        $user = $request->user();
        if (!$this->canAccess($user, $folder, SharedFolderAccessType::Edit->value)) {
            return $this->forbidden('Edit access required');
        }

        $data = $request->validate([
            'original_name'  => 'required|string|max:255',
            'size'           => 'required|integer|min:1',
            'mime_type'      => 'required|string|max:100',
            'checksum'       => 'nullable|string|max:64',
            'thumbnail_name' => 'nullable|string|max:255',
            'thumbnail_size' => 'nullable|integer|min:1',
            'thumbnail_mime' => 'nullable|string|max:100',
        ]);

        if ($folder->folder_type === 'gallery') {
            $mime = $data['mime_type'] ?? '';
            if (!str_starts_with($mime, 'image/') && !str_starts_with($mime, 'video/')) {
                return $this->error(
                    'В мультимедиа-папку можно загружать только фото и видео',
                    'GALLERY_TYPE_MISMATCH',
                    [],
                    422
                );
            }
        }

        if ($error = $this->fileService->validateFileSizeLimit($user, $data['size'])) {
            return $this->error('File size exceeds plan limit', $error['code'], $error['data'], 422);
        }

        if ($error = $this->fileService->validateStorageQuota($user, $data['size'])) {
            return $this->error('Storage quota exceeded', $error['code'], [], 422);
        }

        return DB::transaction(function () use ($user, $folder, $data): JsonResponse {
            $result = $this->fileService->initUpload($user, $data);

            $fileId = $result['file']['id'];

            // Mark as shared_folder_only and link to this shared folder
            File::where('id', $fileId)->update(['shared_folder_only' => true]);

            SharedFolderFile::create([
                'shared_folder_id' => $folder->id,
                'file_id'          => $fileId,
                'added_by'         => $user->id,
            ]);

            return $this->success('Upload initialized', $result, 201);
        });
    }

    /**
     * POST /api/v1/shared-folders/{id}/complete-upload
     */
    public function completeUpload(Request $request, string $id): JsonResponse
    {
        $folder = SharedFolder::find($id);
        if (!$folder) {
            return $this->notFound('Shared folder not found');
        }

        $user = $request->user();
        if (!$this->canAccess($user, $folder, SharedFolderAccessType::Edit->value)) {
            return $this->forbidden('Edit access required');
        }

        $data = $request->validate([
            'file_id'       => 'required|string',
            'thumbnail_key' => 'nullable|string',
        ]);

        $file = File::find($data['file_id']);
        if (!$file) {
            return $this->notFound('File not found');
        }

        if (!$file->isOwnedBy($user)) {
            return $this->forbidden();
        }

        $result = $this->fileService->completeUpload($file, $user, $request->input('thumbnail_key'));

        $this->notifyFolderMembers($folder, $user, 'file', $file->id);

        return $this->success('Upload completed', $result);
    }

    /**
     * POST /api/v1/shared-folders/{id}/url-file
     */
    public function addUrlFile(Request $request, string $id): JsonResponse
    {
        $folder = SharedFolder::find($id);
        if (!$folder) {
            return $this->notFound('Shared folder not found');
        }

        $user = $request->user();
        if (!$this->canAccess($user, $folder, SharedFolderAccessType::Edit->value)) {
            return $this->forbidden('Edit access required');
        }

        $data = $request->validate([
            'url'               => 'required|url|max:2048',
            'preview'           => 'nullable|array',
            'preview.title'     => 'nullable|string|max:500',
            'preview.image_url' => 'nullable|url|max:2048',
            'preview.site_name' => 'nullable|string|max:200',
        ]);

        return DB::transaction(function () use ($user, $folder, $data): JsonResponse {
            $clientPreview = $data['preview'] ?? null;
            $preview = ($clientPreview && !empty($clientPreview['title']))
                ? array_merge(['image_url' => null, 'site_name' => null, 'description' => null, 'hostname' => parse_url($data['url'], PHP_URL_HOST) ?? ''], $clientPreview)
                : $this->previewService->fetch($data['url']);

            $result = $this->fileService->createUrlFile($user, $data['url'], $preview);

            $fileId = $result['file']['id'];

            // Mark as shared_folder_only
            File::where('id', $fileId)->update(['shared_folder_only' => true]);

            SharedFolderFile::firstOrCreate([
                'shared_folder_id' => $folder->id,
                'file_id'          => $fileId,
            ], [
                'added_by' => $user->id,
            ]);

            $this->notifyFolderMembers($folder, $user, 'link');

            return $this->success('URL file added', $result, 201);
        });
    }

    // ─── Accesses ─────────────────────────────────────────────────────────────

    /**
     * GET /api/v1/shared-folders/{id}/accesses
     */
    public function listAccesses(Request $request, string $id): JsonResponse
    {
        $folder = SharedFolder::find($id);
        if (!$folder) {
            return $this->notFound('Shared folder not found');
        }

        if ($folder->owner_id !== $request->user()->id) {
            return $this->forbidden();
        }

        $accesses = $folder->accesses()->with('user:id,email,name')->get()->map(fn (SharedFolderAccess $a) => [
            'id'          => $a->id,
            'user_id'     => $a->user_id,
            'contact_id'  => $a->contact_id,
            'access_type' => $a->access_type?->value,
            'user'        => $a->user ? [
                'id'    => $a->user->id,
                'email' => $a->user->email,
                'name'  => $a->user->name,
            ] : null,
        ]);

        return $this->success('Accesses fetched', ['items' => $accesses]);
    }

    /**
     * POST /api/v1/shared-folders/{id}/accesses
     */
    public function addAccess(Request $request, string $id): JsonResponse
    {
        $folder = SharedFolder::find($id);
        if (!$folder) {
            return $this->notFound('Shared folder not found');
        }

        if ($folder->owner_id !== $request->user()->id) {
            return $this->forbidden();
        }

        $data = $request->validate([
            'contact_id'  => 'required|string',
            'access_type' => 'required|in:' . SharedFolderAccessType::View->value . ',' . SharedFolderAccessType::Edit->value,
        ]);

        // Find contact belonging to the folder owner
        $contact = Contact::where('id', $data['contact_id'])
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$contact) {
            return $this->notFound('Contact not found');
        }

        $resolvedUserId = $contact->resolved_user_id;

        // Check for duplicate access
        $existingQuery = SharedFolderAccess::where('shared_folder_id', $folder->id);
        if ($resolvedUserId) {
            $existingQuery->where('user_id', $resolvedUserId);
        } else {
            $existingQuery->where('contact_id', $contact->id);
        }

        if ($existingQuery->exists()) {
            return $this->error('Access already exists for this contact', 'DUPLICATE_ACCESS', [], 422);
        }

        $recipientUser = $resolvedUserId ? User::find($resolvedUserId) : null;
        $autoAdd = $recipientUser ? ($recipientUser->auto_add_received_files ?? true) : true;

        if (!$autoAdd) {
            PendingReceivedSharedFolder::firstOrCreate([
                'shared_folder_id' => $folder->id,
                'recipient_user_id' => $recipientUser->id,
            ], [
                'inviter_user_id' => $request->user()->id,
                'access_type'     => $data['access_type'],
            ]);

            $senderName = $request->user()->name ?? $request->user()->email;
            $this->pushService->sendToUser(
                $recipientUser,
                'Приглашение в общую папку',
                "{$senderName} приглашает вас в папку «{$folder->name}»",
                config('app.url') . '/communication/received',
            );
            $this->notificationService->notifyFolderShared(
                $recipientUser,
                $senderName,
                $folder->name,
                $folder->id,
            );

            return $this->success('Access pending recipient approval', [
                'access' => [
                    'id'          => null,
                    'user_id'     => $resolvedUserId,
                    'contact_id'  => $contact->id,
                    'access_type' => $data['access_type'],
                    'pending'     => true,
                    'user'        => $recipientUser ? [
                        'id'    => $recipientUser->id,
                        'email' => $recipientUser->email,
                        'name'  => $recipientUser->name,
                    ] : null,
                ],
            ], 201);
        }

        $access = SharedFolderAccess::create([
            'shared_folder_id' => $folder->id,
            'user_id'          => $resolvedUserId,
            'contact_id'       => $contact->id,
            'access_type'      => $data['access_type'],
        ]);

        $access->load('user:id,email,name');

        if ($access->user) {
            $senderName = $request->user()->name ?? $request->user()->email;
            $accessLabel = $data['access_type'] === SharedFolderAccessType::Edit->value ? 'редактирование' : 'просмотр';
            $this->pushService->sendToUser(
                $access->user,
                'Доступ к общей папке',
                "{$senderName} открыл вам доступ ({$accessLabel}) к папке «{$folder->name}»",
                config('app.url') . '/folders?tab=shared&shared_folder_id=' . $folder->id,
            );
            $this->notificationService->notifyFolderShared(
                $access->user,
                $senderName,
                $folder->name,
                $folder->id,
            );
        }

        return $this->success('Access granted', [
            'access' => [
                'id'          => $access->id,
                'user_id'     => $access->user_id,
                'contact_id'  => $access->contact_id,
                'access_type' => $access->access_type?->value,
                'user'        => $access->user ? [
                    'id'    => $access->user->id,
                    'email' => $access->user->email,
                    'name'  => $access->user->name,
                ] : null,
            ],
        ], 201);
    }

    /**
     * DELETE /api/v1/shared-folders/{id}/accesses/{accessId}
     */
    public function removeAccess(Request $request, string $id, string $accessId): JsonResponse
    {
        $folder = SharedFolder::find($id);
        if (!$folder) {
            return $this->notFound('Shared folder not found');
        }

        if ($folder->owner_id !== $request->user()->id) {
            return $this->forbidden();
        }

        $access = SharedFolderAccess::where('id', $accessId)
            ->where('shared_folder_id', $id)
            ->first();

        if (!$access) {
            return $this->notFound('Access record not found');
        }

        $access->delete();

        return $this->success('Access removed');
    }

    // ─── Links ────────────────────────────────────────────────────────────────

    /**
     * GET /api/v1/shared-folders/{id}/links
     */
    public function listLinks(Request $request, string $id): JsonResponse
    {
        $folder = SharedFolder::find($id);
        if (!$folder) {
            return $this->notFound('Shared folder not found');
        }

        if ($folder->owner_id !== $request->user()->id) {
            return $this->forbidden();
        }

        $links = $folder->links()->get()->map(fn (SharedFolderLink $link) => [
            'id'          => $link->id,
            'url'         => $link->url,
            'status'      => $link->status,
            'access_type' => $link->access_type?->value,
            'allow_save'  => $link->allow_save,
            'ttl_hours'   => $link->ttl_hours,
            'expires_at'  => $link->expires_at?->toIso8601String(),
            'created_at'  => $link->created_at?->toIso8601String(),
        ]);

        return $this->success('Links fetched', ['items' => $links]);
    }

    /**
     * POST /api/v1/shared-folders/{id}/links
     */
    public function createLink(Request $request, string $id): JsonResponse
    {
        $folder = SharedFolder::find($id);
        if (!$folder) {
            return $this->notFound('Shared folder not found');
        }

        if ($folder->owner_id !== $request->user()->id) {
            return $this->forbidden();
        }

        $data = $request->validate([
            'access_type' => 'required|in:' . SharedFolderAccessType::View->value . ',' . SharedFolderAccessType::Edit->value,
            'ttl_hours'   => 'required|integer|in:1,6,12,24,72,168,720',
            'allow_save'  => 'nullable|boolean',
        ]);

        $link = SharedFolderLink::create([
            'shared_folder_id' => $folder->id,
            'created_by'       => $request->user()->id,
            'access_type'      => $data['access_type'],
            'allow_save'       => $data['allow_save'] ?? false,
            'status'           => ShareLinkStatus::Active->value,
            'ttl_hours'        => $data['ttl_hours'],
            'expires_at'       => now()->addHours($data['ttl_hours']),
        ]);

        return $this->success('Link created', [
            'link' => [
                'id'          => $link->id,
                'url'         => $link->url,
                'status'      => $link->status,
                'access_type' => $link->access_type?->value,
                'allow_save'  => $link->allow_save,
                'ttl_hours'   => $link->ttl_hours,
                'expires_at'  => $link->expires_at?->toIso8601String(),
                'created_at'  => $link->created_at?->toIso8601String(),
            ],
        ], 201);
    }

    /**
     * POST /api/v1/shared-folders/{id}/links/{linkId}/disable
     */
    public function disableLink(Request $request, string $id, string $linkId): JsonResponse
    {
        $folder = SharedFolder::find($id);
        if (!$folder) {
            return $this->notFound('Shared folder not found');
        }

        if ($folder->owner_id !== $request->user()->id) {
            return $this->forbidden();
        }

        $link = SharedFolderLink::where('id', $linkId)
            ->where('shared_folder_id', $id)
            ->first();

        if (!$link) {
            return $this->notFound('Link not found');
        }

        $link->update(['status' => ShareLinkStatus::Disabled->value]);

        return $this->success('Link disabled');
    }

    // ─── Public ───────────────────────────────────────────────────────────────

    /**
     * GET /api/v1/shared-links/{token}/files  (PUBLIC)
     */
    public function publicFiles(Request $request, string $token): JsonResponse
    {
        $link = SharedFolderLink::where('token', $token)->with('folder')->first();

        if (!$link || !$link->isValid()) {
            return $this->error('Invalid or expired link', 'LINK_INVALID', [], 410);
        }

        $page    = (int) $request->get('page', 1);
        $perPage = (int) $request->get('per_page', 20);
        $folderId = $link->shared_folder_id;

        $total = SharedFolderFile::where('shared_folder_id', $folderId)->count();

        $sharedFiles = SharedFolderFile::where('shared_folder_id', $folderId)
            ->with('file')
            ->offset(($page - 1) * $perPage)
            ->limit($perPage)
            ->get();

        $items = $sharedFiles
            ->filter(fn (SharedFolderFile $sf) => $sf->file !== null)
            ->map(fn (SharedFolderFile $sf) => $this->cardBuilder->buildPublicItem($sf->file))
            ->values();

        return $this->success('Files fetched', [
            'items'      => $items,
            'pagination' => ['page' => $page, 'per_page' => $perPage, 'total' => $total],
        ]);
    }

    // ─── Personal root ────────────────────────────────────────────────────────

    /**
     * POST /api/v1/shared-folders/ensure-root
     * Finds or creates the user's personal root shared folder.
     */
    public function ensurePersonalRoot(Request $request): JsonResponse
    {
        $user = $request->user();

        $folder = SharedFolder::where('owner_id', $user->id)
            ->where('is_personal_root', true)
            ->first();

        if (!$folder) {
            $folder = SharedFolder::create([
                'owner_id'          => $user->id,
                'name'              => 'Мои файлы',
                'is_personal_root'  => true,
            ]);
        }

        $folder->loadCount([
            'sharedFiles as files_count',
            'sharedFiles as tasks_count' => fn ($q) => $q->whereHas('file', fn ($fq) => $fq->where('is_task', true)),
            'children',
            'accesses',
        ]);

        return $this->success('Personal root folder', [
            'folder' => $this->formatFolder($folder, $user),
        ]);
    }

    // ─── Privacy ──────────────────────────────────────────────────────────────

    /**
     * PATCH /api/v1/shared-folders/{id}/files/{fileId}/privacy
     * Only the folder owner can mark files as private.
     */
    public function setFilePrivacy(Request $request, string $id, string $fileId): JsonResponse
    {
        $folder = SharedFolder::find($id);
        if (!$folder) {
            return $this->notFound('Shared folder not found');
        }

        if ($folder->owner_id !== $request->user()->id) {
            return $this->forbidden('Only the folder owner can mark files as private');
        }

        $data = $request->validate(['is_private' => 'required|boolean']);

        SharedFolderFile::where('shared_folder_id', $id)
            ->where('file_id', $fileId)
            ->update(['is_private' => $data['is_private']]);

        return $this->success('File privacy updated');
    }

    /**
     * PATCH /api/v1/shared-folders/{id}/privacy
     * Owner of this subfolder marks it private (hidden from parent folder guests).
     */
    public function setFolderPrivacy(Request $request, string $id): JsonResponse
    {
        $folder = SharedFolder::find($id);
        if (!$folder) {
            return $this->notFound('Shared folder not found');
        }

        if ($folder->owner_id !== $request->user()->id) {
            return $this->forbidden('Only the folder owner can change its privacy');
        }

        $data = $request->validate(['is_private' => 'required|boolean']);
        $folder->update(['is_private' => $data['is_private']]);

        $folder->loadCount([
            'sharedFiles as files_count',
            'sharedFiles as tasks_count' => fn ($q) => $q->whereHas('file', fn ($fq) => $fq->where('is_task', true)),
            'children',
            'accesses',
        ]);

        return $this->success('Folder privacy updated', [
            'folder' => $this->formatFolder($folder, $request->user()),
        ]);
    }

    /**
     * POST /api/v1/shared-links/{token}/resolve  (PUBLIC)
     */
    public function resolveSharedLink(Request $request, string $token): JsonResponse
    {
        $link = SharedFolderLink::where('token', $token)->with('folder')->first();

        if (!$link) {
            return $this->notFound('Link not found');
        }

        if (!$link->isValid()) {
            return $this->error('This link has expired or been disabled', 'LINK_INVALID', [], 410);
        }

        // Auto-grant access to authenticated user if not the owner
        $user = Auth::guard('sanctum')->user();
        if ($user && $link->folder->owner_id !== $user->id) {
            SharedFolderAccess::firstOrCreate(
                ['shared_folder_id' => $link->folder->id, 'user_id' => $user->id],
                ['access_type' => $link->access_type, 'contact_id' => null]
            );
        }

        return $this->success('Link resolved', [
            'folder' => [
                'id'   => $link->folder->id,
                'name' => $link->folder->name,
            ],
            'link'   => [
                'access_type' => $link->access_type?->value,
                'allow_save'  => $link->allow_save,
            ],
        ]);
    }
}
