<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Mail\AdminNotificationMail;
use App\Models\DeviceSession;
use App\Models\File;
use App\Models\FileUserAccess;
use App\Models\PasswordResetCode;
use App\Models\User;
use App\Services\PushNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class AdminController extends Controller
{
    public function __construct(
        private readonly PushNotificationService $pushService,
    ) {}
    /**
     * GET /api/v1/admin/users
     */
    public function users(): JsonResponse
    {
        $users = User::select('id', 'email', 'name', 'account_status', 'email_verified_at', 'plan', 'is_superuser', 'notifications_enabled', 'created_at')
            ->orderByDesc('created_at')
            ->get()
            ->map(function (User $user) {
                $lastActive = DeviceSession::where('user_id', $user->id)
                    ->orderByDesc('last_active_at')
                    ->value('last_active_at');

                return [
                    'id'                    => $user->id,
                    'email'                 => $user->email,
                    'name'                  => $user->name,
                    'account_status'        => $user->account_status,
                    'email_verified'        => $user->isEmailVerified(),
                    'plan'                  => $user->plan?->value,
                    'is_superuser'          => $user->is_superuser,
                    'notifications_enabled' => (bool) $user->notifications_enabled,
                    'last_login_at'         => $lastActive?->toIso8601String(),
                    'created_at'            => $user->created_at?->toIso8601String(),
                ];
            });

        return $this->success('Список пользователей получен', ['items' => $users]);
    }

    /**
     * PATCH /api/v1/admin/users/{id}/plan
     */
    public function updatePlan(Request $request, string $userId): JsonResponse
    {
        $request->validate([
            'plan' => ['required', 'string', 'in:free,silver,gold'],
        ]);

        $user = User::find($userId);
        if (!$user) {
            return $this->notFound('Пользователь не найден');
        }

        $user->update(['plan' => $request->plan]);

        return $this->success('Тарифный план изменён');
    }

    /**
     * POST /api/v1/admin/users/{id}/block
     */
    public function blockUser(string $userId): JsonResponse
    {
        $user = User::find($userId);
        if (!$user) {
            return $this->notFound('Пользователь не найден');
        }

        $newStatus = $user->account_status === 'active' ? 'blocked_unverified_email' : 'active';
        $user->update(['account_status' => $newStatus]);

        return $this->success('Статус пользователя обновлён', ['account_status' => $newStatus]);
    }

    /**
     * POST /api/v1/admin/users/{id}/reset-link
     */
    public function generateResetLink(string $userId): JsonResponse
    {
        $user = User::find($userId);
        if (!$user || !$user->email) {
            return $this->notFound('Пользователь не найден');
        }

        PasswordResetCode::where('email', $user->email)->delete();

        $token = Str::random(64);
        $code  = (string) random_int(100000, 999999);

        PasswordResetCode::create([
            'email'      => $user->email,
            'token'      => $token,
            'code'       => $code,
            'expires_at' => now()->addHours(24),
        ]);

        $url = rtrim(config('app.url'), '/') . '/reset-password?token=' . $token;

        return $this->success('Ссылка сгенерирована', ['url' => $url]);
    }

    /**
     * POST /api/v1/admin/users/{id}/notify
     */
    public function notifyUser(Request $request, string $userId): JsonResponse
    {
        $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'body'  => ['required', 'string', 'max:1000'],
        ]);

        $user = User::with('pushSubscriptions')->find($userId);
        if (!$user) {
            return $this->notFound('Пользователь не найден');
        }

        if ($user->notifications_enabled) {
            $this->pushService->sendToUser($user, $request->title, $request->body);
        } elseif ($user->email) {
            Mail::to($user->email)->send(new AdminNotificationMail($user, $request->title, $request->body));
        }

        return $this->success('Сообщение отправлено');
    }

    /**
     * POST /api/v1/admin/notify-all
     */
    public function notifyAll(Request $request): JsonResponse
    {
        $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'body'  => ['required', 'string', 'max:1000'],
        ]);

        User::with('pushSubscriptions')->each(function (User $user) use ($request) {
            if ($user->notifications_enabled) {
                $this->pushService->sendToUser($user, $request->title, $request->body);
            } elseif ($user->email) {
                Mail::to($user->email)->send(new AdminNotificationMail($user, $request->title, $request->body));
            }
        });

        return $this->success('Сообщение разослано всем пользователям');
    }

    /**
     * POST /api/v1/admin/users/{id}/reset-sessions
     */
    public function resetSessions(string $userId): JsonResponse
    {
        $user = User::find($userId);
        if (!$user) {
            return $this->notFound('Пользователь не найден');
        }

        // Delete all device session records
        $sessionIds = DeviceSession::where('user_id', $user->id)->pluck('token_id');
        DeviceSession::where('user_id', $user->id)->delete();

        // Revoke all Sanctum personal access tokens for this user
        $user->tokens()->delete();

        return $this->success('Все сессии пользователя сброшены');
    }

    /**
     * GET /api/v1/admin/stats
     */
    public function stats(): JsonResponse
    {
        $totalUsers = User::count();

        $totalFiles = File::whereNotIn('status', ['deleted'])->count();
        $totalSize  = (int) File::whereNotIn('status', ['deleted'])->sum('size');

        $pinnedFileIds = FileUserAccess::whereNotNull('pinned_at')
            ->pluck('file_id')
            ->unique()
            ->values();

        $pinnedFiles = File::whereIn('id', $pinnedFileIds)
            ->whereNotIn('status', ['deleted'])
            ->count();

        $pinnedSize = (int) File::whereIn('id', $pinnedFileIds)
            ->whereNotIn('status', ['deleted'])
            ->sum('size');

        return $this->success('Статистика получена', [
            'total_users'  => $totalUsers,
            'total_files'  => $totalFiles,
            'total_size'   => $totalSize,
            'pinned_files' => $pinnedFiles,
            'pinned_size'  => $pinnedSize,
        ]);
    }
}
