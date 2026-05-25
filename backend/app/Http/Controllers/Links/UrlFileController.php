<?php

namespace App\Http\Controllers\Links;

use App\Http\Controllers\Controller;
use App\Services\FileService;
use App\Services\LinkPreviewService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class UrlFileController extends Controller
{
    public function __construct(
        private readonly LinkPreviewService $previewService,
        private readonly FileService        $fileService
    ) {}

    /**
     * POST /api/v1/links-preview
     * Fetch preview metadata before saving.
     */
    public function preview(Request $request): JsonResponse
    {
        $request->validate(['url' => 'required|url|max:2048']);

        $preview = $this->previewService->fetch($request->url);

        return $this->success('Preview fetched', ['preview' => $preview]);
    }

    /**
     * POST /api/v1/url-files
     * Create a url_file object.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(['url' => 'required|url|max:2048']);

        $preview = $this->previewService->fetch($data['url']);
        $result  = $this->fileService->createUrlFile($request->user(), $data['url'], $preview);

        return $this->success('Link saved successfully', $result, 201);
    }

}
