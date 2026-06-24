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

        if ($v = $this->ogAttr($html, 'og:title')) {
            $meta['link_title'] = html_entity_decode(trim($v), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        } elseif (preg_match('/<title[^>]*>(.*?)<\/title>/si', $html, $m)) {
            $meta['link_title'] = html_entity_decode(trim($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        }

        if ($v = $this->ogAttr($html, 'og:description')) {
            $meta['link_description'] = html_entity_decode(trim($v), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        }

        if ($v = $this->ogAttr($html, 'og:image')) {
            $imageUrl = trim($v);
            if ($imageUrl && filter_var($imageUrl, FILTER_VALIDATE_URL)) {
                $meta['link_image_url'] = $imageUrl;
            }
        }

        if ($v = $this->ogAttr($html, 'og:site_name')) {
            $meta['link_site_name'] = html_entity_decode(trim($v), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        }

        return $meta;
    }

    /**
     * Extracts the content of a meta OG property, handling both attribute orderings:
     *   <meta property="og:X" content="VALUE" />
     *   <meta content="VALUE" property="og:X" />
     */
    private function ogAttr(string $html, string $property): ?string
    {
        $escaped = preg_quote($property, '/');
        // property before content
        if (preg_match('/<meta[^>]+property=["\']' . $escaped . '["\'][^>]+content=["\'](.*?)["\'][^>]*>/si', $html, $m)) {
            return $m[1] !== '' ? $m[1] : null;
        }
        // content before property
        if (preg_match('/<meta[^>]+content=["\'](.*?)["\'][^>]+property=["\']' . $escaped . '["\'][^>]*>/si', $html, $m)) {
            return $m[1] !== '' ? $m[1] : null;
        }
        return null;
    }
}
