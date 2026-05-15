<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use App\Models\PasswordResetCode;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    public function test_forgot_password_returns_success(): void
    {
        User::factory()->create(['email' => 'test@example.com']);

        $response = $this->postJson('/api/v1/auth/password/forgot', [
            'email' => 'test@example.com',
        ]);

        $response->assertOk()
            ->assertJson(['result' => 'success']);
    }

    public function test_forgot_password_for_nonexistent_email_still_returns_success(): void
    {
        $response = $this->postJson('/api/v1/auth/password/forgot', [
            'email' => 'nonexistent@example.com',
        ]);

        $response->assertOk()
            ->assertJson(['result' => 'success']);
    }

    public function test_verify_reset_token_with_valid_token(): void
    {
        $user = User::factory()->create(['email' => 'test@example.com']);
        $code = PasswordResetCode::create([
            'email'      => 'test@example.com',
            'token'      => 'valid-token',
            'code'       => '123456',
            'expires_at' => now()->addHour(),
        ]);

        $response = $this->postJson('/api/v1/auth/password/verify-reset-token', [
            'token' => 'valid-token',
            'email' => 'test@example.com',
        ]);

        $response->assertOk()
            ->assertJson(['result' => 'success']);
    }

    public function test_verify_invalid_reset_token_fails(): void
    {
        $response = $this->postJson('/api/v1/auth/password/verify-reset-token', [
            'token' => 'invalid-token',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('data.code', 'INVALID_RESET_TOKEN');
    }

    public function test_reset_password_with_valid_token(): void
    {
        $user = User::factory()->create([
            'email'    => 'test@example.com',
            'password' => bcrypt('oldpassword'),
        ]);

        $code = PasswordResetCode::create([
            'email'      => 'test@example.com',
            'token'      => 'valid-reset-token',
            'code'       => '123456',
            'expires_at' => now()->addHour(),
        ]);

        $response = $this->postJson('/api/v1/auth/password/reset', [
            'token'                 => 'valid-reset-token',
            'password'              => 'newpassword123',
            'password_confirmation' => 'newpassword123',
        ]);

        $response->assertOk()
            ->assertJson(['result' => 'success']);
    }

    public function test_reset_password_with_invalid_token_fails(): void
    {
        $response = $this->postJson('/api/v1/auth/password/reset', [
            'token'                 => 'invalid-token',
            'password'              => 'newpassword123',
            'password_confirmation' => 'newpassword123',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('data.code', 'INVALID_RESET_TOKEN');
    }
}
