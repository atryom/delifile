<?php

namespace App\Http\Controllers\Notifications;

use App\Enums\NotificationType;
use App\Http\Controllers\Controller;
use App\Models\UserNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * GET /api/v1/notifications
     * List notifications for the authenticated user, optionally filtered by group.
     */
    public function index(Request $request): JsonResponse
    {
        $group = $request->query('group'); // administrative | access | contacts | other
        $page  = max(1, (int) $request->query('page', 1));
        $limit = 30;

        $query = UserNotification::where('user_id', $request->user()->id)
            ->orderByDesc('created_at');

        if ($group) {
            $types = collect(NotificationType::cases())
                ->filter(fn ($t) => $t->group() === $group)
                ->map(fn ($t) => $t->value)
                ->values()
                ->toArray();
            $query->whereIn('type', $types);
        }

        $total = $query->count();
        $items = $query->skip(($page - 1) * $limit)->take($limit)->get()
            ->map(fn ($n) => $this->format($n));

        return response()->json([
            'result' => 'success',
            'data'   => [
                'items'      => $items,
                'total'      => $total,
                'page'       => $page,
                'last_page'  => max(1, (int) ceil($total / $limit)),
            ],
        ]);
    }

    /**
     * GET /api/v1/notifications/count
     * Returns count of unread notifications.
     */
    public function count(Request $request): JsonResponse
    {
        $unread = UserNotification::where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->count();

        return response()->json(['result' => 'success', 'data' => ['unread' => $unread]]);
    }

    /**
     * POST /api/v1/notifications/{id}/read
     * Mark a single notification as read.
     */
    public function markRead(Request $request, string $id): JsonResponse
    {
        $notification = UserNotification::where('user_id', $request->user()->id)
            ->where('id', $id)
            ->firstOrFail();

        $notification->update(['read_at' => now()]);

        return response()->json(['result' => 'success']);
    }

    /**
     * POST /api/v1/notifications/read-all
     * Mark all notifications as read.
     */
    public function markAllRead(Request $request): JsonResponse
    {
        UserNotification::where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json(['result' => 'success']);
    }

    private function format(UserNotification $n): array
    {
        return [
            'id'         => $n->id,
            'type'       => $n->type->value,
            'group'      => $n->type->group(),
            'title'      => $n->title,
            'body'       => $n->body,
            'data'       => $n->data,
            'read_at'    => $n->read_at?->toIso8601String(),
            'created_at' => $n->created_at->toIso8601String(),
        ];
    }
}
