<?php

namespace App\Services;

use App\Mail\PasswordResetMail;
use App\Models\DeviceSession;
use App\Models\PasswordResetCode;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class PasswordResetService
{
    public function sendResetLink(string $email): void
    {
        $user = User::where('email', $email)->first();
        if (!$user) {
            return; // silent — don't reveal if email exists
        }

        // Remove expired tokens for this email (valid tokens are preserved until replaced by new ones)
        PasswordResetCode::where('email', $email)->where('expires_at', '<', now())->delete();

        $token = Str::random(64);
        $code  = (string) random_int(100000, 999999);

        PasswordResetCode::create([
            'email'      => $email,
            'token'      => $token,
            'code'       => $code,
            'expires_at' => now()->addHour(),
        ]);

        Mail::to($user)->send(new PasswordResetMail($user, $token, $code));
    }

    public function verify(string $value, ?string $email = null): ?PasswordResetCode
    {
        $query = PasswordResetCode::where('expires_at', '>', now())
            ->whereNull('used_at');

        if (strlen($value) === 6 && ctype_digit($value)) {
            if (!$email) {
                return null;
            }
            return $query->where('email', $email)->where('code', $value)->first();
        }

        return $query->where('token', $value)->first();
    }

    public function resetPassword(PasswordResetCode $record, string $password): void
    {
        $user = User::where('email', $record->email)->first();

        if (!$user) {
            return;
        }

        $user->update(['password' => Hash::make($password)]);

        // Revoke all sessions for security
        $user->tokens()->delete();
        DeviceSession::where('user_id', $user->id)->delete();

        $record->update(['used_at' => now()]);
    }
}
