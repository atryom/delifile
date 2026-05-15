<?php

namespace Tests\Feature\Activity;

use App\Models\ActivityLog;
use App\Models\File;
use App\Models\User;
use Tests\TestCase;

class ActivityTest extends TestCase
{
    private function createActivity(User $user, int $count = 1): void
    {
        $file = File::factory()->create(['owner_id' => $user->id]);
        ActivityLog::factory()->count($count)->create([
            'file_id' => $file->id,
            'user_id' => $user->id,
        ]);
    }

    public function test_user_can_list_activity(): void
    {
        $user = User::factory()->create();
        $this->createActivity($user, 3);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/activity');

        $response->assertOk()
            ->assertJsonPath('result', 'success')
            ->assertJsonStructure(['data' => ['items', 'pagination']]);
    }

    public function test_activity_is_paginated(): void
    {
        $user = User::factory()->create();
        $this->createActivity($user, 5);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/activity?page=1&per_page=2');

        $response->assertOk();
        $this->assertCount(2, $response->json('data.items'));
    }

    public function test_activity_returns_correct_structure(): void
    {
        $user = User::factory()->create();
        $this->createActivity($user);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/activity');

        $response->assertOk();
        $item = $response->json('data.items.0');
        $this->assertArrayHasKey('id', $item);
        $this->assertArrayHasKey('action', $item);
        $this->assertArrayHasKey('created_at', $item);
    }

    public function test_activity_only_shows_accessible_files(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $this->createActivity($user, 3);
        $otherFile = File::factory()->create(['owner_id' => $other->id]);
        ActivityLog::factory()->count(2)->create([
            'file_id' => $otherFile->id,
            'user_id' => $other->id,
        ]);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/activity');

        $response->assertOk();
        $this->assertCount(3, $response->json('data.items'));
    }

    public function test_unauthenticated_user_cannot_access_activity(): void
    {
        $response = $this->getJson('/api/v1/activity');
        $response->assertUnauthorized();
    }
}
