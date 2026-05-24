<?php

namespace Tests\Feature\Auth;

use App\Models\DeviceSession;
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

    public function test_login_with_device_info_creates_device_session(): void
    {
        $user = User::factory()->create([
            'email'    => 'mobile@example.com',
            'password' => bcrypt('password123'),
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email'       => 'mobile@example.com',
            'password'    => 'password123',
            'device_id'   => 'test-device-uuid-1234',
            'device_type' => 'android',
            'device_name' => 'Samsung Galaxy S23',
        ])->assertOk();

        $session = DeviceSession::where('user_id', $user->id)
            ->where('device_id', 'test-device-uuid-1234')
            ->first();

        $this->assertNotNull($session);
        $this->assertSame('android', $session->device_type);
        $this->assertSame('Samsung Galaxy S23', $session->device_name);
    }

    public function test_repeated_login_with_same_device_id_reuses_session(): void
    {
        $user = User::factory()->create([
            'email'    => 'repeat@example.com',
            'password' => bcrypt('password123'),
        ]);

        $payload = [
            'email'       => 'repeat@example.com',
            'password'    => 'password123',
            'device_id'   => 'stable-device-uuid',
            'device_type' => 'android',
            'device_name' => 'Pixel 8',
        ];

        $this->postJson('/api/v1/auth/login', $payload)->assertOk();
        $this->postJson('/api/v1/auth/login', $payload)->assertOk();

        $sessionCount = DeviceSession::where('user_id', $user->id)
            ->where('device_id', 'stable-device-uuid')
            ->count();

        $this->assertSame(1, $sessionCount);
    }
}
