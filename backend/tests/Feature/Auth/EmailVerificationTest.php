<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Tests\TestCase;

class EmailVerificationTest extends TestCase
{
    public function test_user_can_resend_verification(): void
    {
        $user = User::factory()->unverified()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/auth/email/resend-verification');

        $response->assertOk()
            ->assertJson(['result' => 'success']);
    }

    public function test_verified_user_cannot_resend_verification(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/auth/email/resend-verification');

        $response->assertStatus(422)
            ->assertJsonPath('data.code', 'EMAIL_ALREADY_VERIFIED');
    }

    public function test_email_verify_redirects_to_spa(): void
    {
        $user = User::factory()->unverified()->create([
            'email_verification_token' => 'test-token-123',
        ]);

        $response = $this->getJson('/api/v1/auth/email/verify/test-token-123');

        $response->assertStatus(302);
    }

    public function test_user_can_change_email(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/auth/email/change', [
                'email' => 'newemail@example.com',
            ]);

        $response->assertOk()
            ->assertJson(['result' => 'success']);

        $this->assertEquals('newemail@example.com', $user->fresh()->email);
        $this->assertNull($user->fresh()->email_verified_at);
    }

    public function test_change_email_to_duplicate_fails(): void
    {
        User::factory()->create(['email' => 'existing@example.com']);
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/auth/email/change', [
                'email' => 'existing@example.com',
            ]);

        $response->assertStatus(422);
    }
}
