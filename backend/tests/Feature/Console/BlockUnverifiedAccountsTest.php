<?php

namespace Tests\Feature\Console;

use App\Models\Invitation;
use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class BlockUnverifiedAccountsTest extends TestCase
{
    public function test_blocks_overdue_unverified_accounts(): void
    {
        User::factory()->create([
            'account_status'               => 'pending_email_verification',
            'email_verified_at'            => null,
            'email_verification_deadline_at' => now()->subHour(),
        ]);

        Artisan::call('auth:block-unverified');

        $this->assertDatabaseHas('users', [
            'account_status' => 'blocked_unverified_email',
        ]);
    }

    public function test_does_not_block_verified_accounts(): void
    {
        User::factory()->create([
            'account_status'               => 'active',
            'email_verified_at'            => now(),
            'email_verification_deadline_at' => now()->subHour(),
        ]);

        Artisan::call('auth:block-unverified');

        $this->assertDatabaseMissing('users', [
            'account_status' => 'blocked_unverified_email',
        ]);
    }

    public function test_expires_overdue_invitations(): void
    {
        $sender = User::factory()->create();
        Invitation::factory()->create([
            'sender_user_id' => $sender->id,
            'status'         => 'pending',
            'expires_at'     => now()->subHour(),
        ]);

        Artisan::call('auth:block-unverified');

        $this->assertDatabaseHas('invitations', [
            'status' => 'expired',
        ]);
    }
}
