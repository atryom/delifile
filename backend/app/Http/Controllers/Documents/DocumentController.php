<?php

namespace App\Http\Controllers\Documents;

use App\Http\Controllers\Controller;
use App\Models\File;
use App\Models\FileUserAccess;
use App\Services\DocumentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DocumentController extends Controller
{
    public function __construct(
        private readonly DocumentService $documentService
    ) {}

    /**
     * POST /api/v1/documents
     */
    public function create(Request $request): JsonResponse
    {
        $request->validate([
            'fileName' => 'required|string|max:255',
        ]);

        $fileName = $request->input('fileName');

        if (!str_ends_with(strtolower($fileName), '.md')) {
            $fileName .= '.md';
        }

        $doc = $this->documentService->createDocument($request->user(), $fileName);

        return $this->success('Document created', ['document' => $doc], 201);
    }

    /**
     * GET /api/v1/documents/:id
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $file = File::find($id);

        if (!$file || !$file->isMarkdownDocument()) {
            return $this->notFound('Document not found');
        }

        if (!$this->documentService->canViewDocument($request->user(), $file)) {
            return $this->forbidden();
        }

        $doc = $this->documentService->getDocument($file, $request->user());

        return $this->success('Document fetched', ['document' => $doc]);
    }

    /**
     * PUT /api/v1/documents/:id
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'content' => 'present|string',
            'etag'    => 'required|string',
        ]);

        $file = File::find($id);

        if (!$file || !$file->isMarkdownDocument()) {
            return $this->notFound('Document not found');
        }

        $user = $request->user();

        if (!$this->documentService->canEditDocument($user, $file)) {
            return $this->forbidden();
        }

        if (!$this->documentService->hasValidLock($file, $user)) {
            return $this->error('Document is not locked by you', 'LOCK_REQUIRED', [], 423);
        }

        $result = $this->documentService->saveDocument(
            $file,
            $user,
            $request->input('content'),
            $request->input('etag')
        );

        if (!empty($result['quota_exceeded'])) {
            return $this->error('Storage quota exceeded', 'QUOTA_EXCEEDED', [], 413);
        }

        if ($result['conflict']) {
            return response()->json([
                'result'  => 'error',
                'message' => 'Document was modified by another user',
                'data'    => [
                    'error'   => 'DOCUMENT_CONFLICT',
                    'current' => $result['current'],
                ],
            ], 409);
        }

        return $this->success('Document saved', [
            'id'        => $result['id'],
            'etag'      => $result['etag'],
            'updatedAt' => $result['updatedAt'],
            'updatedBy' => $result['updatedBy'],
        ]);
    }

    /**
     * PATCH /api/v1/files/:id/accesses/:accessId
     * Update can_edit for a shared access.
     */
    public function updateAccess(Request $request, string $fileId, string $accessId): JsonResponse
    {
        $request->validate([
            'can_edit' => 'required|boolean',
        ]);

        $file = File::find($fileId);

        if (!$file) {
            return $this->notFound('File not found');
        }

        if (!$file->isOwnedBy($request->user())) {
            return $this->forbidden();
        }

        $access = FileUserAccess::where('id', $accessId)
            ->where('file_id', $fileId)
            ->whereIn('access_type', ['shared'])
            ->first();

        if (!$access) {
            return $this->notFound('Access record not found');
        }

        $access->update(['can_edit' => $request->boolean('can_edit')]);

        return $this->success('Access updated');
    }
}
