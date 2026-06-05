<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class KinopoiskService
{
    private const BASE_URL = 'https://api.kinopoisk.dev/v1.4';

    private function token(): string
    {
        return config('services.kinopoisk.token', '');
    }

    /**
     * Search movies by title. Returns up to 5 results.
     */
    public function search(string $query): array
    {
        try {
            $response = Http::withHeaders(['X-API-KEY' => $this->token()])
                ->timeout(10)
                ->get(self::BASE_URL . '/movie/search', [
                    'query' => $query,
                    'limit' => 5,
                    'page'  => 1,
                ]);

            if (!$response->successful()) {
                Log::warning('Kinopoisk search failed', ['status' => $response->status(), 'query' => $query]);
                return [];
            }

            $docs = $response->json('docs', []);
            return array_map(fn ($d) => $this->normalize($d), $docs);
        } catch (\Throwable $e) {
            Log::error('Kinopoisk search error', ['error' => $e->getMessage()]);
            return [];
        }
    }

    /**
     * Fetch movie by Kinopoisk ID.
     */
    public function fetchById(int $id): ?array
    {
        try {
            $response = Http::withHeaders(['X-API-KEY' => $this->token()])
                ->timeout(10)
                ->get(self::BASE_URL . '/movie/' . $id);

            if (!$response->successful()) {
                return null;
            }

            return $this->normalize($response->json());
        } catch (\Throwable $e) {
            Log::error('Kinopoisk fetchById error', ['error' => $e->getMessage()]);
            return null;
        }
    }

    /**
     * Extract Kinopoisk movie ID from a kinopoisk.ru URL.
     * Supports: kinopoisk.ru/film/123/, kinopoisk.ru/series/123/
     */
    public function extractIdFromUrl(string $url): ?int
    {
        if (preg_match('#kinopoisk\.ru/(?:film|series|video)/(\d+)#', $url, $m)) {
            return (int) $m[1];
        }
        return null;
    }

    private function normalize(array $data): array
    {
        $poster = $data['poster']['url'] ?? $data['poster']['previewUrl'] ?? null;

        $genres = array_map(
            fn ($g) => $g['name'] ?? '',
            $data['genres'] ?? []
        );

        $directors = collect($data['persons'] ?? [])
            ->where('enProfession', 'director')
            ->pluck('name')
            ->first();

        $ratingKp = $data['rating']['kp'] ?? null;

        return [
            'kinopoisk_id' => $data['id'] ?? null,
            'title'        => $data['name'] ?? $data['alternativeName'] ?? null,
            'year'         => $data['year'] ?? null,
            'poster_url'   => $poster,
            'rating_kp'    => $ratingKp ? round((float) $ratingKp, 1) : null,
            'genres'       => array_filter($genres),
            'director'     => $directors,
            'description'  => $data['description'] ?? $data['shortDescription'] ?? null,
            'kp_url'       => isset($data['id']) ? 'https://www.kinopoisk.ru/film/' . $data['id'] . '/' : null,
        ];
    }
}
