<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class LinkPreviewService
{
    /**
     * Fetch Open Graph / meta preview data for a URL.
     */
    public function fetch(string $url): array
    {
        try {
            $response = Http::timeout(8)
                ->withHeaders([
                    'User-Agent' => 'Mozilla/5.0 (compatible; DelifileBot/1.0)',
                    'Accept'     => 'text/html,application/xhtml+xml',
                ])
                ->get($url);

            if (!$response->successful()) {
                return $this->minimal($url);
            }

            $html = $response->body();
            return $this->parseHtml($html, $url);
        } catch (\Throwable $e) {
            Log::warning('LinkPreview fetch failed', ['url' => $url, 'error' => $e->getMessage()]);
            return $this->minimal($url);
        }
    }

    private function parseHtml(string $html, string $url): array
    {
        $title       = $this->meta($html, 'og:title')       ?? $this->htmlTitle($html);
        $description = $this->meta($html, 'og:description') ?? $this->meta($html, 'description');
        $image       = $this->meta($html, 'og:image');
        $siteName    = $this->meta($html, 'og:site_name');

        $parsed   = parse_url($url);
        $hostname = $parsed['host'] ?? $url;

        // Resolve relative image URLs
        if ($image && !str_starts_with($image, 'http')) {
            $base  = ($parsed['scheme'] ?? 'https') . '://' . $hostname;
            $image = $base . '/' . ltrim($image, '/');
        }

        return [
            'title'       => $title ? mb_substr(trim($title), 0, 500) : $hostname,
            'description' => $description ? mb_substr(trim($description), 0, 1000) : null,
            'image_url'   => $image,
            'site_name'   => $siteName ?? $hostname,
            'hostname'    => $hostname,
        ];
    }

    private function meta(string $html, string $name): ?string
    {
        // og: property
        if (preg_match('/<meta[^>]+property=["\']' . preg_quote($name, '/') . '["\'][^>]+content=["\']([^"\']*)["\'][^>]*>/i', $html, $m)) {
            return $m[1] ?: null;
        }
        // name=
        if (preg_match('/<meta[^>]+name=["\']' . preg_quote($name, '/') . '["\'][^>]+content=["\']([^"\']*)["\'][^>]*>/i', $html, $m)) {
            return $m[1] ?: null;
        }
        // reversed attribute order
        if (preg_match('/<meta[^>]+content=["\']([^"\']*)["\'][^>]+(?:property|name)=["\']' . preg_quote($name, '/') . '["\'][^>]*>/i', $html, $m)) {
            return $m[1] ?: null;
        }
        return null;
    }

    private function htmlTitle(string $html): ?string
    {
        if (preg_match('/<title[^>]*>(.*?)<\/title>/is', $html, $m)) {
            return html_entity_decode(strip_tags($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8') ?: null;
        }
        return null;
    }

    private function minimal(string $url): array
    {
        $parsed   = parse_url($url);
        $hostname = $parsed['host'] ?? $url;
        return [
            'title'       => $hostname,
            'description' => null,
            'image_url'   => null,
            'site_name'   => $hostname,
            'hostname'    => $hostname,
        ];
    }
}