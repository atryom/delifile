<?php

namespace Tests\Feature\Push;

use App\Models\DevicePushToken;
use App\Models\User;
use App\Services\PushNotificationService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class MobilePushSendTest extends TestCase
{
    private string $serviceAccountPath;

    protected function setUp(): void
    {
        parent::setUp();
        $this->serviceAccountPath = storage_path('firebase-service-account.json');
        $this->writeTestServiceAccount();
        Cache::forget('fcm_access_token');
    }

    protected function tearDown(): void
    {
        if (file_exists($this->serviceAccountPath)) {
            unlink($this->serviceAccountPath);
        }
        Cache::forget('fcm_access_token');
        parent::tearDown();
    }

    private function writeTestServiceAccount(): void
    {
        $key = openssl_pkey_new(['private_key_bits' => 512, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        openssl_pkey_export($key, $privateKey);

        file_put_contents($this->serviceAccountPath, json_encode([
            'type'         => 'service_account',
            'project_id'   => 'test-project',
            'private_key'  => $privateKey,
            'client_email' => 'test@test-project.iam.gserviceaccount.com',
        ]));
    }

    private function fakeFcmHttp(): void
    {
        Http::fake([
            'oauth2.googleapis.com/*' => Http::response(['access_token' => 'test-token', 'expires_in' => 3600], 200),
            'fcm.googleapis.com/*'    => Http::response(['name' => 'projects/test-project/messages/1234'], 200),
        ]);
    }

    // ── Sending ───────────────────────────────────────────────────────────────

    public function test_fcm_message_sent_to_registered_android_device(): void
    {
        $this->fakeFcmHttp();

        $user = User::factory()->create();
        DevicePushToken::create(['user_id' => $user->id, 'token' => 'fcm-android-token', 'platform' => 'android']);

        app(PushNotificationService::class)->sendToUser($user, 'Title', 'Body', 'https://example.com/files/1');

        Http::assertSent(fn($r) =>
            str_contains($r->url(), 'fcm.googleapis.com') &&
            $r['message']['token'] === 'fcm-android-token' &&
            $r['message']['notification']['title'] === 'Title' &&
            $r['message']['data']['url'] === 'https://example.com/files/1'
        );
    }

    public function test_fcm_message_sent_to_all_devices_of_user(): void
    {
        $this->fakeFcmHttp();

        $user = User::factory()->create();
        DevicePushToken::create(['user_id' => $user->id, 'token' => 'token-1', 'platform' => 'android']);
        DevicePushToken::create(['user_id' => $user->id, 'token' => 'token-2', 'platform' => 'android']);

        app(PushNotificationService::class)->sendToUser($user, 'Title', 'Body');

        Http::assertSentCount(3); // 1 OAuth2 token + 2 FCM messages
    }

    public function test_fcm_not_called_when_user_has_no_device_tokens(): void
    {
        $this->fakeFcmHttp();

        $user = User::factory()->create();

        app(PushNotificationService::class)->sendToUser($user, 'Title', 'Body');

        Http::assertNothingSent();
    }

    public function test_oauth2_token_is_cached_between_sends(): void
    {
        $this->fakeFcmHttp();

        $user = User::factory()->create();
        DevicePushToken::create(['user_id' => $user->id, 'token' => 'token-a', 'platform' => 'android']);

        $service = app(PushNotificationService::class);
        $service->sendToUser($user, 'First', 'Body');
        $service->sendToUser($user, 'Second', 'Body');

        // OAuth2 endpoint called only once (token cached)
        Http::assertSent(fn($r) => str_contains($r->url(), 'oauth2.googleapis.com'));
        $oauth2Calls = collect(Http::recorded())->filter(fn($pair) =>
            str_contains($pair[0]->url(), 'oauth2.googleapis.com')
        )->count();
        $this->assertSame(1, $oauth2Calls);
    }

    public function test_invalid_token_removed_after_unregistered_error(): void
    {
        Http::fake([
            'oauth2.googleapis.com/*' => Http::response(['access_token' => 'test-token'], 200),
            'fcm.googleapis.com/*'    => Http::response([
                'error' => [
                    'code'    => 404,
                    'status'  => 'UNREGISTERED',
                    'details' => [['errorCode' => 'UNREGISTERED']],
                ],
            ], 404),
        ]);

        $user  = User::factory()->create();
        $token = DevicePushToken::create(['user_id' => $user->id, 'token' => 'stale-token', 'platform' => 'android']);

        app(PushNotificationService::class)->sendToUser($user, 'Title', 'Body');

        $this->assertDatabaseMissing('device_push_tokens', ['id' => $token->id]);
    }

    public function test_send_does_not_throw_when_service_account_missing(): void
    {
        unlink($this->serviceAccountPath);

        $user = User::factory()->create();
        DevicePushToken::create(['user_id' => $user->id, 'token' => 'some-token', 'platform' => 'android']);

        // Must not throw — mobile push is non-critical
        $this->expectNotToPerformAssertions();
        app(PushNotificationService::class)->sendToUser($user, 'Title', 'Body');
    }
}