<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class OgFetchService
{
    public function fetch(string $url): array
    {
        try {
            $response = Http::timeout(5)
                ->withHeaders(['User-Agent' => 'Mozilla/5.0 (compatible; DeliFileBot/1.0)'])
                ->get($url);

            if (!$response->successful()) {
                return [];
            }

            $html = mb_substr($response->body(), 0, 100_000);
            return $this->parseOg($html);
        } catch (\Throwable) {
            return [];
        }
    }

    private function parseOg(string $html): array
    {
        $meta = [];

        if (preg_match('/<meta[^>]+property=["\']og:title["\'][^>]+content=["\'](.*?)["\'][^>]*>/si', $html, $m)) {
            $meta['link_title'] = html_entity_decode(trim($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        } elseif (preg_match('/<title[^>]*>(.*?)<\/title>/si', $html, $m)) {
            $meta['link_title'] = html_entity_decode(trim($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        }

        if (preg_match('/<meta[^>]+property=["\']og:description["\'][^>]+content=["\'](.*?)["\'][^>]*>/si', $html, $m)) {
            $meta['link_description'] = html_entity_decode(trim($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        }

        if (preg_match('/<meta[^>]+property=["\']og:image["\'][^>]+content=["\'](.*?)["\'][^>]*>/si', $html, $m)) {
            $imageUrl = trim($m[1]);
            if ($imageUrl && filter_var($imageUrl, FILTER_VALIDATE_URL)) {
                $meta['link_image_url'] = $imageUrl;
            }
        }

        if (preg_match('/<meta[^>]+property=["\']og:site_name["\'][^>]+content=["\'](.*?)["\'][^>]*>/si', $html, $m)) {
            $meta['link_site_name'] = html_entity_decode(trim($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        }

        return $meta;
    }
}
