<?php

namespace Tests\Feature\Files;

use App\Models\File;
use App\Models\FileUserAccess;
use App\Models\User;
use Tests\TestCase;

class TaskDateFilterTest extends TestCase
{
    private function createTaskFile(User $owner, array $attributes = []): File
    {
        return File::factory()->create(array_merge([
            'owner_id' => $owner->id,
            'is_task'  => true,
        ], $attributes));
    }

    private function grantOwnerAccess(User $user, File $file): void
    {
        FileUserAccess::factory()->owner()->create([
            'file_id' => $file->id,
            'user_id' => $user->id,
        ]);
    }

    private function fileIdsFromResponse(array $response): array
    {
        return array_column($response['data']['items'], 'id');
    }

    public function test_task_with_overlapping_range_is_included(): void
    {
        $user = User::factory()->create();
        $task = $this->createTaskFile($user, [
            'task_start_date' => '2026-01-10',
            'task_due_date'   => '2026-01-20',
        ]);
        $this->grantOwnerAccess($user, $task);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/files?is_task=true&task_date_from=2026-01-15&task_date_to=2026-01-25');

        $response->assertOk();
        $this->assertContains($task->id, $this->fileIdsFromResponse($response->json()));
    }

    public function test_task_with_non_overlapping_range_is_excluded(): void
    {
        $user = User::factory()->create();
        $task = $this->createTaskFile($user, [
            'task_start_date' => '2026-01-01',
            'task_due_date'   => '2026-01-05',
        ]);
        $this->grantOwnerAccess($user, $task);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/files?is_task=true&task_date_from=2026-01-10&task_date_to=2026-01-20');

        $response->assertOk();
        $this->assertNotContains($task->id, $this->fileIdsFromResponse($response->json()));
    }

    public function test_task_with_null_start_date_is_included_when_due_in_range(): void
    {
        $user = User::factory()->create();
        $task = $this->createTaskFile($user, [
            'task_start_date' => null,
            'task_due_date'   => '2026-01-15',
        ]);
        $this->grantOwnerAccess($user, $task);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/files?is_task=true&task_date_from=2026-01-10&task_date_to=2026-01-20');

        $response->assertOk();
        $this->assertContains($task->id, $this->fileIdsFromResponse($response->json()));
    }

    public function test_task_with_null_due_date_is_included_when_start_in_range(): void
    {
        $user = User::factory()->create();
        $task = $this->createTaskFile($user, [
            'task_start_date' => '2026-01-15',
            'task_due_date'   => null,
        ]);
        $this->grantOwnerAccess($user, $task);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/files?is_task=true&task_date_from=2026-01-10&task_date_to=2026-01-20');

        $response->assertOk();
        $this->assertContains($task->id, $this->fileIdsFromResponse($response->json()));
    }

    public function test_task_with_both_null_dates_is_excluded_when_filter_active(): void
    {
        $user = User::factory()->create();
        $task = $this->createTaskFile($user, [
            'task_start_date' => null,
            'task_due_date'   => null,
        ]);
        $this->grantOwnerAccess($user, $task);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/files?is_task=true&task_date_from=2026-01-10&task_date_to=2026-01-20');

        $response->assertOk();
        $this->assertNotContains($task->id, $this->fileIdsFromResponse($response->json()));
    }

    public function test_only_date_from_filter_works_correctly(): void
    {
        $user = User::factory()->create();

        // task1: due=2026-01-05, no start — due is before from, should be excluded
        $task1 = $this->createTaskFile($user, [
            'task_start_date' => null,
            'task_due_date'   => '2026-01-05',
        ]);
        $this->grantOwnerAccess($user, $task1);

        // task2: due=2026-01-15, no start — due is after from, should be included
        $task2 = $this->createTaskFile($user, [
            'task_start_date' => null,
            'task_due_date'   => '2026-01-15',
        ]);
        $this->grantOwnerAccess($user, $task2);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/files?is_task=true&task_date_from=2026-01-10');

        $response->assertOk();
        $ids = $this->fileIdsFromResponse($response->json());

        $this->assertNotContains($task1->id, $ids);
        $this->assertContains($task2->id, $ids);
    }
}
