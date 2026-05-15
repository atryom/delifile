<?php

namespace Tests\Feature\Admin;

use App\Models\File;
use App\Models\User;
use Tests\TestCase;

class AdminTest extends TestCase
{
    public function test_non_superuser_cannot_access_admin(): void
    {
        $user = User::factory()->create(['is_superuser' => false]);

        $response = $this->actingAs($user)->getJson('/api/v1/admin/stats');

        $response->assertStatus(403)
            ->assertJsonPath('data.code', 'FORBIDDEN');
    }

    public function test_superuser_can_view_stats(): void
    {
        $admin = User::factory()->create(['is_superuser' => true]);

        $response = $this->actingAs($admin)->getJson('/api/v1/admin/stats');

        $response->assertOk()
            ->assertJsonPath('result', 'success')
            ->assertJsonStructure(['data' => ['total_users', 'total_files', 'total_size', 'pinned_files', 'pinned_size']]);
    }

    public function test_superuser_can_list_users(): void
    {
        $admin = User::factory()->create(['is_superuser' => true]);

        $response = $this->actingAs($admin)->getJson('/api/v1/admin/users');

        $response->assertOk()
            ->assertJsonStructure(['data' => ['items' => [['id', 'email', 'name', 'account_status', 'plan']]]]);
    }

    public function test_superuser_can_update_user_plan(): void
    {
        $admin = User::factory()->create(['is_superuser' => true]);
        $target = User::factory()->create();

        $response = $this->actingAs($admin)
            ->patchJson("/api/v1/admin/users/{$target->id}/plan", ['plan' => 'silver']);

        $response->assertOk();
        $target->refresh();
        $this->assertEquals('silver', $target->plan?->value);
    }

    public function test_update_plan_fails_with_invalid_plan(): void
    {
        $admin = User::factory()->create(['is_superuser' => true]);
        $target = User::factory()->create();

        $response = $this->actingAs($admin)
            ->patchJson("/api/v1/admin/users/{$target->id}/plan", ['plan' => 'platinum']);

        $response->assertStatus(422);
    }

    public function test_superuser_can_toggle_user_block(): void
    {
        $admin = User::factory()->create(['is_superuser' => true]);
        $target = User::factory()->create(['account_status' => 'active']);

        $response = $this->actingAs($admin)
            ->postJson("/api/v1/admin/users/{$target->id}/block");

        $response->assertOk();
        $target->refresh();
        $this->assertEquals('blocked_unverified_email', $target->account_status);
    }

    public function test_superuser_can_generate_reset_link(): void
    {
        $admin = User::factory()->create(['is_superuser' => true]);
        $target = User::factory()->create();

        $response = $this->actingAs($admin)
            ->postJson("/api/v1/admin/users/{$target->id}/reset-link");

        $response->assertOk()
            ->assertJsonStructure(['data' => ['url']]);
        $this->assertStringContainsString('/reset-password?token=', $response->json('data.url'));
    }

    public function test_superuser_can_reset_user_sessions(): void
    {
        $admin = User::factory()->create(['is_superuser' => true]);
        $target = User::factory()->create();

        $response = $this->actingAs($admin)
            ->postJson("/api/v1/admin/users/{$target->id}/reset-sessions");

        $response->assertOk();
    }

    public function test_nonexistent_user_returns_404(): void
    {
        $admin = User::factory()->create(['is_superuser' => true]);

        $response = $this->actingAs($admin)
            ->postJson('/api/v1/admin/users/nonexistent/block');

        $response->assertStatus(404);
    }

    public function test_superuser_can_notify_user(): void
    {
        $admin = User::factory()->create(['is_superuser' => true, 'notifications_enabled' => false]);
        $target = User::factory()->create(['notifications_enabled' => false]);

        $response = $this->actingAs($admin)
            ->postJson("/api/v1/admin/users/{$target->id}/notify", [
                'title' => 'Test',
                'body'  => 'Test body',
            ]);

        $response->assertOk();
    }

    public function test_notify_requires_title_and_body(): void
    {
        $admin = User::factory()->create(['is_superuser' => true]);
        $target = User::factory()->create();

        $response = $this->actingAs($admin)
            ->postJson("/api/v1/admin/users/{$target->id}/notify", []);

        $response->assertStatus(422);
    }

    public function test_notify_all_sends_to_users(): void
    {
        $admin = User::factory()->create(['is_superuser' => true, 'notifications_enabled' => false]);
        User::factory()->count(3)->create(['notifications_enabled' => false]);

        $response = $this->actingAs($admin)
            ->postJson('/api/v1/admin/notify-all', [
                'title' => 'Broadcast',
                'body'  => 'To all users',
            ]);

        $response->assertOk();
    }

    public function test_unauthenticated_user_cannot_access_admin(): void
    {
        $response = $this->getJson('/api/v1/admin/stats');
        $response->assertUnauthorized();
    }

    public function test_superuser_block_skip_if_not_found(): void
    {
        $admin = User::factory()->create(['is_superuser' => true]);

        $response = $this->actingAs($admin)
            ->postJson('/api/v1/admin/users/nonexistent-id/reset-sessions');

        $response->assertStatus(404);
    }
}
