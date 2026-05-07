<?php

namespace App\Services;

use App\Models\User;
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
    }
}
