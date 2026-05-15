<?php

namespace Tests\Feature\User;

use App\Models\User;
use Tests\TestCase;

class UserSettingsTest extends TestCase
{
    public function test_user_can_update_settings(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->patchJson('/api/v1/user/settings', [
                'notifications_enabled' => false,
                'notify_new_files'      => true,
            ]);

        $response->assertOk()
            ->assertJsonPath('result', 'success')
            ->assertJsonStructure(['data' => ['user']]);
    }

    public function test_settings_persist_in_database(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->patchJson('/api/v1/user/settings', [
                'notifications_enabled' => false,
                'notify_new_files'      => false,
            ]);

        $user->refresh();
        $this->assertFalse((bool) $user->notifications_enabled);
        $this->assertFalse((bool) $user->notify_new_files);
    }

    public function test_user_can_update_contact_settings(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->patchJson('/api/v1/user/settings', [
                'allow_contacts_without_confirmation' => true,
                'auto_add_received_files'             => true,
            ]);

        $response->assertOk();
        $user->refresh();
        $this->assertTrue((bool) $user->allow_contacts_without_confirmation);
        $this->assertTrue((bool) $user->auto_add_received_files);
    }

    public function test_updating_with_invalid_boolean_fails(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->patchJson('/api/v1/user/settings', [
                'notifications_enabled' => 'not-a-boolean',
            ]);

        $response->assertStatus(422);
    }

    public function test_empty_update_succeeds(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->patchJson('/api/v1/user/settings', []);

        $response->assertOk();
    }

    public function test_unauthenticated_user_cannot_update_settings(): void
    {
        $response = $this->patchJson('/api/v1/user/settings', [
            'notifications_enabled' => true,
        ]);

        $response->assertUnauthorized();
    }
}
