<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Http;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

class PushNotificationService
{
    public function sendToUser(User $user, string $title, string $body, ?string $url = null): void
    {
        $subscriptions = $user->pushSubscriptions;
        if ($subscriptions->isEmpty()) return;

        $webPush = new WebPush([
            'VAPID' => [
                'subject'    => config('webpush.vapid.subject'),
                'publicKey'  => config('webpush.vapid.public_key'),
                'privateKey' => config('webpush.vapid.private_key'),
            ],
        ]);
        $webPush->setDefaultOptions(['TTL' => 86400]);

        $payload = json_encode([
            'title' => $title,
            'body'  => $body,
            'url'   => $url ?? config('app.url'),
            'icon'  => config('app.url') . '/assets/icons/icon-192.png',
            'badge' => config('app.url') . '/assets/icons/icon-72.png',
        ]);

        foreach ($subscriptions as $sub) {
            $subscription = Subscription::create([
                'endpoint'        => $sub->endpoint,
                'contentEncoding' => 'aesgcm',
                'keys'            => [
                    'p256dh' => $sub->p256dh,
                    'auth'   => $sub->auth,
                ],
            ]);
            $webPush->queueNotification($subscription, $payload);
        }

        $expiredHashes = [];
        foreach ($webPush->flush() as $report) {
            if ($report->isSubscriptionExpired()) {
                $expiredHashes[] = hash('sha256', $report->getEndpoint());
            }
        }

        if ($expiredHashes) {
            $user->pushSubscriptions()->whereIn('endpoint_hash', $expiredHashes)->delete();
        }

        $this->sendMobileToUser($user, $title, $body, $url);
    }

    /**
     * Send via Expo Push API to all registered mobile devices of the user.
     * Uses the free Expo relay (exp.host) — no Firebase Admin SDK required.
     */
    private function sendMobileToUser(User $user, string $title, string $body, ?string $url = null): void
    {
        $tokens = $user->devicePushTokens()->pluck('token')->all();
        if (empty($tokens)) {
            return;
        }

        $messages = array_map(fn(string $token) => [
            'to'    => $token,
            'title' => $title,
            'body'  => $body,
            'data'  => ['url' => $url ?? ''],
            'sound' => 'default',
        ], $tokens);

        try {
            $response = Http::timeout(10)
                ->withHeaders(['Accept-Encoding' => 'gzip, deflate'])
                ->post('https://exp.host/--/api/v2/push/send', $messages);

            // Remove tokens that are no longer valid
            if ($response->successful()) {
                $results = $response->json();
                $invalidTokens = [];
                foreach ((array) $results as $i => $result) {
                    if (($result['status'] ?? '') === 'error'
                        && ($result['details']['error'] ?? '') === 'DeviceNotRegistered') {
                        $invalidTokens[] = $tokens[$i];
                    }
                }
                if ($invalidTokens) {
                    $user->devicePushTokens()->whereIn('token', $invalidTokens)->delete();
                }
            }
        } catch (\Throwable) {
            // Non-critical — don't fail the main request if push delivery fails
        }
    }
}
