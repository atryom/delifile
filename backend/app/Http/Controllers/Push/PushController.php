<?php

namespace App\Http\Controllers\Push;

use App\Http\Controllers\Controller;
use App\Models\PushSubscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PushController extends Controller
{
    /**
     * GET /api/v1/push/vapid-key
     * Public — returns the VAPID public key for PushManager.subscribe().
     */
    public function vapidKey(): JsonResponse
    {
        return $this->success('OK', [
            'public_key' => config('webpush.vapid.public_key'),
        ]);
    }

    /**
     * POST /api/v1/push/subscribe
     */
    public function subscribe(Request $request): JsonResponse
    {
        $request->validate([
            'endpoint' => 'required|string',
            'p256dh'   => 'required|string',
            'auth'     => 'required|string',
        ]);

        $hash = hash('sha256', $request->endpoint);

        PushSubscription::updateOrCreate(
            [
                'user_id'       => $request->user()->id,
                'endpoint_hash' => $hash,
            ],
            [
                'endpoint' => $request->endpoint,
                'p256dh'   => $request->p256dh,
                'auth'     => $request->auth,
            ]
        );

        return $this->success('Подписка сохранена');
    }

    /**
     * DELETE /api/v1/push/unsubscribe
     */
    public function unsubscribe(Request $request): JsonResponse
    {
        $request->validate(['endpoint' => 'required|string']);

        $hash = hash('sha256', $request->endpoint);

        $request->user()->pushSubscriptions()
            ->where('endpoint_hash', $hash)
            ->delete();

        return $this->success('Подписка удалена');
    }
}
