<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Requests\Auth\ChangePasswordRequest;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    public function __construct(
        private readonly AuthService $authService
    ) {}

    /**
     * POST /api/v1/auth/register
     */
    public function register(RegisterRequest $request): JsonResponse
    {
        $result = $this->authService->register($request->validated());

        return $this->success(__('messages.auth.registered'), [
            'token'     => $result['token'],
            'user'      => $result['user'],
            'next_step' => 'pin_offer',
        ], 201);
    }

    /**
     * POST /api/v1/auth/login
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $result = $this->authService->login(
            $request->validated(),
            $request->userAgent(),
            $request->ip()
        );

        if (!$result) {
            return $this->error(__('messages.auth.invalid_credentials'), 'INVALID_CREDENTIALS', [], 401);
        }

        return $this->success(__('messages.auth.logged_in'), [
            'token' => $result['token'],
            'user'  => $result['user'],
        ]);
    }

    /**
     * POST /api/v1/auth/logout
     */
    public function logout(Request $request): JsonResponse
    {
        $this->authService->logout($request->user());

        return $this->success(__('messages.auth.logged_out'));
    }

    /**
     * POST /api/v1/auth/logout-all
     */
    public function logoutAll(Request $request): JsonResponse
    {
        $this->authService->logoutAll($request->user());

        return $this->success(__('messages.auth.all_sessions_terminated'));
    }

    /**
     * GET /api/v1/auth/me
     */
    public function me(Request $request): JsonResponse
    {
        return $this->success(__('messages.auth.user_fetched'), [
            'user' => [
                'id'    => $request->user()->id,
                'phone' => $request->user()->phone,
                'name'  => $request->user()->name,
            ],
        ]);
    }

    /**
     * GET /api/v1/auth/sessions
     */
    public function sessions(Request $request): JsonResponse
    {
        $sessions = $this->authService->getSessions($request->user());

        return $this->success(__('messages.auth.sessions_fetched'), [
            'items' => $sessions,
        ]);
    }

    /**
     * DELETE /api/v1/auth/sessions/{sessionId}
     */
    public function deleteSession(Request $request, string $sessionId): JsonResponse
    {
        $deleted = $this->authService->deleteSession($request->user(), $sessionId);

        if (!$deleted) {
            return $this->notFound('Session not found');
        }

        return $this->success(__('messages.auth.session_terminated'));
    }

    /**
     * POST /api/v1/auth/password/forgot
     */
    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate(['phone' => 'required|string']);

        // Stub: In production, trigger SMS flow
        $this->authService->sendPasswordResetToken($request->phone);

        return $this->success(__('messages.auth.reset_sent'));
    }

    /**
     * POST /api/v1/auth/password/reset
     */
    public function resetPassword(Request $request): JsonResponse
    {
        $request->validate([
            'phone'                 => 'required|string',
            'token'                 => 'required|string',
            'password'              => 'required|string|min:8|confirmed',
            'password_confirmation' => 'required|string',
        ]);

        $success = $this->authService->resetPassword(
            $request->phone,
            $request->token,
            $request->password
        );

        if (!$success) {
            return $this->error(__('messages.auth.reset_invalid'), 'INVALID_TOKEN', [], 422);
        }

        return $this->success(__('messages.auth.password_reset'));
    }

    /**
     * POST /api/v1/auth/password/change
     */
    public function changePassword(ChangePasswordRequest $request): JsonResponse
    {
        $success = $this->authService->changePassword(
            $request->user(),
            $request->validated()
        );

        if (!$success) {
            return $this->error(__('messages.auth.wrong_current_password'), 'WRONG_PASSWORD', [], 422);
        }

        return $this->success(__('messages.auth.password_changed'));
    }
}
