<?php

namespace App\Http\Controllers\Activity;

use App\Http\Controllers\Controller;
use App\Services\ActivityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ActivityController extends Controller
{
    public function __construct(
        private readonly ActivityService $activityService
    ) {}

    /**
     * GET /api/v1/activity
     * Global activity feed for current user.
     */
    public function index(Request $request): JsonResponse
    {
        $page    = (int) $request->get('page', 1);
        $perPage = (int) $request->get('per_page', 30);

        $result = $this->activityService->getForUser($request->user(), $page, $perPage);

        return $this->success(__('messages.activity.fetched'), $result);
    }
}
