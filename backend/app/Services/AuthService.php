<?php

namespace App\Services;

use App\Models\DeviceSession;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class AuthService
{
    /**
     * Register a new user.
     */
    public function register(array $data): array
    {
        $user = User::create([
            'phone'    => $data['phone'],
            'password' => $data['password'],
        ]);

        $token = $user->createToken('web-spa');

        return [
            'token' => $token->plainTextToken,
            'user'  => [
                'id'    => $user->id,
                'phone' => $user->phone,
            ],
        ];
    }

    /**
     * Login user with phone and password. Returns user data or null on failure.
     */
    public function login(array $credentials, ?string $userAgent = null, ?string $ip = null): ?array
    {
        $user = User::where('phone', $credentials['phone'])->first();

        if (!$user || !Hash::check($credentials['password'], $user->password)) {
            return null;
        }

        // Create Sanctum token
        $token = $user->createToken('web-spa');

        // Record device session
        DeviceSession::create([
            'user_id'        => $user->id,
            'token_id'       => $token->accessToken->id,
            'device_name'    => 'Web Browser',
            'user_agent'     => $userAgent,
            'ip_address'     => $ip,
            'last_active_at' => now(),
        ]);

        return [
            'token' => $token->plainTextToken,
            'user'  => [
                'id'    => $user->id,
                'phone' => $user->phone,
                'name'  => $user->name,
            ],
        ];
    }

    /**
     * Logout current user session.
     */
    public function logout(User $user): void
    {
        // Revoke current token
        $user->currentAccessToken()?->delete();
    }

    /**
     * Logout all sessions.
     */
    public function logoutAll(User $user): void
    {
        $user->tokens()->delete();
        DeviceSession::where('user_id', $user->id)->delete();
    }

    /**
     * Get all active sessions for user.
     */
    public function getSessions(User $user): array
    {
        return DeviceSession::where('user_id', $user->id)
            ->orderByDesc('last_active_at')
            ->get()
            ->map(fn ($s) => [
                'id'             => $s->id,
                'device_name'    => $s->device_name,
                'ip_address'     => $s->ip_address,
                'last_active_at' => $s->last_active_at?->toIso8601String(),
            ])
            ->toArray();
    }

    /**
     * Terminate a specific session.
     */
    public function deleteSession(User $user, string $sessionId): bool
    {
        $session = DeviceSession::where('user_id', $user->id)
            ->where('id', $sessionId)
            ->first();

        if (!$session) {
            return false;
        }

        // Also revoke the associated sanctum token
        $user->tokens()->where('id', $session->token_id)->delete();
        $session->delete();

        return true;
    }

    /**
     * Stub: Send password reset token via SMS.
     */
    public function sendPasswordResetToken(string $phone): void
    {
        // TODO: Integrate real SMS provider
        // For MVP stub: store token in password_resets table
    }

    /**
     * Verify token and reset password.
     */
    public function resetPassword(string $phone, string $token, string $newPassword): bool
    {
        // TODO: Verify against password_resets table
        // Stub implementation
        $user = User::where('phone', $phone)->first();
        if (!$user) {
            return false;
        }

        $user->update(['password' => $newPassword]);
        return true;
    }

    /**
     * Change password for authenticated user.
     */
    public function changePassword(User $user, array $data): bool
    {
        if (!Hash::check($data['current_password'], $user->password)) {
            return false;
        }

        $user->update(['password' => $data['password']]);
        return true;
    }
}
