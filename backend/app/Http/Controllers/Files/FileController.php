<?php

namespace App\Http\Controllers\Files;

use App\Enums\AccessType;
use App\Enums\ActivityType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Files\InitUploadRequest;
use App\Http\Requests\Files\CompleteUploadRequest;
use App\Models\File;
use App\Models\FileUserAccess;
use App\Models\PendingReceivedFile;
use App\Services\FileService;
use App\Services\ActivityService;
use App\Services\S3UrlService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
            'tag_id'          => $request->get('tag_id'),
            'content_kind'    => $request->get('content_kind'),
            'file_type_group' => $request->get('file_type_group'),
            'sort_by'         => $request->get('sort_by'),
            'sort_order'      => $request->get('sort_order'),
        ]);

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
        $file = File::with(['owner'])->find($fileId);

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

        $this->fileService->moveToFolder($file, $request->user(), $request->folder_id);

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

        $pending = PendingReceivedFile::where('file_id', $file->id)
            ->with('recipient:id,email,name')
            ->get()
            ->map(fn ($p) => [
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
}
