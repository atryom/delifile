<?php

namespace App\Http\Controllers\Push;

use App\Http\Controllers\Controller;
use App\Models\DevicePushToken;
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

    /**
     * POST /api/v1/push/device-token
     * Register an Expo / FCM device token for mobile push notifications.
     */
    public function registerDeviceToken(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token'     => 'required|string|max:500',
            'platform'  => 'required|in:android,ios',
            'device_id' => 'nullable|string|max:255',
        ]);

        DevicePushToken::updateOrCreate(
            [
                'user_id' => $request->user()->id,
                'token'   => $data['token'],
            ],
            [
                'platform'  => $data['platform'],
                'device_id' => $data['device_id'] ?? null,
            ]
        );

        return $this->success('Токен зарегистрирован');
    }

    /**
     * DELETE /api/v1/push/device-token
     * Remove a device token on logout or permission revoke.
     */
    public function unregisterDeviceToken(Request $request): JsonResponse
    {
        $request->validate(['token' => 'required|string']);

        $request->user()->devicePushTokens()
            ->where('token', $request->token)
            ->delete();

        return $this->success('Токен удалён');
    }
}
