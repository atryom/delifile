<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ChangePasswordRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Services\AuthService;
use App\Services\EmailVerificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    public function __construct(
        private readonly AuthService              $authService,
        private readonly EmailVerificationService $verificationService
    ) {}

    /**
     * POST /api/v1/auth/register
     */
    public function register(RegisterRequest $request): JsonResponse
    {
        $result = $this->authService->register($request->validated());

        return $this->success(
            'Учётная запись создана. Пожалуйста, подтвердите свой email в течение 24 часов.',
            [
                'token' => $result['token'],
                'user'  => $result['user'],
            ],
            201
        );
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
            return $this->error('Неверный email или пароль', 'INVALID_CREDENTIALS', [], 401);
        }

        if (!empty($result['blocked'])) {
            return $this->error(
                'Учётная запись заблокирована из-за неподтверждённого email.',
                'ACCOUNT_BLOCKED',
                ['user' => $result['user']],
                403
            );
        }

        return $this->success('Вход выполнен успешно', [
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
        return $this->success('Выход выполнен успешно');
    }

    /**
     * POST /api/v1/auth/logout-all
     */
    public function logoutAll(Request $request): JsonResponse
    {
        $this->authService->logoutAll($request->user());
        return $this->success('Все сессии завершены');
    }

    /**
     * GET /api/v1/auth/me
     */
    public function me(Request $request): JsonResponse
    {
        return $this->success('Текущий пользователь получен', [
            'user' => $this->authService->formatUser($request->user()),
        ]);
    }

    /**
     * GET /api/v1/auth/sessions
     */
    public function sessions(Request $request): JsonResponse
    {
        $sessions = $this->authService->getSessions($request->user());
        return $this->success('Сессии получены', ['items' => $sessions]);
    }

    /**
     * DELETE /api/v1/auth/sessions/{sessionId}
     */
    public function deleteSession(Request $request, string $sessionId): JsonResponse
    {
        if (!$this->authService->deleteSession($request->user(), $sessionId)) {
            return $this->notFound('Сессия не найдена');
        }
        return $this->success('Сессия завершена');
    }

    /**
     * POST /api/v1/auth/email/resend-verification
     */
    public function resendVerification(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->isEmailVerified()) {
            return $this->error('Email уже подтверждён', 'EMAIL_ALREADY_VERIFIED', [], 422);
        }

        $this->verificationService->send($user);

        return $this->success('Письмо с подтверждением отправлено');
    }

    /**
     * GET /api/v1/auth/email/verify/{token}
     */
    public function verifyEmail(string $token): \Illuminate\Http\RedirectResponse
    {
        $user = $this->verificationService->verify($token);

        $appUrl = rtrim(config('app.url'), '/');

        if (!$user) {
            return redirect($appUrl . '/?email_verified=false');
        }

        return redirect($appUrl . '/?email_verified=true');
    }

    /**
     * POST /api/v1/auth/email/change
     */
    public function changeEmail(Request $request): JsonResponse
    {
        $request->validate([
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
        ]);

        $this->authService->changeEmail($request->user(), $request->email);

        return $this->success('Email изменён. Подтвердите новый адрес в течение 24 часов.', [
            'user' => $this->authService->formatUser($request->user()->fresh()),
        ]);
    }

    /**
     * POST /api/v1/auth/password/change
     */
    public function changePassword(ChangePasswordRequest $request): JsonResponse
    {
        if (!$this->authService->changePassword($request->user(), $request->validated())) {
            return $this->error('Текущий пароль неверен', 'WRONG_PASSWORD', [], 422);
        }
        return $this->success('Пароль успешно изменён');
    }
}
