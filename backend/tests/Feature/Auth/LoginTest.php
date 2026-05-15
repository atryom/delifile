<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Tests\TestCase;

class LoginTest extends TestCase
{
    public function test_user_can_login(): void
    {
        $user = User::factory()->create([
            'email'    => 'test@example.com',
            'password' => bcrypt('password123'),
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email'    => 'test@example.com',
            'password' => 'password123',
        ]);

        $response->assertOk()
            ->assertJsonStructure([
                'result',
                'message',
                'data' => ['token', 'user'],
            ])
            ->assertJson(['result' => 'success']);
    }

    public function test_login_with_wrong_password_fails(): void
    {
        User::factory()->create([
            'email'    => 'test@example.com',
            'password' => bcrypt('password123'),
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email'    => 'test@example.com',
            'password' => 'wrongpassword',
        ]);

        $response->assertStatus(401)
            ->assertJson([
                'result' => 'error',
                'data' => ['code' => 'INVALID_CREDENTIALS'],
            ]);
    }

    public function test_login_with_nonexistent_email_fails(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email'    => 'nonexistent@example.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(401);
    }

    public function test_login_requires_email_and_password(): void
    {
        $response = $this->postJson('/api/v1/auth/login', []);

        $response->assertStatus(422);
    }

    public function test_blocked_user_can_login_with_limited_access(): void
    {
        $user = User::factory()->blocked()->create([
            'email'    => 'blocked@example.com',
            'password' => bcrypt('password123'),
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email'    => 'blocked@example.com',
            'password' => 'password123',
        ]);

        $response->assertOk()
            ->assertJson(['result' => 'success']);
    }
}
