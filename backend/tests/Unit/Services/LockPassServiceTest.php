<?php

namespace Tests\Unit\Services;

use App\Models\User;
use App\Services\LockPassService;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Tests\TestCase;

class LockPassServiceTest extends TestCase
{
    private LockPassService $service;

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'lockpass.api_url'    => 'https://lockpass.test/api',
            'lockpass.api_token'  => 'test-token',
            'lockpass.project_id' => '42',
        ]);
        $this->service = new LockPassService();
    }

    // ─── create2FASession ────────────────────────────────────────────────────

    public function test_create2fa_session_returns_data(): void
    {
        Http::fake([
            'lockpass.test/api/2fa/session/create-v2' => Http::response([
                'session_id' => 'sess-uuid-1',
                'qr_payload' => 'qr-data',
                'status'     => 'pending',
            ], 200),
        ]);

        $result = $this->service->create2FASession(111);

        $this->assertSame('sess-uuid-1', $result['session_id']);
        $this->assertSame('pending', $result['status']);

        Http::assertSent(fn ($req) =>
            $req->url() === 'https://lockpass.test/api/2fa/session/create-v2' &&
            $req['user_id'] === 111 &&
            $req['client_app'] === 'delifile' &&
            $req->hasHeader('Authorization', 'Bearer test-token')
        );
    }

    public function test_create2fa_session_throws_on_error_response(): void
    {
        Http::fake([
            'lockpass.test/api/2fa/session/create-v2' => Http::response([], 500),
        ]);

        $this->expectException(RuntimeException::class);
        $this->service->create2FASession(111);
    }

    public function test_create2fa_session_throws_on_connection_failure(): void
    {
        Http::fake([
            'lockpass.test/api/2fa/session/create-v2' => function () {
                throw new ConnectionException('Connection refused');
            },
        ]);

        $this->expectException(RuntimeException::class);
        $this->service->create2FASession(111);
    }

    // ─── getSessionStatus ────────────────────────────────────────────────────

    public function test_get_session_status_returns_data(): void
    {
        Http::fake([
            'lockpass.test/api/2fa/sessions/sess-1' => Http::response([
                'status' => 'approved',
            ], 200),
        ]);

        $result = $this->service->getSessionStatus('sess-1');

        $this->assertSame('approved', $result['status']);
    }

    public function test_get_session_status_no_auth_header(): void
    {
        Http::fake([
            'lockpass.test/api/2fa/sessions/sess-1' => Http::response(['status' => 'pending'], 200),
        ]);

        $this->service->getSessionStatus('sess-1');

        Http::assertSent(fn ($req) => !$req->hasHeader('Authorization'));
    }

    // ─── check2FAStatus ──────────────────────────────────────────────────────

    public function test_check2fa_status_returns_data(): void
    {
        Http::fake([
            'lockpass.test/api/2fa/user/status*' => Http::response([
                'two_factor_enabled' => true,
                'devices_count'      => 2,
            ], 200),
        ]);

        $result = $this->service->check2FAStatus(999);

        $this->assertTrue($result['two_factor_enabled']);
        $this->assertSame(2, $result['devices_count']);
    }

    // ─── sync2FAStatus ───────────────────────────────────────────────────────

    public function test_sync2fa_status_updates_user(): void
    {
        Http::fake([
            'lockpass.test/api/2fa/user/status*' => Http::response([
                'two_factor_enabled' => true,
                'devices_count'      => 3,
            ], 200),
        ]);

        $user = User::factory()->create(['lockpass_user_id' => 555]);

        $this->service->sync2FAStatus($user);

        $user->refresh();
        $this->assertTrue($user->two_factor_enabled);
        $this->assertSame(3, $user->devices_count);
    }

    // ─── verifyTOTPCode ──────────────────────────────────────────────────────

    public function test_verify_totp_code_success(): void
    {
        Http::fake([
            'lockpass.test/api/2fa/session/verify-code' => Http::response(['message' => 'approved'], 200),
        ]);

        $result = $this->service->verifyTOTPCode('sess-1', '123456');
        $this->assertSame('approved', $result['message']);
    }

    public function test_verify_totp_code_throws_request_exception_on_422(): void
    {
        Http::fake([
            'lockpass.test/api/2fa/session/verify-code' => Http::response([
                'message'      => 'Invalid code',
                'attempts_left' => 3,
            ], 422),
        ]);

        $this->expectException(RequestException::class);
        $this->service->verifyTOTPCode('sess-1', '000000');
    }

    // ─── verifyRecoveryCode ──────────────────────────────────────────────────

    public function test_verify_recovery_code_success(): void
    {
        Http::fake([
            'lockpass.test/api/2fa/session/verify-recovery' => Http::response(['message' => 'approved'], 200),
        ]);

        $result = $this->service->verifyRecoveryCode('sess-1', 'abc1-def2');
        $this->assertSame('approved', $result['message']);
    }

    public function test_verify_recovery_code_throws_on_422(): void
    {
        Http::fake([
            'lockpass.test/api/2fa/session/verify-recovery' => Http::response([
                'message'      => 'Invalid recovery code',
                'attempts_left' => 2,
            ], 422),
        ]);

        $this->expectException(RequestException::class);
        $this->service->verifyRecoveryCode('sess-1', 'bad-code');
    }

    // ─── getProjectQR ────────────────────────────────────────────────────────

    public function test_get_project_qr_returns_data(): void
    {
        Http::fake([
            'lockpass.test/api/integration/qr/42' => Http::response([
                'qr_payload' => 'qr-string',
                'deep_link'  => 'lockpass://project/42/connect',
                'app_store'  => 'https://apps.apple.com/app/lockpass',
                'ru_store'   => 'https://rustore.ru/app/lockpass',
            ], 200),
        ]);

        $result = $this->service->getProjectQR();

        $this->assertSame('qr-string', $result['qr_payload']);
    }

    public function test_get_project_qr_throws_on_unavailable(): void
    {
        Http::fake([
            'lockpass.test/api/integration/qr/42' => Http::response([], 503),
        ]);

        $this->expectException(RuntimeException::class);
        $this->service->getProjectQR();
    }
}
