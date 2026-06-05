<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class KinopoiskService
{
    // api.kinopoisk.dev redirects 301 → api.poiskkino.dev; используем конечный URL напрямую
    private const BASE_URL = 'https://api.poiskkino.dev/v1.4';

    private function token(): string
    {
        return config('services.kinopoisk.token', '');
    }

    public function isConfigured(): bool
    {
        return !empty($this->token());
    }

    /**
     * Search movies by title. Returns up to 5 results.
     * Throws \RuntimeException if API call fails (token missing, network error, etc.)
     */
    public function search(string $query): array
    {
        if (!$this->isConfigured()) {
            throw new \RuntimeException('KINOPOISK_API_TOKEN не настроен');
        }

        $response = Http::withHeaders(['X-API-KEY' => $this->token()])
            ->timeout(15)
            ->get(self::BASE_URL . '/movie/search', [
                'query' => $query,
                'limit' => 5,
                'page'  => 1,
            ]);

        if (!$response->successful()) {
            Log::warning('Kinopoisk search failed', [
                'status' => $response->status(),
                'query'  => $query,
                'body'   => substr($response->body(), 0, 200),
            ]);
            throw new \RuntimeException('Kinopoisk API вернул ' . $response->status());
        }

        $docs = $response->json('docs', []);
        return array_map(fn ($d) => $this->normalize($d), $docs);
    }

    /**
     * Fetch movie by Kinopoisk ID.
     * Throws \RuntimeException if API call fails.
     */
    public function fetchById(int $id): ?array
    {
        if (!$this->isConfigured()) {
            throw new \RuntimeException('KINOPOISK_API_TOKEN не настроен');
        }

        $response = Http::withHeaders(['X-API-KEY' => $this->token()])
            ->timeout(15)
            ->get(self::BASE_URL . '/movie/' . $id);

        if (!$response->successful()) {
            Log::warning('Kinopoisk fetchById failed', ['status' => $response->status(), 'id' => $id]);
            return null;
        }

        return $this->normalize($response->json());
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
