<?php

namespace Tests\Feature\Tariff;

use App\Enums\FileStatus;
use App\Models\DeviceSession;
use App\Models\File;
use App\Models\User;
use Tests\TestCase;

class TariffTest extends TestCase
{
    public function test_user_can_list_tariffs(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->getJson('/api/v1/tariffs');

        $response->assertOk()
            ->assertJsonPath('result', 'success')
            ->assertJsonStructure(['data' => ['plans' => [['key', 'price_rub', 'file_size_mb', 'storage_mb', 'device_limit']]]]);
    }

    public function test_tariff_list_contains_all_plans(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->getJson('/api/v1/tariffs');

        $response->assertOk();
        $plans = collect($response->json('data.plans'));
        $this->assertTrue($plans->pluck('key')->values()->diff(['free', 'silver', 'gold'])->isEmpty());
    }

    public function test_user_can_view_tariff_usage(): void
    {
        $user = User::factory()->create();
        File::factory()->count(2)->create(['owner_id' => $user->id, 'size' => 100]);
        DeviceSession::factory()->count(1)->create(['user_id' => $user->id]);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/tariffs/usage');

        $response->assertOk()
            ->assertJsonPath('result', 'success')
            ->assertJsonStructure(['data' => [
                'storage_used_bytes', 'storage_limit_bytes',
                'device_count', 'device_limit',
                'max_file_size_bytes', 'file_size_limit_bytes',
            ]]);
    }

    public function test_tariff_usage_excludes_deleted_files(): void
    {
        $user = User::factory()->create();
        File::factory()->create(['owner_id' => $user->id, 'size' => 500]);
        File::factory()->create(['owner_id' => $user->id, 'size' => 300, 'status' => FileStatus::Deleted]);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/tariffs/usage');

        $response->assertOk();
        $this->assertEquals(500, $response->json('data.storage_used_bytes'));
    }

    public function test_tariff_usage_excludes_uploading_files(): void
    {
        $user = User::factory()->create();
        File::factory()->uploading()->create(['owner_id' => $user->id, 'size' => 200]);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/tariffs/usage');

        $response->assertOk();
        $this->assertEquals(0, $response->json('data.storage_used_bytes'));
    }

    public function test_user_can_request_plan_change(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/tariffs/request', ['plan' => 'silver']);

        $response->assertOk()
            ->assertJsonPath('result', 'success');
    }

    public function test_request_plan_change_fails_with_invalid_plan(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/tariffs/request', ['plan' => 'platinum']);

        $response->assertStatus(422);
    }

    public function test_unauthenticated_user_cannot_access_tariffs(): void
    {
        $response = $this->getJson('/api/v1/tariffs');
        $response->assertUnauthorized();
    }
}
