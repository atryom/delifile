<?php

namespace App\Http\Controllers\Documents;

use App\Http\Controllers\Controller;
use App\Models\File;
use App\Services\DocumentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class DocumentLockController extends Controller
{
    public function __construct(
        private readonly DocumentService $documentService
    ) {}

    /**
     * POST /api/v1/documents/:id/lock
     */
    public function acquire(Request $request, string $id): JsonResponse
    {
        $file = File::find($id);

        if (!$file || !$file->isMarkdownDocument()) {
            return $this->notFound('Document not found');
        }

        if (!$this->documentService->canEditDocument($request->user(), $file)) {
            return $this->forbidden();
        }

        $result = $this->documentService->acquireLock($file, $request->user());

        if (!$result['acquired']) {
            return response()->json([
                'result'  => 'error',
                'message' => 'Document is locked by another user',
                'data'    => ['lock' => $result['lock']],
            ], 423);
        }

        return $this->success('Lock acquired', ['lock' => $result['lock']], 201);
    }

    /**
     * POST /api/v1/documents/:id/lock/heartbeat
     */
    public function heartbeat(Request $request, string $id): JsonResponse
    {
        $file = File::find($id);

        if (!$file || !$file->isMarkdownDocument()) {
            return $this->notFound('Document not found');
        }

        $reason = $this->documentService->renewLock($file, $request->user());

        if ($reason === 'OK') {
            return $this->success('Lock renewed');
        }

        $lockedBy = null;
        if ($reason === 'LOCK_TAKEN_OVER') {
            $lock     = \App\Models\DocumentLock::find($file->id);
            $lockedBy = $lock ? ['id' => $lock->user_id, 'name' => $lock->user?->name ?? $lock->user?->email] : null;
        }

        return response()->json([
            'result'  => 'error',
            'message' => 'Lock lost',
            'data'    => [
                'error'    => 'LOCK_LOST',
                'reason'   => $reason,
                'lockedBy' => $lockedBy,
            ],
        ], 423);
    }

    /**
     * POST /api/v1/documents/:id/lock/takeover
     */
    public function takeover(Request $request, string $id): JsonResponse
    {
        $file = File::find($id);

        if (!$file || !$file->isMarkdownDocument()) {
            return $this->notFound('Document not found');
        }

        if (!$file->isOwnedBy($request->user())) {
            return $this->forbidden();
        }

        $lock = $this->documentService->takeoverLock($file, $request->user());

        return $this->success('Lock taken over', ['lock' => $lock]);
    }

    /**
     * DELETE /api/v1/documents/:id/lock
     */
    public function release(Request $request, string $id): JsonResponse|Response
    {
        $file = File::find($id);

        if (!$file || !$file->isMarkdownDocument()) {
            return $this->notFound('Document not found');
        }

        $this->documentService->releaseLock($file, $request->user());

        return response()->noContent();
    }
}
