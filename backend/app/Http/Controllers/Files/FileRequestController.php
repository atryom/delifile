<?php

namespace App\Http\Controllers\Files;

use App\Enums\AccessType;
use App\Enums\FileStatus;
use App\Http\Controllers\Controller;
use App\Jobs\CleanOrphanedS3ObjectJob;
use App\Models\File;
use App\Models\FileRequest;
use App\Models\FileUserAccess;
use App\Services\FileService;
use App\Services\NotificationService;
use App\Services\PushNotificationService;
use App\Services\S3UrlService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FileRequestController extends Controller
{
    public function __construct(
        private readonly FileService             $fileService,
        private readonly NotificationService     $notifications,
        private readonly PushNotificationService $push,
        private readonly S3UrlService            $s3,
    ) {}

    /**
     * POST /api/v1/file-requests
     * Create a file request and return a shareable URL.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'description' => ['required', 'string', 'max:1000'],
            'ttl_hours'   => ['nullable', 'integer', 'min:1', 'max:720'],
        ]);

        $ttlHours = $data['ttl_hours'] ?? 168;

        $req = FileRequest::create([
            'user_id'     => $request->user()->id,
            'description' => $data['description'],
            'ttl_hours'   => $ttlHours,
            'expires_at'  => now()->addHours($ttlHours),
            'status'      => 'pending',
        ]);

        return $this->success('Запрос создан', [
            'request' => [
                'id'          => $req->id,
                'url'         => $req->url,
                'description' => $req->description,
                'status'      => $req->status,
                'ttl_hours'   => $req->ttl_hours,
                'expires_at'  => $req->expires_at?->toIso8601String(),
                'created_at'  => $req->created_at?->toIso8601String(),
            ],
        ]);
    }

    /**
     * GET /api/v1/file-requests
     * List the authenticated user's file requests.
     */
    public function index(Request $request): JsonResponse
    {
        $items = FileRequest::where('user_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (FileRequest $req) => [
                'id'           => $req->id,
                'url'          => $req->url,
                'description'  => $req->description,
                'status'       => $req->status,
                'ttl_hours'    => $req->ttl_hours,
                'expires_at'   => $req->expires_at?->toIso8601String(),
                'fulfilled_at' => $req->fulfilled_at?->toIso8601String(),
                'created_at'   => $req->created_at?->toIso8601String(),
                'sender_name'  => $req->sender_name,
                'sender_email' => $req->sender_email,
                'file'         => $req->file_id && $req->file ? [
                    'id'            => $req->file->id,
                    'original_name' => $req->file->original_name,
                    'size'          => $req->file->size,
                    'mime_type'     => $req->file->mime_type,
                    'preview_url'   => $this->s3->resolveListPreviewUrl($req->file),
                ] : null,
            ]);

        return $this->success('Запросы получены', ['items' => $items]);
    }

    /**
     * POST /api/v1/file-requests/{id}/cancel
     * Cancel a pending request.
     */
    public function cancel(Request $request, string $id): JsonResponse
    {
        $req = FileRequest::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$req) {
            return $this->notFound('Запрос не найден');
        }

        if (!$req->isPending()) {
            return $this->error('Запрос уже не активен', 'INVALID_STATE', [], 409);
        }

        $req->update(['status' => 'cancelled']);

        return $this->success('Запрос отменён');
    }

    /**
     * GET /api/v1/file-requests/{token}/resolve  (public)
     * Return request description and status for the public upload page.
     */
    public function resolve(string $token): JsonResponse
    {
        $req = FileRequest::where('token', $token)->first();

        if (!$req) {
            return $this->notFound('Запрос не найден');
        }

        if (!$req->isPending()) {
            return $this->success('Запрос уже выполнен или отменён', [
                'status' => $req->status,
            ]);
        }

        if ($req->expires_at && $req->expires_at->isPast()) {
            $req->update(['status' => 'expired']);
            return $this->success('Ссылка истекла', ['status' => 'expired']);
        }

        return $this->success('Запрос найден', [
            'status'      => $req->status,
            'description' => $req->description,
            'expires_at'  => $req->expires_at?->toIso8601String(),
        ]);
    }

    /**
     * POST /api/v1/file-requests/{token}/init-upload  (public)
     * Create a file record under the requester's account and return a presigned S3 URL.
     */
    public function initUpload(Request $request, string $token): JsonResponse
    {
        $req = FileRequest::where('token', $token)->first();

        if (!$req || !$req->isPending()) {
            return $this->error('Ссылка недействительна', 'INVALID_REQUEST', [], 400);
        }

        if ($req->expires_at && $req->expires_at->isPast()) {
            $req->update(['status' => 'expired']);
            return $this->error('Ссылка истекла', 'LINK_EXPIRED', [], 410);
        }

        $data = $request->validate([
            'original_name'  => ['required', 'string', 'max:255'],
            'size'           => ['required', 'integer', 'min:1'],
            'mime_type'      => ['required', 'string', 'max:100'],
            'sender_name'    => ['nullable', 'string', 'max:255'],
            'sender_email'   => ['nullable', 'email', 'max:255'],
        ]);

        $requester = $req->requester;

        // Validate against requester's plan
        if ($sizeError = $this->fileService->validateFileSizeLimit($requester, $data['size'])) {
            return $this->error('Файл превышает допустимый размер', $sizeError['code']);
        }

        if ($quotaError = $this->fileService->validateStorageQuota($requester, $data['size'])) {
            return $this->error('Недостаточно места в хранилище запрашивающего', $quotaError['code']);
        }

        $result = $this->fileService->initUpload($requester, $data);

        // Temporarily save sender info on the request
        $req->update([
            'sender_name'  => $data['sender_name'] ?? null,
            'sender_email' => $data['sender_email'] ?? null,
        ]);

        // Store file_id temporarily so we can complete it later
        $req->update(['file_id' => $result['file']['id']]);

        return $this->success('Загрузка инициализирована', $result);
    }

    /**
     * POST /api/v1/file-requests/{token}/complete-upload  (public)
     * Complete the upload and notify the requester.
     */
    public function completeUpload(Request $request, string $token): JsonResponse
    {
        $req = FileRequest::where('token', $token)->with('requester')->first();

        if (!$req || !$req->isPending() || !$req->file_id) {
            return $this->error('Ссылка недействительна', 'INVALID_REQUEST', [], 400);
        }

        $data = $request->validate([
            'thumbnail_key' => ['nullable', 'string', 'max:500'],
        ]);

        $file = File::find($req->file_id);

        if (!$file || $file->status !== FileStatus::Uploading) {
            return $this->error('Файл не найден или уже обработан', 'FILE_NOT_FOUND', [], 404);
        }

        DB::transaction(function () use ($req, $file, $data) {
            // Mark file as available without creating FileUserAccess (pending acceptance)
            $thumbnailKey = $data['thumbnail_key'] ?? null;
            $update = ['status' => FileStatus::Available];
            if ($thumbnailKey) {
                $update['thumbnail_key'] = $thumbnailKey;
            }

            File::where('id', $file->id)
                ->where('status', FileStatus::Uploading)
                ->update($update);

            $req->update([
                'status'       => 'fulfilled',
                'fulfilled_at' => now(),
            ]);
        });

        // Send notifications
        $requester = $req->requester;
        $appUrl    = rtrim(config('app.url'), '/');

        $this->notifications->notifyFileRequestFulfilled($requester, $req);
        $this->push->sendToUser(
            $requester,
            'Файл получен по запросу',
            'Кто-то отправил файл по вашему запросу. Перейдите в Входящие, чтобы принять.',
            $appUrl . '/communication/received',
        );

        return $this->success('Файл отправлен');
    }

    /**
     * POST /api/v1/file-requests/{id}/accept  (auth)
     * Accept a fulfilled request → create Owner FileUserAccess.
     */
    public function accept(Request $request, string $id): JsonResponse
    {
        $req = FileRequest::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->where('status', 'fulfilled')
            ->with('file')
            ->first();

        if (!$req) {
            return $this->notFound('Запрос не найден');
        }

        if (!$req->file) {
            return $this->error('Файл не найден');
        }

        DB::transaction(function () use ($req, $request) {
            FileUserAccess::firstOrCreate([
                'file_id'     => $req->file_id,
                'user_id'     => $request->user()->id,
                'access_type' => AccessType::Owner,
            ]);

            $req->update(['status' => 'accepted']);
        });

        return $this->success('Файл принят', [
            'file_id' => $req->file_id,
        ]);
    }

    /**
     * POST /api/v1/file-requests/{id}/reject  (auth)
     * Reject a fulfilled request → delete the uploaded file.
     */
    public function reject(Request $request, string $id): JsonResponse
    {
        $req = FileRequest::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->where('status', 'fulfilled')
            ->with('file')
            ->first();

        if (!$req) {
            return $this->notFound('Запрос не найден');
        }

        DB::transaction(function () use ($req) {
            if ($req->file) {
                $s3Keys = array_filter([$req->file->storage_key, $req->file->thumbnail_key]);
                $req->file->update(['status' => FileStatus::Deleted]);
                $req->file->delete();

                if (!empty($s3Keys)) {
                    CleanOrphanedS3ObjectJob::dispatch(array_unique($s3Keys))->delay(now()->addMinutes(5));
                }
            }

            $req->update(['status' => 'rejected', 'file_id' => null]);
        });

        return $this->success('Запрос отклонён');
    }

}
