<?php

namespace App\Http\Controllers\Files;

use App\Enums\AccessType;
use App\Enums\ActivityType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Files\InitUploadRequest;
use App\Http\Requests\Files\CompleteUploadRequest;
use App\Models\File;
use App\Models\FileUserAccess;
use App\Services\FileService;
use App\Services\ActivityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FileController extends Controller
{
    public function __construct(
        private readonly FileService     $fileService,
        private readonly ActivityService $activityService
    ) {}

    /**
     * GET /api/v1/files
     * List files for authenticated user (owned, shared, saved).
     */
    public function index(Request $request): JsonResponse
    {
        $filter = $request->get('filter', 'mine'); // mine | received | favorites
        $page   = (int) $request->get('page', 1);
        $perPage = (int) $request->get('per_page', 20);
        $search  = $request->get('search');

        $result = $this->fileService->listFiles(
            $request->user(),
            $filter,
            $search,
            $page,
            $perPage
        );

        return $this->success(__('messages.files.fetched'), $result);
    }

    /**
     * GET /api/v1/files/{fileId}
     * Get full file card.
     */
    public function show(Request $request, string $fileId): JsonResponse
    {
        $file = File::find($fileId);

        if (!$file) {
            return $this->notFound('File not found');
        }

        $user = $request->user();
        if (!$this->fileService->canAccess($user, $file)) {
            return $this->forbidden();
        }

        return $this->success(__('messages.files.fetched_one'), [
            'file' => $this->fileService->buildFileCard($file, $user),
        ]);
    }

    /**
     * DELETE /api/v1/files/{fileId}
     * Logical delete by owner.
     */
    public function destroy(Request $request, string $fileId): JsonResponse
    {
        $file = File::find($fileId);

        if (!$file) {
            return $this->notFound('File not found');
        }

        if (!$file->isOwnedBy($request->user())) {
            return $this->forbidden(__('messages.files.delete_forbidden'));
        }

        $this->fileService->deleteFile($file, $request->user());

        return $this->success(__('messages.files.deleted'));
    }

    /**
     * POST /api/v1/files/init-upload
     * Step 1 of upload flow: initialize upload, get S3 presigned URL.
     */
    public function initUpload(InitUploadRequest $request): JsonResponse
    {
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

        $result = $this->fileService->completeUpload($file, $request->user());

        return $this->success(__('messages.files.upload_completed'), $result);
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

        if (!$file) {
            return $this->notFound('File not found');
        }

        if (!$this->fileService->canAccess($request->user(), $file)) {
            return $this->forbidden();
        }

        if (!$file->isAvailable()) {
            return $this->error(__('messages.files.not_available'), 'FILE_NOT_AVAILABLE', [], 422);
        }

        $url = $this->fileService->generateDownloadUrl($file);

        $this->activityService->log($file, $request->user(), ActivityType::Downloaded);

        return $this->success(__('messages.files.download_url'), [
            'url'        => $url,
            'expires_in' => config('filesystems.disks.s3.presigned_url_ttl', 3600),
        ]);
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
        $request->validate(['folder_id' => 'nullable|string']);

        $file = File::find($fileId);
        if (!$file || !$file->isOwnedBy($request->user())) {
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
        $request->validate(['tag_ids' => 'required|array']);

        $file = File::find($fileId);
        if (!$file || !$file->isOwnedBy($request->user())) {
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

        $logs = $this->activityService->getForFile($file);

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
            ->with('user:id,phone,name')
            ->get()
            ->map(fn ($a) => [
                'id'          => $a->id,
                'access_type' => $a->access_type,
                'user'        => $a->user ? [
                    'id'    => $a->user->id,
                    'phone' => $a->user->phone,
                    'name'  => $a->user->name,
                ] : null,
                'is_favorite' => $a->is_favorite,
                'saved_at'    => $a->saved_at?->toIso8601String(),
            ]);

        return $this->success(__('messages.files.accesses_fetched'), [
            'items' => $accesses,
        ]);
    }
}
