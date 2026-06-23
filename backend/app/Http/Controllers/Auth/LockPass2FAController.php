<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AuthService;
use App\Services\LockPassService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class LockPass2FAController extends Controller
{
    public function __construct(
        private readonly LockPassService $lockPass,
        private readonly AuthService     $authService,
    ) {}

    /**
     * GET /api/v1/auth/2fa/qr — public
     * Returns LockPass project QR code for onboarding.
     */
    public function qr(): JsonResponse
    {
        try {
            $data = $this->lockPass->getProjectQR();
            return $this->success('QR-код получен', $data);
        } catch (\Throwable $e) {
            Log::error('LockPass getProjectQR failed', ['error' => $e->getMessage()]);
            return $this->error('Сервис 2FA временно недоступен', 'LOCKPASS_UNAVAILABLE', [], 503);
        }
    }

    /**
     * POST /api/v1/auth/2fa/poll — public (session_id acts as a temporary credential)
     * Polls LockPass session status. If approved, issues Sanctum token.
     */
    public function poll(Request $request): JsonResponse
    {
        $request->validate(['session_id' => 'required|string']);

        $sessionId = $request->input('session_id');
        $cached    = Cache::get('lockpass_2fa_' . $sessionId);

        if (!$cached) {
            return $this->error('Сессия не найдена или истекла', 'SESSION_NOT_FOUND', [], 404);
        }

        try {
            $data   = $this->lockPass->getSessionStatus($sessionId);
            $status = $data['status'] ?? 'pending';
        } catch (\Throwable $e) {
            Log::error('LockPass poll failed', ['session_id' => $sessionId, 'error' => $e->getMessage()]);
            return $this->error('Сервис 2FA временно недоступен', 'LOCKPASS_UNAVAILABLE', [], 503);
        }

        if ($status === 'approved') {
            return $this->completeAuth($sessionId, $cached, $request);
        }

        return $this->success('Статус получен', ['status' => $status]);
    }

    /**
     * POST /api/v1/auth/2fa/totp — public
     * Verifies a 6-digit TOTP code. If valid, issues Sanctum token.
     */
    public function totp(Request $request): JsonResponse
    {
        $request->validate([
            'session_id' => 'required|string',
            'code'       => 'required|string|digits:6',
        ]);

        $sessionId = $request->input('session_id');
        $cached    = Cache::get('lockpass_2fa_' . $sessionId);

        if (!$cached) {
            return $this->error('Сессия не найдена или истекла', 'SESSION_NOT_FOUND', [], 404);
        }

        try {
            $this->lockPass->verifyTOTPCode($sessionId, $request->input('code'));
        } catch (\Illuminate\Http\Client\RequestException $e) {
            $body         = $e->response->json() ?? [];
            $attemptsLeft = $body['attempts_left'] ?? null;
            $errors       = $attemptsLeft !== null ? ['attempts_left' => $attemptsLeft] : [];
            return $this->error('Неверный код', 'TOTP_INVALID', $errors, 422);
        } catch (\Throwable $e) {
            Log::error('LockPass TOTP verify failed', ['error' => $e->getMessage()]);
            return $this->error('Сервис 2FA временно недоступен', 'LOCKPASS_UNAVAILABLE', [], 503);
        }

        return $this->completeAuth($sessionId, $cached, $request);
    }

    /**
     * POST /api/v1/auth/2fa/recovery — public
     * Verifies a recovery code. If valid, issues Sanctum token.
     */
    public function recovery(Request $request): JsonResponse
    {
        $request->validate([
            'session_id' => 'required|string',
            'code'       => 'required|string',
        ]);

        $sessionId = $request->input('session_id');
        $cached    = Cache::get('lockpass_2fa_' . $sessionId);

        if (!$cached) {
            return $this->error('Сессия не найдена или истекла', 'SESSION_NOT_FOUND', [], 404);
        }

        try {
            $this->lockPass->verifyRecoveryCode($sessionId, $request->input('code'));
        } catch (\Illuminate\Http\Client\RequestException $e) {
            $body         = $e->response->json() ?? [];
            $attemptsLeft = $body['attempts_left'] ?? null;
            $errors       = $attemptsLeft !== null ? ['attempts_left' => $attemptsLeft] : [];
            return $this->error('Неверный код восстановления', 'RECOVERY_INVALID', $errors, 422);
        } catch (\Throwable $e) {
            Log::error('LockPass recovery verify failed', ['error' => $e->getMessage()]);
            return $this->error('Сервис 2FA временно недоступен', 'LOCKPASS_UNAVAILABLE', [], 503);
        }

        return $this->completeAuth($sessionId, $cached, $request);
    }

    /**
     * POST /api/v1/auth/2fa/init-connect — requires Sanctum auth
     * Initiates a per-user LockPass connection; returns QR + temp_token.
     */
    public function initConnect(Request $request): JsonResponse
    {
        try {
            $data = $this->lockPass->initConnect();
            return $this->success('Подключение инициировано', $data);
        } catch (\Throwable $e) {
            Log::error('LockPass initConnect failed', ['error' => $e->getMessage()]);
            return $this->error('Сервис 2FA временно недоступен', 'LOCKPASS_UNAVAILABLE', [], 503);
        }
    }

    /**
     * GET /api/v1/auth/2fa/poll-connect/{tempToken} — requires Sanctum auth
     * Polls LockPass for connection status. When connected, saves lockpass_user_id to the user.
     */
    public function pollConnect(string $tempToken, Request $request): JsonResponse
    {
        try {
            $data   = $this->lockPass->pollConnect($tempToken);
            $status = $data['status'] ?? 'pending';
        } catch (\Throwable $e) {
            Log::error('LockPass pollConnect failed', ['error' => $e->getMessage()]);
            return $this->error('Сервис 2FA временно недоступен', 'LOCKPASS_UNAVAILABLE', [], 503);
        }

        if ($status !== 'connected') {
            return $this->success('Ожидание подключения', ['status' => $status]);
        }

        $lockpassUserId = $data['lockpass_user_id'] ?? null;
        if (!$lockpassUserId) {
            Log::error('LockPass pollConnect: connected but no lockpass_user_id', $data);
            return $this->error('Не удалось получить LockPass user ID', 'LOCKPASS_ERROR', [], 500);
        }

        $user = $request->user();

        $conflict = User::where('lockpass_user_id', $lockpassUserId)
            ->where('id', '!=', $user->id)
            ->exists();

        if ($conflict) {
            return $this->error(
                'Этот аккаунт LockPass уже привязан к другому пользователю',
                'LOCKPASS_ALREADY_LINKED',
                [],
                422
            );
        }

        $user->update(['lockpass_user_id' => $lockpassUserId]);

        try {
            $this->lockPass->sync2FAStatus($user->fresh());
        } catch (\Throwable $e) {
            Log::error('LockPass sync failed during poll-connect', ['error' => $e->getMessage()]);
        }

        return $this->success('LockPass подключён', [
            'status' => 'connected',
            'user'   => $this->authService->formatUser($user->fresh()),
        ]);
    }

    /**
     * POST /api/v1/settings/2fa/enable — requires Sanctum auth
     * Saves lockpass_user_id for the authenticated user and syncs 2FA status.
     */
    public function enable(Request $request): JsonResponse
    {
        $request->validate([
            'lockpass_user_id' => 'required|integer',
        ]);

        $user = $request->user();

        // Prevent linking a lockpass_user_id already used by another account
        $conflict = User::where('lockpass_user_id', $request->input('lockpass_user_id'))
            ->where('id', '!=', $user->id)
            ->exists();

        if ($conflict) {
            return $this->error(
                'Этот аккаунт LockPass уже привязан к другому пользователю',
                'LOCKPASS_ALREADY_LINKED',
                [],
                422
            );
        }

        $user->update(['lockpass_user_id' => $request->input('lockpass_user_id')]);

        try {
            $this->lockPass->sync2FAStatus($user->fresh());
        } catch (\Throwable $e) {
            Log::error('LockPass sync failed during enable', ['error' => $e->getMessage()]);
            // Non-fatal: user is linked, status will sync on next login
        }

        return $this->success('2FA успешно включена', [
            'user' => $this->authService->formatUser($user->fresh()),
        ]);
    }

    /**
     * POST /api/v1/settings/2fa/disable — requires Sanctum auth
     * Removes LockPass binding and disables 2FA for the authenticated user.
     */
    public function disable(Request $request): JsonResponse
    {
        $request->user()->update([
            'lockpass_user_id'   => null,
            'two_factor_enabled' => false,
            'devices_count'      => 0,
        ]);

        return $this->success('2FA отключена', [
            'user' => $this->authService->formatUser($request->user()->fresh()),
        ]);
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private function completeAuth(string $sessionId, array $cached, Request $request): JsonResponse
    {
        Cache::forget('lockpass_2fa_' . $sessionId);

        $user   = User::findOrFail($cached['user_id']);
        $result = $this->authService->finalizeLogin($user, $cached, $cached['user_agent'], $cached['ip']);

        if (!empty($result['device_limit'])) {
            return $this->error(
                'Достигнуто максимальное количество устройств для вашего тарифного плана.',
                'DEVICE_LIMIT_EXCEEDED',
                [],
                403
            );
        }

        return $this->success('2FA подтверждена. Вход выполнен.', [
            'status' => 'approved',
            'token'  => $result['token'],
            'user'   => $result['user'],
        ]);
    }
}
