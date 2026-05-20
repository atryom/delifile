<?php

namespace App\Http\Controllers\Files;

use App\Enums\FileStatus;
use App\Http\Controllers\Controller;
use App\Models\File;
use App\Models\FileVersion;
use App\Services\FileService;
use App\Services\MimeService;
use App\Services\S3UrlService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class FileVersionController extends Controller
{
    public function __construct(
        private readonly FileService  $fileService,
        private readonly MimeService  $mime,
        private readonly S3UrlService $s3,
    ) {}

    /**
     * POST /api/v1/files/{id}/versions/init-upload
     */
    public function initUpload(Request $request, string $fileId): JsonResponse
    {
        $file = File::find($fileId);
        if (!$file || !$file->isOwnedBy($request->user())) {
            return $this->notFound('File not found');
        }
        if ($file->isUrlFile()) {
            return $this->error('URL-файлы не поддерживают версионность', 'NOT_SUPPORTED', [], 422);
        }

        $data = $request->validate([
            'original_name'  => 'required|string|max:255',
            'size'           => 'required|integer|min:1',
            'mime_type'      => 'required|string|max:100',
            'thumbnail_name' => 'nullable|string|max:255',
            'thumbnail_mime' => 'nullable|string|max:100',
        ]);

        $parentGroup = $this->mime->getGroup($file->mime_type ?? '');
        $newGroup    = $this->mime->getGroup($data['mime_type']);
        if ($parentGroup !== 'other' && $parentGroup !== $newGroup) {
            return $this->error(
                'Новая версия должна быть того же типа файла, что и исходный',
                'MIME_TYPE_MISMATCH',
                ['expected_group' => $parentGroup, 'got_group' => $newGroup],
                422
            );
        }

        if ($error = $this->fileService->validateFileSizeLimit($request->user(), $data['size'])) {
            return $this->error('Файл превышает допустимый размер', $error['code'], $error['data'] ?? [], 422);
        }

        if ($error = $this->fileService->validateStorageQuota($request->user(), $data['size'])) {
            return $this->error('Превышен лимит хранилища', $error['code'], [], 422);
        }

        return DB::transaction(function () use ($file, $data) {
            $ulid       = Str::ulid();
            $storageKey = 'files/' . $file->owner_id . '/' . $ulid . '/' . $data['original_name'];

            $version = FileVersion::create([
                'file_id'        => $file->id,
                'version_number' => 0,
                'storage_key'    => $storageKey,
                'original_name'  => $data['original_name'],
                'size'           => $data['size'],
                'mime_type'      => $data['mime_type'],
                'status'         => FileStatus::Uploading->value,
                'expires_at'     => now()->addHour(),
            ]);

            $result = [
                'version' => ['id' => $version->id, 'status' => FileStatus::Uploading->value],
                'upload'  => [
                    'method'  => 'PUT',
                    'url'     => $this->fileService->generatePresignedPutUrl($storageKey, $data['mime_type']),
                    'headers' => ['Content-Type' => $data['mime_type']],
                ],
            ];

            if (!empty($data['thumbnail_name']) && !empty($data['thumbnail_mime'])) {
                $thumbKey = 'files/' . $file->owner_id . '/' . $ulid . '/thumb_' . $data['thumbnail_name'];
                $result['thumbnail'] = [
                    'key'     => $thumbKey,
                    'method'  => 'PUT',
                    'url'     => $this->fileService->generatePresignedPutUrl($thumbKey, $data['thumbnail_mime']),
                    'headers' => ['Content-Type' => $data['thumbnail_mime']],
                ];
            }

            return $this->success('Upload initialized', $result, 201);
        });
    }

    /**
     * POST /api/v1/files/{id}/versions/complete-upload
     */
    public function completeUpload(Request $request, string $fileId): JsonResponse
    {
        $file = File::find($fileId);
        if (!$file || !$file->isOwnedBy($request->user())) {
            return $this->notFound('File not found');
        }

        $data = $request->validate([
            'version_id'    => 'required|string',
            'thumbnail_key' => 'nullable|string|max:500',
        ]);

        $version = FileVersion::where('id', $data['version_id'])
            ->where('file_id', $file->id)
            ->where('status', FileStatus::Uploading->value)
            ->first();

        if (!$version) {
            return $this->notFound('Version not found');
        }

        return DB::transaction(function () use ($file, $version, $data) {
            $isFirst = File::where('id', $file->id)
                ->where('has_versions', false)
                ->lockForUpdate()
                ->exists();

            if ($isFirst) {
                File::where('id', $file->id)->update(['has_versions' => true]);
                FileVersion::create([
                    'file_id'        => $file->id,
                    'version_number' => 1,
                    'storage_key'    => $file->storage_key,
                    'thumbnail_key'  => $file->thumbnail_key,
                    'original_name'  => $file->original_name,
                    'size'           => $file->size,
                    'mime_type'      => $file->mime_type,
                    'is_active'      => true,
                    'status'         => FileStatus::Available->value,
                ]);
                $nextNumber = 2;
            } else {
                $nextNumber = FileVersion::where('file_id', $file->id)
                    ->where('status', FileStatus::Available->value)
                    ->max('version_number') + 1;
            }

            $thumbKey = $data['thumbnail_key'] ?? null;
            $version->update([
                'version_number' => $nextNumber,
                'thumbnail_key'  => $thumbKey,
                'status'         => FileStatus::Available->value,
                'is_active'      => true,
            ]);

            $file->update([
                'has_versions'  => true,
                'storage_key'   => $version->storage_key,
                'thumbnail_key' => $thumbKey,
                'original_name' => $version->original_name,
                'size'          => $version->size,
                'mime_type'     => $version->mime_type,
            ]);

            return $this->success('Version upload completed', [
                'version' => [
                    'id'             => $version->id,
                    'version_number' => $nextNumber,
                    'status'         => FileStatus::Available->value,
                ],
                'file' => ['id' => $file->id, 'has_versions' => true],
            ]);
        });
    }

    /**
     * PATCH /api/v1/files/{id}/versions/{vid}
     */
    public function update(Request $request, string $fileId, string $versionId): JsonResponse
    {
        $file = File::find($fileId);
        if (!$file || !$file->isOwnedBy($request->user())) {
            return $this->notFound('File not found');
        }

        $version = FileVersion::where('id', $versionId)
            ->where('file_id', $file->id)
            ->where('status', FileStatus::Available->value)
            ->first();

        if (!$version) {
            return $this->notFound('Version not found');
        }

        $data = $request->validate([
            'version_label'  => 'nullable|string|max:50',
            'comment'        => 'nullable|string|max:500',
            'is_active'      => 'nullable|boolean',
            'version_number' => 'nullable|integer|min:1',
        ]);

        if (isset($data['version_number']) && $data['version_number'] !== $version->version_number) {
            $conflict = FileVersion::where('file_id', $file->id)
                ->where('version_number', $data['version_number'])
                ->where('id', '!=', $version->id)
                ->exists();
            if ($conflict) {
                return $this->error('Версия с таким номером уже существует', 'VERSION_NUMBER_EXISTS', [], 422);
            }
        }

        $updateData = [];
        foreach (['version_label', 'comment', 'is_active', 'version_number'] as $field) {
            if ($request->has($field)) {
                $updateData[$field] = $data[$field];
            }
        }
        $version->update($updateData);

        return $this->success('Version updated', [
            'version' => $this->fileService->buildVersionItem($version->fresh()),
        ]);
    }

    /**
     * PATCH /api/v1/files/{id}/display-name
     */
    public function updateDisplayName(Request $request, string $fileId): JsonResponse
    {
        $file = File::find($fileId);
        if (!$file || !$file->isOwnedBy($request->user())) {
            return $this->notFound('File not found');
        }
        if (!$file->has_versions) {
            return $this->error('Файл не имеет версий', 'NO_VERSIONS', [], 422);
        }

        $request->validate(['display_name' => 'nullable|string|max:255']);
        $file->update(['display_name' => $request->input('display_name')]);

        return $this->success('Display name updated', ['display_name' => $file->display_name]);
    }

    /**
     * POST /api/v1/files/{id}/versions/{vid}/download
     */
    public function download(Request $request, string $fileId, string $versionId): JsonResponse
    {
        $file = File::find($fileId);
        if (!$file || !$this->fileService->canAccess($request->user(), $file)) {
            return $this->notFound('File not found');
        }

        $version = FileVersion::where('id', $versionId)
            ->where('file_id', $file->id)
            ->where('status', FileStatus::Available->value)
            ->first();

        if (!$version) {
            return $this->notFound('Version not found');
        }

        $url = $this->s3->generateVersionDownloadUrl($version);

        return $this->success('Download URL generated', [
            'url'        => $url,
            'expires_in' => config('filesystems.disks.s3.presigned_url_ttl', 3600),
        ]);
    }

}
