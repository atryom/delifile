<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use App\Services\LockPassService;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class LockPass2FATest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config([
            'lockpass.api_url'          => 'https://lockpass.test/api',
            'lockpass.api_token'        => 'proj-token',
            'lockpass.project_id'       => '1',
            'lockpass.service_email'    => 'service@test.test',
            'lockpass.service_password' => 'secret',
        ]);
        Cache::forget('lockpass_sanctum_token');
    }

    // ─── Login: 2FA triggered ────────────────────────────────────────────────

    public function test_login_triggers_2fa_when_enabled(): void
    {
        Http::fake([
            'lockpass.test/api/2fa/session/create-v2' => Http::response([
                'session_id' => 'sess-abc-123',
                'qr_payload' => 'qr-data',
                'status'     => 'pending',
            ], 200),
        ]);

        $user = User::factory()->create([
            'email'              => 'twofa@example.com',
            'password'           => bcrypt('password123'),
            'lockpass_user_id'   => 42,
            'two_factor_enabled' => true,
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email'    => 'twofa@example.com',
            'password' => 'password123',
        ]);

        $response->assertOk()
            ->assertJsonPath('result', 'success')
            ->assertJsonPath('data.requires_2fa', true)
            ->assertJsonStructure(['data' => ['requires_2fa', 'session_id', 'expires_at']]);

        $this->assertTrue(Cache::has('lockpass_2fa_sess-abc-123'));
    }

    public function test_login_skips_2fa_when_not_enabled(): void
    {
        $user = User::factory()->create([
            'email'              => 'no2fa@example.com',
            'password'           => bcrypt('password123'),
            'two_factor_enabled' => false,
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email'    => 'no2fa@example.com',
            'password' => 'password123',
        ]);

        $response->assertOk()
            ->assertJsonStructure(['data' => ['token', 'user']]);

        $this->assertArrayNotHasKey('requires_2fa', $response->json('data'));
    }

    public function test_login_returns_503_when_lockpass_is_down(): void
    {
        Http::fake([
            'lockpass.test/api/2fa/session/create-v2' => Http::response([], 503),
        ]);

        User::factory()->create([
            'email'              => 'fail2fa@example.com',
            'password'           => bcrypt('password123'),
            'lockpass_user_id'   => 99,
            'two_factor_enabled' => true,
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email'    => 'fail2fa@example.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(503)
            ->assertJsonPath('data.code', 'TWO_FA_UNAVAILABLE');
    }

    // ─── GET /api/v1/auth/2fa/qr ─────────────────────────────────────────────

    public function test_qr_returns_project_qr(): void
    {
        Http::fake([
            'lockpass.test/api/integration/qr/1' => Http::response([
                'qr_payload' => 'qr-string',
                'deep_link'  => 'lockpass://project/1/connect',
                'app_store'  => 'https://apps.apple.com/app/lockpass',
                'ru_store'   => 'https://rustore.ru/app/lockpass',
            ], 200),
        ]);

        $response = $this->getJson('/api/v1/auth/2fa/qr');

        $response->assertOk()
            ->assertJsonPath('data.qr_payload', 'qr-string')
            ->assertJsonStructure(['data' => ['qr_payload', 'deep_link', 'app_store', 'ru_store']]);
    }

    public function test_qr_returns_503_when_lockpass_down(): void
    {
        Http::fake([
            'lockpass.test/api/integration/qr/1' => Http::response([], 503),
        ]);

        $response = $this->getJson('/api/v1/auth/2fa/qr');
        $response->assertStatus(503)->assertJsonPath('data.code', 'LOCKPASS_UNAVAILABLE');
    }

    // ─── POST /api/v1/auth/2fa/poll ──────────────────────────────────────────

    public function test_poll_returns_pending_status(): void
    {
        $user = User::factory()->create();
        Cache::put('lockpass_2fa_sess-poll-1', [
            'user_id' => $user->id, 'device_id' => null,
            'device_type' => null, 'device_name' => 'Web', 'user_agent' => null, 'ip' => null,
        ], now()->addMinutes(5));

        Http::fake([
            'lockpass.test/api/2fa/sessions/sess-poll-1' => Http::response(['status' => 'pending'], 200),
        ]);

        $response = $this->postJson('/api/v1/auth/2fa/poll', ['session_id' => 'sess-poll-1']);

        $response->assertOk()->assertJsonPath('data.status', 'pending');
        $this->assertTrue(Cache::has('lockpass_2fa_sess-poll-1'));
    }

    public function test_poll_returns_token_when_approved(): void
    {
        $user = User::factory()->create();
        Cache::put('lockpass_2fa_sess-poll-2', [
            'user_id' => $user->id, 'device_id' => null,
            'device_type' => null, 'device_name' => 'Web', 'user_agent' => null, 'ip' => null,
        ], now()->addMinutes(5));

        Http::fake([
            'lockpass.test/api/2fa/sessions/sess-poll-2' => Http::response(['status' => 'approved'], 200),
        ]);

        $response = $this->postJson('/api/v1/auth/2fa/poll', ['session_id' => 'sess-poll-2']);

        $response->assertOk()
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonStructure(['data' => ['status', 'token', 'user']]);

        $this->assertFalse(Cache::has('lockpass_2fa_sess-poll-2'));
    }

    public function test_poll_returns_rejected_status(): void
    {
        $user = User::factory()->create();
        Cache::put('lockpass_2fa_sess-poll-3', [
            'user_id' => $user->id, 'device_id' => null,
            'device_type' => null, 'device_name' => 'Web', 'user_agent' => null, 'ip' => null,
        ], now()->addMinutes(5));

        Http::fake([
            'lockpass.test/api/2fa/sessions/sess-poll-3' => Http::response(['status' => 'rejected'], 200),
        ]);

        $response = $this->postJson('/api/v1/auth/2fa/poll', ['session_id' => 'sess-poll-3']);
        $response->assertOk()->assertJsonPath('data.status', 'rejected');
    }

    public function test_poll_returns_404_when_session_not_in_cache(): void
    {
        $response = $this->postJson('/api/v1/auth/2fa/poll', ['session_id' => 'nonexistent-id']);
        $response->assertStatus(404)->assertJsonPath('data.code', 'SESSION_NOT_FOUND');
    }

    public function test_poll_requires_session_id(): void
    {
        $response = $this->postJson('/api/v1/auth/2fa/poll', []);
        $response->assertStatus(422);
    }

    // ─── POST /api/v1/auth/2fa/totp ──────────────────────────────────────────

    public function test_totp_returns_token_on_valid_code(): void
    {
        $user = User::factory()->create();
        Cache::put('lockpass_2fa_sess-totp-1', [
            'user_id' => $user->id, 'device_id' => null,
            'device_type' => null, 'device_name' => 'Web', 'user_agent' => null, 'ip' => null,
        ], now()->addMinutes(5));

        Http::fake([
            'lockpass.test/api/2fa/session/verify-code' => Http::response(['message' => 'approved'], 200),
        ]);

        $response = $this->postJson('/api/v1/auth/2fa/totp', [
            'session_id' => 'sess-totp-1',
            'code'       => '123456',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonStructure(['data' => ['status', 'token', 'user']]);
    }

    public function test_totp_returns_422_on_invalid_code(): void
    {
        $user = User::factory()->create();
        Cache::put('lockpass_2fa_sess-totp-2', [
            'user_id' => $user->id, 'device_id' => null,
            'device_type' => null, 'device_name' => 'Web', 'user_agent' => null, 'ip' => null,
        ], now()->addMinutes(5));

        Http::fake([
            'lockpass.test/api/2fa/session/verify-code' => Http::response([
                'message'      => 'Invalid code',
                'attempts_left' => 4,
            ], 422),
        ]);

        $response = $this->postJson('/api/v1/auth/2fa/totp', [
            'session_id' => 'sess-totp-2',
            'code'       => '000000',
        ]);

        $response->assertStatus(422)->assertJsonPath('data.code', 'TOTP_INVALID');
    }

    public function test_totp_validates_6_digit_code(): void
    {
        $response = $this->postJson('/api/v1/auth/2fa/totp', [
            'session_id' => 'sess-1',
            'code'       => '12345', // 5 digits
        ]);
        $response->assertStatus(422);
    }

    // ─── POST /api/v1/auth/2fa/recovery ──────────────────────────────────────

    public function test_recovery_returns_token_on_valid_code(): void
    {
        $user = User::factory()->create();
        Cache::put('lockpass_2fa_sess-rec-1', [
            'user_id' => $user->id, 'device_id' => null,
            'device_type' => null, 'device_name' => 'Web', 'user_agent' => null, 'ip' => null,
        ], now()->addMinutes(5));

        Http::fake([
            'lockpass.test/api/2fa/session/verify-recovery' => Http::response(['message' => 'approved'], 200),
        ]);

        $response = $this->postJson('/api/v1/auth/2fa/recovery', [
            'session_id' => 'sess-rec-1',
            'code'       => 'abc1-def2',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonStructure(['data' => ['status', 'token', 'user']]);
    }

    public function test_recovery_returns_422_on_invalid_code(): void
    {
        $user = User::factory()->create();
        Cache::put('lockpass_2fa_sess-rec-2', [
            'user_id' => $user->id, 'device_id' => null,
            'device_type' => null, 'device_name' => 'Web', 'user_agent' => null, 'ip' => null,
        ], now()->addMinutes(5));

        Http::fake([
            'lockpass.test/api/2fa/session/verify-recovery' => Http::response([
                'message'      => 'Invalid recovery code',
                'attempts_left' => 2,
            ], 422),
        ]);

        $response = $this->postJson('/api/v1/auth/2fa/recovery', [
            'session_id' => 'sess-rec-2',
            'code'       => 'bad-code',
        ]);

        $response->assertStatus(422)->assertJsonPath('data.code', 'RECOVERY_INVALID');
    }

    // ─── POST /api/v1/auth/2fa/init-connect ─────────────────────────────────

    public function test_init_connect_returns_qr_and_token(): void
    {
        Http::fake([
            'lockpass.test/api/auth/login'                   => Http::response(['token' => 'sanctum-tok'], 200),
            'lockpass.test/api/integration/init-connect/1'   => Http::response([
                'temp_token' => 'tmp-abc',
                'qr_payload' => 'lockpass://connect/tmp-abc',
                'deep_link'  => 'lockpass://project/1/connect?token=tmp-abc',
            ], 200),
        ]);

        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson('/api/v1/auth/2fa/init-connect');

        $response->assertOk()
            ->assertJsonPath('data.temp_token', 'tmp-abc')
            ->assertJsonStructure(['data' => ['temp_token', 'qr_payload', 'deep_link']]);
    }

    public function test_init_connect_requires_auth(): void
    {
        $response = $this->postJson('/api/v1/auth/2fa/init-connect');
        $response->assertStatus(401);
    }

    public function test_init_connect_returns_503_when_lockpass_down(): void
    {
        Http::fake([
            'lockpass.test/api/auth/login'                  => Http::response(['token' => 'sanctum-tok'], 200),
            'lockpass.test/api/integration/init-connect/1'  => Http::response([], 503),
        ]);

        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson('/api/v1/auth/2fa/init-connect');
        $response->assertStatus(503)->assertJsonPath('data.code', 'LOCKPASS_UNAVAILABLE');
    }

    // ─── GET /api/v1/auth/2fa/poll-connect/{tempToken} ───────────────────────

    public function test_poll_connect_returns_pending(): void
    {
        Http::fake([
            'lockpass.test/api/auth/login'                           => Http::response(['token' => 'sanctum-tok'], 200),
            'lockpass.test/api/integration/poll-connect/tmp-abc'     => Http::response(['status' => 'pending'], 200),
        ]);

        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson('/api/v1/auth/2fa/poll-connect/tmp-abc');
        $response->assertOk()->assertJsonPath('data.status', 'pending');
    }

    public function test_poll_connect_saves_user_on_connected(): void
    {
        Http::fake([
            'lockpass.test/api/auth/login'                       => Http::response(['token' => 'sanctum-tok'], 200),
            'lockpass.test/api/integration/poll-connect/tmp-abc' => Http::response([
                'status'           => 'connected',
                'lockpass_user_id' => 777,
            ], 200),
            'lockpass.test/api/2fa/user/status*' => Http::response([
                'two_factor_enabled' => true,
                'devices_count'      => 1,
            ], 200),
        ]);

        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson('/api/v1/auth/2fa/poll-connect/tmp-abc');

        $response->assertOk()
            ->assertJsonPath('data.status', 'connected')
            ->assertJsonPath('data.user.lockpass_user_id', 777)
            ->assertJsonPath('data.user.two_factor_enabled', true);

        $user->refresh();
        $this->assertSame(777, (int) $user->lockpass_user_id);
        $this->assertTrue($user->two_factor_enabled);
    }

    public function test_poll_connect_rejects_duplicate_lockpass_user_id(): void
    {
        Http::fake([
            'lockpass.test/api/auth/login'                       => Http::response(['token' => 'sanctum-tok'], 200),
            'lockpass.test/api/integration/poll-connect/tmp-dup' => Http::response([
                'status'           => 'connected',
                'lockpass_user_id' => 888,
            ], 200),
        ]);

        User::factory()->create(['lockpass_user_id' => 888]);
        $another = User::factory()->create();

        $response = $this->actingAs($another)->getJson('/api/v1/auth/2fa/poll-connect/tmp-dup');
        $response->assertStatus(422)->assertJsonPath('data.code', 'LOCKPASS_ALREADY_LINKED');
    }

    public function test_poll_connect_requires_auth(): void
    {
        $response = $this->getJson('/api/v1/auth/2fa/poll-connect/tmp-abc');
        $response->assertStatus(401);
    }

    // ─── POST /api/v1/settings/2fa/enable ────────────────────────────────────

    public function test_enable_saves_lockpass_user_id_and_syncs_status(): void
    {
        Http::fake([
            'lockpass.test/api/2fa/user/status*' => Http::response([
                'two_factor_enabled' => true,
                'devices_count'      => 1,
            ], 200),
        ]);

        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson('/api/v1/settings/2fa/enable', [
            'lockpass_user_id' => 777,
        ]);

        $response->assertOk()
            ->assertJsonPath('data.user.lockpass_user_id', 777)
            ->assertJsonPath('data.user.two_factor_enabled', true);

        $user->refresh();
        $this->assertSame(777, (int) $user->lockpass_user_id);
        $this->assertTrue($user->two_factor_enabled);
    }

    public function test_enable_prevents_duplicate_lockpass_user_id(): void
    {
        $existing = User::factory()->create(['lockpass_user_id' => 888]);
        $another  = User::factory()->create();

        $response = $this->actingAs($another)->postJson('/api/v1/settings/2fa/enable', [
            'lockpass_user_id' => 888,
        ]);

        $response->assertStatus(422)->assertJsonPath('data.code', 'LOCKPASS_ALREADY_LINKED');
    }

    public function test_enable_requires_auth(): void
    {
        $response = $this->postJson('/api/v1/settings/2fa/enable', ['lockpass_user_id' => 1]);
        $response->assertStatus(401);
    }

    // ─── POST /api/v1/settings/2fa/disable ───────────────────────────────────

    public function test_disable_clears_2fa_fields(): void
    {
        $user = User::factory()->create([
            'lockpass_user_id'   => 999,
            'two_factor_enabled' => true,
            'devices_count'      => 2,
        ]);

        $response = $this->actingAs($user)->postJson('/api/v1/settings/2fa/disable');

        $response->assertOk()
            ->assertJsonPath('data.user.lockpass_user_id', null)
            ->assertJsonPath('data.user.two_factor_enabled', false);

        $user->refresh();
        $this->assertNull($user->lockpass_user_id);
        $this->assertFalse($user->two_factor_enabled);
    }

    public function test_disable_requires_auth(): void
    {
        $response = $this->postJson('/api/v1/settings/2fa/disable');
        $response->assertStatus(401);
    }

    // ─── formatUser includes 2FA fields ─────────────────────────────────────

    public function test_me_returns_2fa_fields(): void
    {
        $user = User::factory()->create([
            'lockpass_user_id'   => 123,
            'two_factor_enabled' => true,
            'devices_count'      => 2,
        ]);

        $response = $this->actingAs($user)->getJson('/api/v1/auth/me');

        $response->assertOk()
            ->assertJsonPath('data.user.lockpass_user_id', 123)
            ->assertJsonPath('data.user.two_factor_enabled', true)
            ->assertJsonPath('data.user.devices_count', 2);
    }

    public function test_me_returns_null_lockpass_id_when_not_set(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson('/api/v1/auth/me');

        $response->assertOk()
            ->assertJsonPath('data.user.lockpass_user_id', null)
            ->assertJsonPath('data.user.two_factor_enabled', false);
    }
}
