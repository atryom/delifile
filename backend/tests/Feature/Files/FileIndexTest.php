<?php

namespace Tests\Feature\Files;

use App\Models\User;
use App\Models\File;
use App\Models\FileUserAccess;
use App\Enums\AccessType;
use Tests\TestCase;

class FileIndexTest extends TestCase
{
    public function test_user_can_list_owned_files(): void
    {
        $user = User::factory()->create();
        File::factory()->count(3)->create(['owner_id' => $user->id]);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/files?filter=mine');

        $response->assertOk()
            ->assertJsonStructure([
                'result',
                'data' => ['items', 'pagination'],
            ]);
    }

    public function test_user_can_list_received_files(): void
    {
        $user = User::factory()->create();
        $owner = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $owner->id]);

        FileUserAccess::factory()->create([
            'file_id' => $file->id,
            'user_id' => $user->id,
        ]);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/files?filter=received');

        $response->assertOk();
    }

    public function test_user_can_list_favorite_files(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $user->id]);

        FileUserAccess::factory()->owner()->favorite()->create([
            'file_id' => $file->id,
            'user_id' => $user->id,
        ]);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/files?filter=favorites');

        $response->assertOk();
    }

    public function test_file_list_supports_pagination(): void
    {
        $user = User::factory()->create();
        File::factory()->count(25)->create(['owner_id' => $user->id]);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/files?per_page=10&page=1');

        $response->assertOk();
        $data = $response->json('data');
        $this->assertCount(10, $data['items']);
        $this->assertEquals(25, $data['pagination']['total']);
    }

    public function test_file_list_supports_search(): void
    {
        $user = User::factory()->create();
        File::factory()->create([
            'owner_id'      => $user->id,
            'original_name' => 'unique_document.pdf',
        ]);
        File::factory()->create([
            'owner_id'      => $user->id,
            'original_name' => 'other_file.txt',
        ]);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/files?search=unique');

        $response->assertOk();
        $this->assertCount(1, $response->json('data.items'));
    }
}
