<?php

namespace App\Http\Controllers\Files;

use App\Enums\AccessType;
use App\Enums\FileStatus;
use App\Http\Controllers\Controller;
use App\Enums\SharedFolderAccessType;
use App\Models\File;
use App\Models\FileUserAccess;
use App\Models\Folder;
use App\Models\SharedFolder;
use App\Models\SharedFolderFile;
use App\Services\KinopoiskService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MovieController extends Controller
{
    public function __construct(private readonly KinopoiskService $kinopoisk) {}

    /**
     * POST /api/v1/folders/{folder}/movies/search
     *
     * Input: { input: "Интерстеллар" } or { input: "https://kinopoisk.ru/film/258687" }
     * Returns: { results: [...] } for text search, { movie: {...} } for URL (auto-confirm)
     */
    public function search(Request $request, string $folderId): JsonResponse
    {
        $data = $request->validate([
            'input' => 'required|string|max:500',
        ]);

        $folder = Folder::where('id', $folderId)
            ->where('user_id', $request->user()->id)
            ->where('folder_type', 'movies')
            ->first();

        if (!$folder) {
            return $this->notFound('Папка не найдена или не является папкой фильмов');
        }

        $input = trim($data['input']);

        // URL branch — auto-fetch without confirmation
        $kinopoiskId = $this->kinopoisk->extractIdFromUrl($input);
        if ($kinopoiskId) {
            $movie = $this->kinopoisk->fetchById($kinopoiskId);
            if (!$movie) {
                return $this->error('Не удалось получить данные фильма по ссылке', 'KINOPOISK_NOT_FOUND', [], 422);
            }
            return $this->success('Фильм найден', ['movie' => $movie, 'auto_confirm' => true]);
        }

        // Text search — return list for user confirmation
        try {
            $results = $this->kinopoisk->search($input);
        } catch (\RuntimeException $e) {
            return $this->error('Сервис Кинопоиска временно недоступен. Попробуйте позже.', 'KINOPOISK_UNAVAILABLE', [], 503);
        }
        return $this->success('Результаты поиска', ['results' => $results]);
    }

    /**
     * POST /api/v1/folders/{folder}/movies
     *
     * Saves a confirmed movie as a file with content_kind = 'movie_item'.
     * Input: { kinopoisk_id: 258687 }
     */
    public function store(Request $request, string $folderId): JsonResponse
    {
        $data = $request->validate([
            'kinopoisk_id' => 'required|integer',
        ]);

        $folder = Folder::where('id', $folderId)
            ->where('user_id', $request->user()->id)
            ->where('folder_type', 'movies')
            ->first();

        if (!$folder) {
            return $this->notFound('Папка не найдена или не является папкой фильмов');
        }

        $movie = $this->kinopoisk->fetchById((int) $data['kinopoisk_id']);
        if (!$movie) {
            return $this->error('Фильм с указанным ID не найден в Кинопоиске', 'KINOPOISK_NOT_FOUND', [], 422);
        }

        $user = $request->user();

        $file = DB::transaction(function () use ($user, $folder, $movie) {
            $file = File::create([
                'owner_id'        => $user->id,
                'original_name'   => $movie['title'] ?? 'Фильм',
                'storage_key'     => null,
                'size'            => 0,
                'mime_type'       => null,
                'status'          => FileStatus::Available,
                'content_kind'    => 'movie_item',
                'link_url'        => $movie['kp_url'],
                'link_image_url'  => $movie['poster_url'],
                'custom_metadata' => $movie,
            ]);

            FileUserAccess::create([
                'file_id'     => $file->id,
                'user_id'     => $user->id,
                'access_type' => AccessType::Owner,
                'folder_id'   => $folder->id,
            ]);

            return $file;
        });

        return $this->success('Фильм добавлен', [
            'file' => [
                'id'              => $file->id,
                'original_name'   => $file->original_name,
                'content_kind'    => $file->content_kind,
                'custom_metadata' => $file->custom_metadata,
            ],
        ], 201);
    }

    /**
     * PATCH /api/v1/files/{id}/movie-meta
     *
     * Updates user-specific movie metadata (watched, personal_rating).
     * Preserves all Kinopoisk fields.
     */
    public function updateMeta(Request $request, string $fileId): JsonResponse
    {
        $data = $request->validate([
            'watched'         => 'nullable|boolean',
            'personal_rating' => 'nullable|numeric|min:0|max:10',
        ]);

        $file = File::where('id', $fileId)
            ->where('owner_id', $request->user()->id)
            ->where('content_kind', 'movie_item')
            ->first();

        if (!$file) {
            return $this->notFound('Файл не найден');
        }

        $meta = $file->custom_metadata ?? [];
        if (array_key_exists('watched', $data)) {
            $meta['watched'] = $data['watched'];
        }
        if (array_key_exists('personal_rating', $data)) {
            $meta['personal_rating'] = $data['personal_rating'];
        }
        $file->custom_metadata = $meta;
        $file->save();

        return $this->success('Метаданные обновлены', ['custom_metadata' => $file->custom_metadata]);
    }

    /**
     * POST /api/v1/shared-folders/{id}/movies/search
     */
    public function searchShared(Request $request, string $folderId): JsonResponse
    {
        $data = $request->validate([
            'input' => 'required|string|max:500',
        ]);

        $folder = SharedFolder::find($folderId);
        if (!$folder || $folder->folder_type !== 'movies') {
            return $this->notFound('Папка не найдена или не является папкой фильмов');
        }

        $input       = trim($data['input']);
        $kinopoiskId = $this->kinopoisk->extractIdFromUrl($input);

        if ($kinopoiskId) {
            $movie = $this->kinopoisk->fetchById($kinopoiskId);
            if (!$movie) {
                return $this->error('Не удалось получить данные фильма по ссылке', 'KINOPOISK_NOT_FOUND', [], 422);
            }
            return $this->success('Фильм найден', ['movie' => $movie, 'auto_confirm' => true]);
        }

        try {
            $results = $this->kinopoisk->search($input);
        } catch (\RuntimeException $e) {
            return $this->error('Сервис Кинопоиска временно недоступен. Попробуйте позже.', 'KINOPOISK_UNAVAILABLE', [], 503);
        }
        return $this->success('Результаты поиска', ['results' => $results]);
    }

    /**
     * POST /api/v1/shared-folders/{id}/movies
     */
    public function storeShared(Request $request, string $folderId): JsonResponse
    {
        $data = $request->validate([
            'kinopoisk_id' => 'required|integer',
        ]);

        $folder = SharedFolder::find($folderId);
        if (!$folder || $folder->folder_type !== 'movies') {
            return $this->notFound('Папка не найдена или не является папкой фильмов');
        }

        $movie = $this->kinopoisk->fetchById((int) $data['kinopoisk_id']);
        if (!$movie) {
            return $this->error('Фильм с указанным ID не найден в Кинопоиске', 'KINOPOISK_NOT_FOUND', [], 422);
        }

        $user = $request->user();

        $file = DB::transaction(function () use ($user, $folder, $movie) {
            $file = File::create([
                'owner_id'          => $user->id,
                'original_name'     => $movie['title'] ?? 'Фильм',
                'storage_key'       => null,
                'size'              => 0,
                'mime_type'         => null,
                'status'            => FileStatus::Available,
                'content_kind'      => 'movie_item',
                'shared_folder_only' => true,
                'link_url'          => $movie['kp_url'],
                'link_image_url'    => $movie['poster_url'],
                'custom_metadata'   => $movie,
            ]);

            SharedFolderFile::create([
                'shared_folder_id' => $folder->id,
                'file_id'          => $file->id,
                'added_by'         => $user->id,
            ]);

            return $file;
        });

        return $this->success('Фильм добавлен', [
            'file' => [
                'id'              => $file->id,
                'original_name'   => $file->original_name,
                'content_kind'    => $file->content_kind,
                'custom_metadata' => $file->custom_metadata,
            ],
        ], 201);
    }
}
