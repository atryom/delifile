<?php

namespace App\Services;

use App\Models\DeviceSession;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class AuthService
{
    public function __construct(
        private readonly EmailVerificationService $verificationService
    ) {}

    /**
     * Register a new user by email + password.
     */
    public function register(array $data): array
    {
        $user = User::create([
            'email'                          => $data['email'],
            'password'                       => $data['password'],
            'email_verification_deadline_at' => now()->addHours(24),
        ]);
        $user->account_status = 'pending_email_verification';
        $user->save();

        // Send verification email
        $this->verificationService->send($user);

        $token = $user->createToken('web-spa');

        return [
            'token' => $token->plainTextToken,
            'user'  => $this->formatUser($user),
        ];
    }

    /**
     * Login by email + password.
     */
    public function login(array $credentials, ?string $userAgent = null, ?string $ip = null): ?array
    {
        $user = User::where('email', $credentials['email'])->first();

        if (!$user || !Hash::check($credentials['password'], $user->password)) {
            return null;
        }

        if ($user->isBlocked()) {
            $token = $user->createToken('resend-verification');
            return [
                'blocked' => true,
                'user'    => $this->formatUser($user),
                'token'   => $token->plainTextToken,
            ];
        }

        $deviceId   = $credentials['device_id'] ?? null;
        $deviceType = $credentials['device_type'] ?? null;
        $deviceName = $credentials['device_name'] ?? $deviceType ?? 'Web Browser';

        $existingSession = $deviceId
            ? DeviceSession::where('user_id', $user->id)->where('device_id', $deviceId)->first()
            : null;

        if ($existingSession) {
            $user->tokens()->where('id', $existingSession->token_id)->delete();

            $token = $user->createToken('web-spa');

            $existingSession->update([
                'token_id'       => $token->accessToken->id,
                'device_name'    => $deviceName,
                'device_type'    => $deviceType,
                'user_agent'     => $userAgent,
                'ip_address'     => $ip,
                'last_active_at' => now(),
            ]);
        } else {
            $deviceLimit = $user->getPlan()->deviceLimit();
            if ($deviceLimit !== null && DeviceSession::where('user_id', $user->id)->count() >= $deviceLimit) {
                return ['device_limit' => true, 'user' => $this->formatUser($user)];
            }

            $token = $user->createToken('web-spa');

            DeviceSession::create([
                'user_id'        => $user->id,
                'token_id'       => $token->accessToken->id,
                'device_id'      => $deviceId,
                'device_type'    => $deviceType,
                'device_name'    => $deviceName,
                'user_agent'     => $userAgent,
                'ip_address'     => $ip,
                'last_active_at' => now(),
            ]);
        }

        return [
            'token' => $token->plainTextToken,
            'user'  => $this->formatUser($user),
        ];
    }

    public function logout(User $user): void
    {
        $user->currentAccessToken()?->delete();
    }

    public function logoutAll(User $user): void
    {
        $user->tokens()->delete();
        DeviceSession::where('user_id', $user->id)->delete();
    }

    public function getSessions(User $user): array
    {
        return DeviceSession::where('user_id', $user->id)
            ->orderByDesc('last_active_at')
            ->get()
            ->map(fn ($s) => [
                'id'             => $s->id,
                'device_name'    => $s->device_name,
                'device_type'    => $s->device_type,
                'ip_address'     => $s->ip_address,
                'last_active_at' => $s->last_active_at?->toIso8601String(),
            ])
            ->toArray();
    }

    public function deleteSession(User $user, string $sessionId): bool
    {
        $session = DeviceSession::where('user_id', $user->id)
            ->where('id', $sessionId)
            ->first();

        if (!$session) {
            return false;
        }

        $user->tokens()->where('id', $session->token_id)->delete();
        $session->delete();

        return true;
    }

    public function changePassword(User $user, array $data): bool
    {
        if (!Hash::check($data['current_password'], $user->password)) {
            return false;
        }

        $user->update(['password' => $data['password']]);
        return true;
    }

    /**
     * Change email for authenticated user (triggers new verification).
     */
    public function changeEmail(User $user, string $newEmail): void
    {
        $user->email                          = $newEmail;
        $user->email_verified_at              = null;
        $user->account_status                 = 'pending_email_verification';
        $user->email_verification_deadline_at = now()->addHours(24);
        $user->save();

        $this->verificationService->send($user);
    }

    public function formatUser(User $user): array
    {
        return [
            'id'                                    => $user->id,
            'email'                                 => $user->email,
            'name'                                  => $user->name,
            'email_verified'                        => $user->isEmailVerified(),
            'account_status'                        => $user->account_status,
            'email_verification_deadline_at'        => $user->email_verification_deadline_at?->toIso8601String(),
            'plan'                                  => $user->plan?->value,
            'is_superuser'                          => $user->is_superuser,
            'notifications_enabled'                 => (bool) ($user->notifications_enabled ?? true),
            'notify_new_files'                      => (bool) ($user->notify_new_files ?? true),
            'notify_folder_shared'                  => (bool) ($user->notify_folder_shared ?? true),
            'notify_shared_folder_updates'          => (bool) ($user->notify_shared_folder_updates ?? true),
            'notify_comments'                       => (bool) ($user->notify_comments ?? true),
            'notify_mentions'                       => (bool) ($user->notify_mentions ?? true),
            'notify_support_reply'                  => (bool) ($user->notify_support_reply ?? true),
            'notify_contacts_added'                 => (bool) ($user->notify_contacts_added ?? true),
            'allow_contacts_without_confirmation'   => (bool) ($user->allow_contacts_without_confirmation ?? true),
            'auto_add_received_files'               => (bool) ($user->auto_add_received_files ?? true),
        ];
    }
}