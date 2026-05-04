<?php

namespace App\Console\Commands;

use App\Services\EmailVerificationService;
use App\Services\InvitationService;
use Illuminate\Console\Command;

class BlockUnverifiedAccounts extends Command
{
    protected $signature   = 'auth:block-unverified';
    protected $description = 'Block user accounts that missed the email verification deadline';

    public function handle(
        EmailVerificationService $verificationService,
        InvitationService $invitationService
    ): int {
        $blocked = $verificationService->blockOverdue();
        $expired = $invitationService->expireOverdue();

        $this->info("Blocked {$blocked} unverified accounts.");
        $this->info("Expired {$expired} invitations.");

        return 0;
    }
}
