<?php

namespace App\Http\Controllers\Files;

use App\Enums\AccessType;
use App\Enums\ActivityType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Files\InitUploadRequest;
use App\Http\Requests\Files\CompleteUploadRequest;
use App\Models\File;
use App\Models\FileUserAccess;
use App\Models\Folder;
use App\Models\PendingReceivedFile;
use App\Services\FileService;
use App\Services\ActivityService;
use App\Services\S3UrlService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class FileController extends Controller
{
    public function __construct(
        private readonly FileService     $fileService,
        private readonly ActivityService $activityService,
        private readonly S3UrlService    $s3,
    ) {}

    /**
     * GET /api/v1/files
     * List files for authenticated user (owned, shared, saved).
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate(['per_page' => 'nullable|integer|min:1|max:100']);

        $filter  = $request->get('filter', 'mine'); // mine | received | favorites
        $page    = (int) $request->get('page', 1);
        $perPage = (int) $request->get('per_page', 20);
        $search  = $request->get('search');

        $options = array_filter([
            'tag_id'                 => $request->get('tag_id'),
            'content_kind'           => $request->get('content_kind'),
            'file_type_group'        => $request->get('file_type_group'),
            'sort_by'                => $request->get('sort_by'),
            'sort_order'             => $request->get('sort_order'),
            'task_status'            => $request->get('task_status'),
            'task_assigned_user_id'  => $request->get('task_assigned_user_id'),
            'task_date_from'         => $request->get('task_date_from'),
            'task_date_to'           => $request->get('task_date_to'),
        ]);

        if ($request->has('is_task')) {
            $options['is_task'] = filter_var($request->get('is_task'), FILTER_VALIDATE_BOOLEAN);
        }

        // folder_id can be explicitly null (no-folder filter)
        // empty string sent from client means "root only" → treat as null
        if ($request->has('folder_id')) {
            $raw = $request->get('folder_id');
            $options['folder_id'] = ($raw === '' || $raw === null) ? null : $raw;
        }

        $result = $this->fileService->listFiles(
            $request->user(),
            $filter,
            $search,
            $page,
            $perPage,
            $options
        );

        return $this->success(__('messages.files.fetched'), $result);
    }

    /**
     * GET /api/v1/files/{fileId}
     * Get full file card.
     */
    public function show(Request $request, string $fileId): JsonResponse
    {
        $user = $request->user();
        $file = File::with(['owner', 'taskAssignee'])->find($fileId);

        if (!$file || !$this->fileService->canAccess($user, $file)) {
            return $this->notFound('File not found');
        }

        return $this->success(__('messages.files.fetched_one'), [
            'file' => $this->fileService->buildFileCard($file, $user),
        ]);
    }

    /**
     * DELETE /api/v1/files/{fileId}
     * Owner: logical delete. Non-owner: detach (remove access record).
     */
    public function destroy(Request $request, string $fileId): JsonResponse
    {
        $user = $request->user();
        $file = File::find($fileId);

        if (!$file) {
            return $this->notFound('File not found');
        }

        if ($file->isOwnedBy($user)) {
            $this->fileService->deleteFile($file, $user);
            return $this->success(__('messages.files.deleted'));
        }

        $detached = FileUserAccess::where('file_id', $file->id)
            ->where('user_id', $user->id)
            ->delete();

        if (!$detached) {
            return $this->notFound('File not found');
        }

        return $this->success(__('messages.files.deleted'));
    }

    /**
     * POST /api/v1/files/init-upload
     * Step 1 of upload flow: initialize upload, get S3 presigned URL.
     */
    public function initUpload(InitUploadRequest $request): JsonResponse
    {
        $fileSize = $request->validated()['size'];

        if ($error = $this->fileService->validateFileSizeLimit($request->user(), $fileSize)) {
            return $this->error(
                'Размер файла превышает допустимый лимит для вашего тарифа',
                $error['code'],
                $error['data'],
                422
            );
        }

        if ($error = $this->fileService->validateStorageQuota($request->user(), $fileSize)) {
            return $this->error('Превышен лимит хранилища вашего тарифного плана', $error['code'], [], 422);
        }

        $result = $this->fileService->initUpload($request->user(), $request->validated());

        return $this->success(__('messages.files.upload_initialized'), $result, 201);
    }

    /**
     * POST /api/v1/files/complete-upload
     * Step 3 of upload flow: confirm upload done, set file available.
     */
    public function completeUpload(CompleteUploadRequest $request): JsonResponse
    {
        $file = File::find($request->file_id);

        if (!$file) {
            return $this->notFound('File not found');
        }

        if (!$file->isOwnedBy($request->user())) {
            return $this->forbidden();
        }

        $result = $this->fileService->completeUpload(
            $file,
            $request->user(),
            $request->input('thumbnail_key')
        );

        return $this->success(__('messages.files.upload_completed'), $result);
    }

    /**
     * PATCH /api/v1/files/{fileId}/rename
     * Set display_name visible to all with access.
     * Owner can also clear it (revert to original_name).
     * Notes (is_editable markdown): only owner can rename (changes original_name).
     */
    public function rename(Request $request, string $fileId): JsonResponse
    {
        $request->validate([
            'display_name' => 'nullable|string|max:255',
        ]);

        $file = File::find($fileId);
        if (!$file || !$this->fileService->canAccess($request->user(), $file)) {
            return $this->notFound('File not found');
        }

        $isOwner = $file->isOwnedBy($request->user());

        // For markdown notes: only the owner can rename (it changes the document title)
        if ($file->isMarkdownDocument()) {
            if (!$isOwner) {
                return $this->forbidden();
            }
            $file->update([
                'original_name' => $request->input('display_name') ?? $file->original_name,
                'display_name'  => null,
            ]);
        } else {
            // For files and links: any user with access can set the shared display_name
            $file->update(['display_name' => $request->input('display_name')]);
        }

        return $this->success('File renamed', [
            'display_name'  => $file->display_name,
            'original_name' => $file->original_name,
        ]);
    }

    /**
     * PATCH /api/v1/files/{fileId}/description
     * Update per-user description for a file.
     */
    public function updateDescription(Request $request, string $fileId): JsonResponse
    {
        $request->validate(['description' => 'nullable|string|max:500']);

        $file = File::find($fileId);
        if (!$file || !$this->fileService->canAccess($request->user(), $file)) {
            return $this->notFound('File not found');
        }

        $access = FileUserAccess::firstOrCreate(
            ['file_id' => $file->id, 'user_id' => $request->user()->id],
            ['access_type' => AccessType::Saved->value]
        );

        $access->update(['description' => $request->input('description')]);

        return $this->success('Description updated', ['description' => $access->description]);
    }

    /**
     * POST /api/v1/files/{fileId}/cancel-upload
     */
    public function cancelUpload(Request $request, string $fileId): JsonResponse
    {
        $file = File::find($fileId);

        if (!$file || !$file->isOwnedBy($request->user())) {
            return $this->notFound('File not found');
        }

        $this->fileService->cancelUpload($file);

        return $this->success(__('messages.files.upload_cancelled'));
    }

    /**
     * POST /api/v1/files/{fileId}/download
     * Check access and return a signed download URL.
     */
    public function download(Request $request, string $fileId): JsonResponse
    {
        $file = File::find($fileId);

        if (!$file || !$this->fileService->canAccess($request->user(), $file)) {
            return $this->notFound('File not found');
        }

        if (!$file->isAvailable()) {
            return $this->error(__('messages.files.not_available'), 'FILE_NOT_AVAILABLE', [], 422);
        }

        $this->activityService->log($file, $request->user(), ActivityType::Downloaded);

        // URL files are returned as inline .url content
        if ($file->isUrlFile()) {
            $content  = $this->fileService->buildUrlFileContent($file);
            $filename = $file->original_name ?: 'link.url';
            return response($content, 200, [
                'Content-Type'        => 'application/internet-shortcut',
                'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            ]);
        }

        $url = $this->fileService->generateDownloadUrl($file);

        if (!$url) {
            return $this->error('Storage service unavailable', 'S3_ERROR', [], 503);
        }

        return $this->success(__('messages.files.download_url'), [
            'url'        => $url,
            'expires_in' => config('filesystems.disks.s3.presigned_url_ttl', 3600),
        ]);
    }

    /**
     * GET /api/v1/files/{fileId}/content
     * Stable application URL for file content (used in markdown documents).
     * Checks access and redirects to a fresh presigned S3 URL.
     */
    public function content(Request $request, string $fileId): \Illuminate\Http\RedirectResponse|\Illuminate\Http\Response
    {
        $file = File::find($fileId);

        if (!$file || !$file->isAvailable() || $file->isUrlFile()) {
            abort(404);
        }

        if (!$this->fileService->canAccess($request->user(), $file)) {
            abort(403);
        }

        $url = $this->s3->contentRedirectUrl($file->storage_key);
        if (!$url) { abort(503); }

        return redirect()->away($url);
    }

    /**
     * GET /api/v1/files/{fileId}/text-content
     * Return the raw UTF-8 text of a small plain-text file for read-only in-app
     * viewing (.txt, .log, .csv, …). Read server-side from S3 to avoid CORS.
     */
    public function textContent(Request $request, string $fileId): JsonResponse
    {
        $file = File::find($fileId);

        if (!$file || !$file->isAvailable() || $file->isUrlFile()) {
            return $this->notFound('File not found');
        }

        if (!$this->fileService->canAccess($request->user(), $file)) {
            return $this->forbidden();
        }

        if (!$this->fileService->isPlainTextViewable($file)) {
            return $this->error('File is not a viewable text format', 'NOT_TEXT_VIEWABLE', [], 422);
        }

        $maxBytes = 1024 * 1024; // 1 MB cap for inline preview
        if ((int) ($file->size ?? 0) > $maxBytes) {
            return $this->error('File is too large to preview', 'TEXT_TOO_LARGE', ['max_bytes' => $maxBytes], 422);
        }

        try {
            $content = Storage::disk('s3')->get($file->storage_key);
        } catch (\Throwable) {
            return $this->error('Storage service unavailable', 'S3_ERROR', [], 503);
        }

        if ($content === null) {
            return $this->notFound('File content not found');
        }

        // Guarantee valid UTF-8 so the JSON response never breaks on binary bytes.
        if (!mb_check_encoding($content, 'UTF-8')) {
            $content = mb_convert_encoding($content, 'UTF-8', 'UTF-8');
        }

        return $this->success('Text content', ['content' => $content]);
    }

    /**
     * GET /api/v1/files/{fileId}/preview
     * Stable preview URL (thumbnail if available, otherwise content).
     */
    public function preview(Request $request, string $fileId): \Illuminate\Http\RedirectResponse|\Illuminate\Http\Response
    {
        $file = File::find($fileId);

        if (!$file || !$file->isAvailable() || $file->isUrlFile()) {
            abort(404);
        }

        if (!$this->fileService->canAccess($request->user(), $file)) {
            abort(403);
        }

        $key = $file->thumbnail_key ?? $file->storage_key;
        $url = $this->s3->previewRedirectUrl($key);
        if (!$url) { abort(503); }

        return redirect()->away($url);
    }

    /**
     * POST /api/v1/files/{fileId}/pin
     */
    public function pin(Request $request, string $fileId): JsonResponse
    {
        $file = File::find($fileId);
        if (!$file || !$this->fileService->canAccess($request->user(), $file)) {
            return $this->notFound('File not found');
        }

        $this->fileService->pin($file, $request->user());

        return $this->success(__('messages.files.pinned'));
    }

    /**
     * POST /api/v1/files/{fileId}/unpin
     */
    public function unpin(Request $request, string $fileId): JsonResponse
    {
        $file = File::find($fileId);
        if (!$file || !$this->fileService->canAccess($request->user(), $file)) {
            return $this->notFound('File not found');
        }

        $this->fileService->unpin($file, $request->user());

        return $this->success(__('messages.files.unpinned'));
    }

    /**
     * POST /api/v1/files/{fileId}/favorite
     */
    public function favorite(Request $request, string $fileId): JsonResponse
    {
        $file = File::find($fileId);
        if (!$file || !$this->fileService->canAccess($request->user(), $file)) {
            return $this->notFound('File not found');
        }

        $this->fileService->setFavorite($file, $request->user(), true);

        return $this->success(__('messages.files.favorited'));
    }

    /**
     * POST /api/v1/files/{fileId}/unfavorite
     */
    public function unfavorite(Request $request, string $fileId): JsonResponse
    {
        $file = File::find($fileId);
        if (!$file || !$this->fileService->canAccess($request->user(), $file)) {
            return $this->notFound('File not found');
        }

        $this->fileService->setFavorite($file, $request->user(), false);

        return $this->success(__('messages.files.unfavorited'));
    }

    /**
     * POST /api/v1/files/{fileId}/move-folder
     */
    public function moveFolder(Request $request, string $fileId): JsonResponse
    {
        $userId = $request->user()->id;
        $request->validate([
            'folder_id' => ['nullable', 'string', 'exists:folders,id,user_id,' . $userId],
        ]);

        $file = File::find($fileId);
        if (!$file || !$this->fileService->canAccess($request->user(), $file)) {
            return $this->notFound('File not found');
        }

        $targetFolderId = $request->folder_id;
        if ($targetFolderId) {
            $folder = Folder::where('id', $targetFolderId)
                ->where('user_id', $userId)
                ->first();

            if ($folder && $folder->folder_type === 'gallery') {
                $mime = $file->mime_type ?? '';
                if (!str_starts_with($mime, 'image/') && !str_starts_with($mime, 'video/')) {
                    return $this->error(
                        'В мультимедиа-папку можно добавлять только фото и видео',
                        'GALLERY_TYPE_MISMATCH',
                        [],
                        422
                    );
                }
            }
        }

        $this->fileService->moveToFolder($file, $request->user(), $targetFolderId);

        return $this->success(__('messages.files.moved'));
    }

    /**
     * POST /api/v1/files/{fileId}/set-tags
     */
    public function setTags(Request $request, string $fileId): JsonResponse
    {
        $userId = $request->user()->id;
        $request->validate([
            'tag_ids'   => 'required|array',
            'tag_ids.*' => 'string|exists:tags,id,user_id,' . $userId,
        ]);

        $file = File::find($fileId);
        if (!$file || !$this->fileService->canAccess($request->user(), $file)) {
            return $this->notFound('File not found');
        }

        $this->fileService->setTags($file, $request->user(), $request->tag_ids);

        return $this->success(__('messages.files.tags_updated'));
    }

    /**
     * GET /api/v1/files/{fileId}/activity
     */
    public function activity(Request $request, string $fileId): JsonResponse
    {
        $file = File::find($fileId);
        if (!$file || !$this->fileService->canAccess($request->user(), $file)) {
            return $this->notFound('File not found');
        }

        $isOwner = $file->isOwnedBy($request->user());
        $logs = $this->activityService->getForFile($file, 50, $isOwner ? null : $request->user()->id);

        return $this->success(__('messages.files.activity_fetched'), [
            'items' => $logs,
        ]);
    }

    /**
     * GET /api/v1/files/{fileId}/accesses
     */
    public function accesses(Request $request, string $fileId): JsonResponse
    {
        $file = File::find($fileId);
        if (!$file || !$file->isOwnedBy($request->user())) {
            return $this->notFound('File not found');
        }

        $accesses = $file->accesses()
            ->with('user:id,email,phone,name')
            ->get()
            ->map(fn ($a) => [
                'id'          => $a->id,
                'access_type' => $a->access_type,
                'user'        => $a->user ? [
                    'id'    => $a->user->id,
                    'email' => $a->user->email,
                    'phone' => $a->user->phone,
                    'name'  => $a->user->name,
                ] : null,
                'is_favorite' => $a->is_favorite,
                'saved_at'    => $a->saved_at?->toIso8601String(),
                'contact_id'  => $a->contact_id,
                'can_edit'    => $a->can_edit,
                'is_pending'  => false,
            ]);

        $pendingRaw = PendingReceivedFile::where('file_id', $file->id)
            ->with('recipient:id,email,name')
            ->get();

        // Clean up stale pending entries where the user already has FileUserAccess
        if ($pendingRaw->isNotEmpty()) {
            $recipientIds = $pendingRaw->pluck('recipient_user_id')->filter()->unique()->values();
            $alreadyAccessUserIds = FileUserAccess::where('file_id', $file->id)
                ->whereIn('user_id', $recipientIds)
                ->pluck('user_id')
                ->toArray();

            $stale = $pendingRaw->filter(fn ($p) => in_array($p->recipient_user_id, $alreadyAccessUserIds));
            if ($stale->isNotEmpty()) {
                PendingReceivedFile::whereIn('id', $stale->pluck('id'))->delete();
            }
            $pendingRaw = $pendingRaw->diff($stale)->values();
        }

        $pending = $pendingRaw->map(fn ($p) => [
            'id'          => $p->id,
            'access_type' => AccessType::Shared->value,
            'user'        => $p->recipient ? [
                'id'    => $p->recipient->id,
                'email' => $p->recipient->email,
                'name'  => $p->recipient->name,
            ] : null,
            'is_favorite' => false,
            'saved_at'    => null,
            'contact_id'  => null,
            'can_edit'    => (bool) $p->can_edit,
            'is_pending'  => true,
        ]);

        return $this->success(__('messages.files.accesses_fetched'), [
            'items' => $accesses->merge($pending)->values(),
        ]);
    }

    /**
     * PATCH /api/v1/files/{fileId}/task
     * Update task fields. Only owner can toggle is_task or change assignee.
     * Owner and current assignee can update status and dates.
     */
    public function updateTask(Request $request, string $fileId): JsonResponse
    {
        $validated = $request->validate([
            'is_task'               => 'sometimes|boolean',
            'task_status'           => 'sometimes|nullable|in:template,in_progress,under_review,completed',
            'task_start_date'       => 'sometimes|nullable|date',
            'task_due_date'         => 'sometimes|nullable|date',
            'task_assigned_user_id' => 'sometimes|nullable|integer|exists:users,id',
        ]);

        $user = $request->user();
        $file = File::with(['owner', 'taskAssignee'])->find($fileId);

        if (!$file || !$this->fileService->canAccess($user, $file)) {
            return $this->notFound('File not found');
        }

        $isOwner    = $file->isOwnedBy($user);
        $isAssignee = $file->task_assigned_user_id && $file->task_assigned_user_id === $user->id;

        // is_task toggle and assignee change: owner only
        if ((array_key_exists('is_task', $validated) || array_key_exists('task_assigned_user_id', $validated)) && !$isOwner) {
            return $this->forbidden('Only the owner can change task mode or assignee');
        }

        // Status and dates: owner or current assignee
        if ((array_key_exists('task_status', $validated) || array_key_exists('task_start_date', $validated) || array_key_exists('task_due_date', $validated))
            && !$isOwner && !$isAssignee) {
            return $this->forbidden('Only the owner or assignee can update task status and dates');
        }

        if (array_key_exists('is_task', $validated)) {
            $newIsTask = (bool) $validated['is_task'];

            if ($newIsTask && !$file->isMarkdownDocument()) {
                return $this->error('Только заметки можно конвертировать в задачи', 'not_a_note', [], 422);
            }

            if ($newIsTask && !$file->is_task) {
                // Converting to task: set default status if not provided
                $validated['task_status'] = $validated['task_status'] ?? 'template';
                // Default assignee to owner if not set
                if (!array_key_exists('task_assigned_user_id', $validated) && !$file->task_assigned_user_id) {
                    $validated['task_assigned_user_id'] = $user->id;
                }
            } elseif (!$newIsTask) {
                // Clearing task mode: reset all task fields
                $validated['task_status']           = null;
                $validated['task_start_date']        = null;
                $validated['task_due_date']          = null;
                $validated['task_assigned_user_id']  = null;
            }
        }

        $oldAssigneeId = $file->task_assigned_user_id;

        $file->update($validated);
        $file->load('taskAssignee');

        // Schedule assignee notification if changed (not self-assign, after 30s)
        if (array_key_exists('task_assigned_user_id', $validated)) {
            $newAssigneeId = $validated['task_assigned_user_id'];
            if ($newAssigneeId && $newAssigneeId !== $oldAssigneeId && $newAssigneeId !== $user->id) {
                \App\Jobs\SendTaskAssignedNotification::dispatch(
                    $newAssigneeId,
                    $file->id,
                    $user->id,
                    $newAssigneeId,
                )->delay(now()->addSeconds(30));
            }
        }

        return $this->success('Задача обновлена', [
            'file' => $this->fileService->buildFileCard($file, $user),
        ]);
    }
}
