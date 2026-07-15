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
     * Handles both standard 2FA sessions and anonymous login sessions.
     */
    public function poll(Request $request): JsonResponse
    {
        $request->validate(['session_id' => 'required|string']);

        $sessionId = $request->input('session_id');
        $cached    = Cache::get('lockpass_2fa_' . $sessionId);

        if (!$cached) {
            return $this->error('Сессия не найдена или истекла', 'SESSION_NOT_FOUND', [], 404);
        }

        $isAnonymous = ($cached['session_type'] ?? null) === 'anonymous';

        try {
            if ($isAnonymous) {
                $data = $this->lockPass->getAnonymousLoginSessionStatus($sessionId);
            } else {
                $data = $this->lockPass->getSessionStatus($sessionId);
            }
            $status = $data['status'] ?? 'pending';
        } catch (\Throwable $e) {
            Log::error('LockPass poll failed', ['session_id' => $sessionId, 'error' => $e->getMessage()]);
            return $this->error('Сервис 2FA временно недоступен', 'LOCKPASS_UNAVAILABLE', [], 503);
        }

        if ($status === 'approved') {
            if ($isAnonymous) {
                return $this->completeAnonAuth($sessionId, $cached, $data, $request);
            }
            return $this->completeAuth($sessionId, $cached, $request);
        }

        return $this->success('Статус получен', ['status' => $status]);
    }

    /**
     * POST /api/v1/auth/lockpass/session-create — public
     * Creates an anonymous login session (no email/user_id needed). Returns QR payload.
     */
    public function createAnonymousSession(Request $request): JsonResponse
    {
        try {
            $data = $this->lockPass->createAnonymousLoginSession();
        } catch (\Throwable $e) {
            Log::error('LockPass createAnonymousSession failed', ['error' => $e->getMessage()]);
            return $this->error('Сервис LockPass временно недоступен', 'LOCKPASS_UNAVAILABLE', [], 503);
        }

        $sessionId = $data['session_id'] ?? null;
        if (!$sessionId) {
            return $this->error('Некорректный ответ от LockPass', 'LOCKPASS_ERROR', [], 502);
        }

        Cache::put('lockpass_2fa_' . $sessionId, [
            'session_type' => 'anonymous',
            'user_id'      => null,
            'device_id'    => $request->input('device_id'),
            'device_type'  => $request->input('device_type'),
            'device_name'  => $request->input('device_type') ?? 'Web Browser',
            'user_agent'   => $request->userAgent(),
            'ip'           => $request->ip(),
        ], now()->addMinutes(6));

        return $this->success('Анонимная сессия создана', [
            'session_id' => $sessionId,
            'qr_payload' => $data['qr_payload'] ?? null,
            'expires_at' => $data['expires_at'] ?? now()->addMinutes(5)->toIso8601String(),
        ]);
    }

    /**
     * POST /api/v1/auth/lockpass/verify-code — public
     * Verifies a login code from the LockPass "Одноразовый код" tab. Issues Sanctum token if valid.
     */
    public function verifyLoginCode(Request $request): JsonResponse
    {
        $request->validate([
            'code'        => 'required|string|digits:6',
            'device_id'   => 'nullable|string',
            'device_type' => 'nullable|string',
        ]);

        try {
            $data = $this->lockPass->verifyLoginCode($request->input('code'));
        } catch (\Illuminate\Http\Client\RequestException $e) {
            return $this->error('Неверный или устаревший код', 'LOGIN_CODE_INVALID', [], 422);
        } catch (\Throwable $e) {
            Log::error('LockPass verifyLoginCode failed', ['error' => $e->getMessage()]);
            return $this->error('Сервис LockPass временно недоступен', 'LOCKPASS_UNAVAILABLE', [], 503);
        }

        $lockpassUserId = $data['lockpass_user_id'] ?? null;
        if (!$lockpassUserId) {
            return $this->error('Некорректный ответ от LockPass', 'LOCKPASS_ERROR', [], 502);
        }

        $user = User::where('lockpass_user_id', $lockpassUserId)
            ->where('lockpass_auth_mode', 'alternative')
            ->first();

        if (!$user) {
            return $this->error('Аккаунт не найден или альтернативный вход не настроен', 'USER_NOT_FOUND', [], 422);
        }

        $deviceInfo = [
            'device_id'   => $request->input('device_id'),
            'device_type' => $request->input('device_type'),
            'device_name' => $request->input('device_type') ?? 'Web Browser',
        ];

        $result = $this->authService->finalizeLogin($user, $deviceInfo, $request->userAgent(), $request->ip());

        if (!empty($result['device_limit'])) {
            return $this->error(
                'Достигнуто максимальное количество устройств.',
                'DEVICE_LIMIT_EXCEEDED',
                [],
                403
            );
        }

        return $this->success('Вход выполнен.', [
            'status' => 'approved',
            'token'  => $result['token'],
            'user'   => $result['user'],
        ]);
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
     * POST /api/v1/auth/lockpass/login-init — public
     * Creates a LockPass session by email for the "alternative login" mode (no password needed).
     */
    public function loginInit(Request $request): JsonResponse
    {
        $request->validate([
            'email'       => 'required|email',
            'device_id'   => 'nullable|string',
            'device_type' => 'nullable|string',
        ]);

        $user = User::where('email', $request->input('email'))->first();

        if (!$user || !$user->lockpass_user_id || $user->lockpass_auth_mode !== 'alternative') {
            return $this->error(
                'Альтернативный вход через LockPass недоступен для этого аккаунта',
                'LOCKPASS_ALT_UNAVAILABLE',
                [],
                422
            );
        }

        if (!$user->two_factor_enabled) {
            return $this->error(
                'LockPass не настроен. Добавьте устройство в приложении LockPass.',
                'LOCKPASS_NOT_SETUP',
                [],
                422
            );
        }

        try {
            $session = $this->lockPass->create2FASession((int) $user->lockpass_user_id);

            Cache::put('lockpass_2fa_' . $session['session_id'], [
                'user_id'     => $user->id,
                'device_id'   => $request->input('device_id'),
                'device_type' => $request->input('device_type'),
                'device_name' => $request->input('device_type') ?? 'Web Browser',
                'user_agent'  => $request->userAgent(),
                'ip'          => $request->ip(),
            ], now()->addMinutes(6));

            return $this->success('Сессия создана', [
                'session_id' => $session['session_id'],
                'qr_payload' => $session['qr_payload'] ?? null,
                'expires_at' => now()->addMinutes(5)->toIso8601String(),
            ]);
        } catch (\Throwable $e) {
            Log::error('LockPass loginInit failed', ['error' => $e->getMessage()]);
            return $this->error('Сервис LockPass временно недоступен', 'LOCKPASS_UNAVAILABLE', [], 503);
        }
    }

    /**
     * POST /api/v1/settings/lockpass/set-mode — requires Sanctum auth
     * Sets the LockPass authentication mode for the authenticated user.
     */
    public function setMode(Request $request): JsonResponse
    {
        $request->validate([
            'mode' => 'required|string|in:2fa,alternative',
        ]);

        $user = $request->user();

        if (!$user->lockpass_user_id) {
            return $this->error('LockPass не подключён', 'LOCKPASS_NOT_CONNECTED', [], 422);
        }

        $user->update(['lockpass_auth_mode' => $request->input('mode')]);

        return $this->success('Режим LockPass обновлён', [
            'user' => $this->authService->formatUser($user->fresh()),
        ]);
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

        $user->update([
            'lockpass_user_id'   => $lockpassUserId,
            'lockpass_auth_mode' => $user->lockpass_auth_mode ?? '2fa',
        ]);

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
            'lockpass_auth_mode' => null,
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

    private function completeAnonAuth(string $sessionId, array $cached, array $lpData, Request $request): JsonResponse
    {
        Cache::forget('lockpass_2fa_' . $sessionId);

        $lockpassUserId = $lpData['lockpass_user_id'] ?? null;
        if (!$lockpassUserId) {
            Log::error('LockPass anonymous poll: approved but no lockpass_user_id', $lpData);
            return $this->error('Не удалось определить пользователя', 'LOCKPASS_ERROR', [], 500);
        }

        $user = User::where('lockpass_user_id', $lockpassUserId)
            ->where('lockpass_auth_mode', 'alternative')
            ->first();

        if (!$user) {
            return $this->error('Аккаунт не найден или альтернативный вход не настроен', 'USER_NOT_FOUND', [], 422);
        }

        $result = $this->authService->finalizeLogin($user, $cached, $cached['user_agent'], $cached['ip']);

        if (!empty($result['device_limit'])) {
            return $this->error(
                'Достигнуто максимальное количество устройств.',
                'DEVICE_LIMIT_EXCEEDED',
                [],
                403
            );
        }

        return $this->success('Вход выполнен.', [
            'status' => 'approved',
            'token'  => $result['token'],
            'user'   => $result['user'],
        ]);
    }
}
