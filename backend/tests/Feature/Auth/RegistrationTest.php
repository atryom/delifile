<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    public function test_user_can_register(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'email'                 => 'test@example.com',
            'password'              => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'result',
                'message',
                'data' => ['token', 'user'],
            ])
            ->assertJson(['result' => 'success']);

        $this->assertDatabaseHas('users', [
            'email' => 'test@example.com',
            'account_status' => 'pending_email_verification',
        ]);
    }

    public function test_registration_with_duplicate_email_fails(): void
    {
        User::factory()->create(['email' => 'test@example.com']);

        $response = $this->postJson('/api/v1/auth/register', [
            'email'                 => 'test@example.com',
            'password'              => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'result' => 'error',
                'data' => ['code' => 'VALIDATION_ERROR'],
            ]);
    }

    public function test_registration_requires_password_confirmation(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'email'    => 'test@example.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(422);
    }

    public function test_registration_requires_min_password_length(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'email'                 => 'test@example.com',
            'password'              => 'short',
            'password_confirmation' => 'short',
        ]);

        $response->assertStatus(422);
    }

    public function test_registration_creates_pending_verification(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'email'                 => 'test@example.com',
            'password'              => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertStatus(201);
        $user = User::where('email', 'test@example.com')->first();
        $this->assertNotNull($user);
        $this->assertEquals('pending_email_verification', $user->account_status);
        $this->assertNotNull($user->email_verification_deadline_at);
    }
}
