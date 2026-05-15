<?php

namespace Tests\Feature\Files;

use App\Models\User;
use App\Models\File;
use App\Models\FileUserAccess;
use App\Enums\AccessType;
use Tests\TestCase;

class FileShowTest extends TestCase
{
    public function test_owner_can_view_file(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $user->id]);

        FileUserAccess::factory()->owner()->create([
            'file_id' => $file->id,
            'user_id' => $user->id,
        ]);

        $response = $this->actingAs($user)
            ->getJson("/api/v1/files/{$file->id}");

        $response->assertOk()
            ->assertJson(['result' => 'success']);
    }

    public function test_shared_user_can_view_file(): void
    {
        $owner = User::factory()->create();
        $shared = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $owner->id]);

        FileUserAccess::factory()->create([
            'file_id' => $file->id,
            'user_id' => $shared->id,
        ]);

        $response = $this->actingAs($shared)
            ->getJson("/api/v1/files/{$file->id}");

        $response->assertOk();
    }

    public function test_user_without_access_cannot_view_file(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $owner->id]);

        $response = $this->actingAs($other)
            ->getJson("/api/v1/files/{$file->id}");

        $response->assertStatus(403);
    }

    public function test_nonexistent_file_returns_404(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->getJson('/api/v1/files/nonexistent-id');

        $response->assertStatus(404);
    }

    public function test_unauthenticated_user_cannot_view_file(): void
    {
        $file = File::factory()->create();

        $response = $this->getJson("/api/v1/files/{$file->id}");

        $response->assertUnauthorized();
    }
}
