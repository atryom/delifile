<?php

namespace App\Http\Controllers\Assets;

use App\Http\Controllers\Controller;
use App\Services\DocumentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AssetController extends Controller
{
    public function __construct(
        private readonly DocumentService $documentService
    ) {}

    /**
     * GET /api/v1/assets/images
     */
    public function images(Request $request): JsonResponse
    {
        $perPage = min((int) $request->get('per_page', 20), 100);
        $search  = $request->get('search');
        $cursor  = $request->get('cursor');

        $result = $this->documentService->getAccessibleImages(
            $request->user(),
            $search,
            $perPage,
            $cursor
        );

        return $this->success('Images fetched', $result);
    }
}
