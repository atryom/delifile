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

        if (!$subscriptions->isEmpty()) {
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

        $this->sendMobileToUser($user, $title, $body, $url);
    }

    private function sendMobileToUser(User $user, string $title, string $body, ?string $url = null): void
    {
        $tokens = $user->devicePushTokens()->pluck('token')->all();
        if (empty($tokens)) {
            return;
        }

        try {
            $accessToken = $this->getFcmAccessToken();
            $projectId   = $this->loadFirebaseCredentials()['project_id'];
            $endpoint    = "https://fcm.googleapis.com/v1/projects/{$projectId}/messages:send";

            $invalidTokens = [];
            foreach ($tokens as $token) {
                $response = Http::timeout(10)
                    ->withToken($accessToken)
                    ->post($endpoint, [
                        'message' => [
                            'token'        => $token,
                            'notification' => ['title' => $title, 'body' => $body],
                            'data'         => ['url' => $url ?? ''],
                            'android'      => [
                                'notification' => [
                                    'channel_id' => 'default',
                                    'sound'      => 'default',
                                ],
                            ],
                        ],
                    ]);

                if (!$response->successful()) {
                    $errorCode = $response->json('error.details.0.errorCode')
                        ?? $response->json('error.status')
                        ?? '';
                    if (in_array($errorCode, ['UNREGISTERED', 'INVALID_ARGUMENT'])) {
                        $invalidTokens[] = $token;
                    }
                }
            }

            if ($invalidTokens) {
                $user->devicePushTokens()->whereIn('token', $invalidTokens)->delete();
            }
        } catch (\Throwable) {
            // Non-critical
        }
    }

    private function getFcmAccessToken(): string
    {
        return \Illuminate\Support\Facades\Cache::remember('fcm_access_token', 3300, function () {
            $credentials = $this->loadFirebaseCredentials();
            $now    = time();
            $header = $this->base64url(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
            $claims = $this->base64url(json_encode([
                'iss'   => $credentials['client_email'],
                'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
                'aud'   => 'https://oauth2.googleapis.com/token',
                'iat'   => $now,
                'exp'   => $now + 3600,
            ]));
            $sig = '';
            openssl_sign("{$header}.{$claims}", $sig, $credentials['private_key'], OPENSSL_ALGO_SHA256);
            $jwt = "{$header}.{$claims}." . $this->base64url($sig);

            $resp = Http::asForm()->post('https://oauth2.googleapis.com/token', [
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion'  => $jwt,
            ]);

            return $resp->json('access_token');
        });
    }

    private function loadFirebaseCredentials(): array
    {
        static $cache = null;
        if ($cache !== null) {
            return $cache;
        }
        $path = storage_path('firebase-service-account.json');
        if (!file_exists($path)) {
            throw new \RuntimeException('Firebase service account not found: ' . $path);
        }
        return $cache = json_decode(file_get_contents($path), true);
    }

    private function base64url(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}
