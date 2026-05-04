<?php

namespace App\Services;

use App\Mail\VerifyEmailMail;
use App\Models\User;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class EmailVerificationService
{
    /**
     * Generate token and send verification email.
     */
    public function send(User $user): void
    {
        $token = Str::random(64);

        $user->update([
            'email_verification_token'   => $token,
            'email_verification_sent_at' => now(),
        ]);

        Mail::to($user->email)->send(new VerifyEmailMail($user, $token));
    }

    /**
     * Verify token and mark email as confirmed.
     */
    public function verify(string $token): ?User
    {
        $user = User::where('email_verification_token', $token)->first();

        if (!$user) {
            return null;
        }

        $user->update([
            'email_verified_at'          => now(),
            'email_verification_token'   => null,
            'account_status'             => 'active',
        ]);

        return $user;
    }

    /**
     * Block all users past their verification deadline.
     */
    public function blockOverdue(): int
    {
        return User::where('account_status', 'pending_email_verification')
            ->whereNull('email_verified_at')
            ->where('email_verification_deadline_at', '<=', now())
            ->update(['account_status' => 'blocked_unverified_email']);
    }
}