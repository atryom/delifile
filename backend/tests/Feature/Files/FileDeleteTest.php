<?php

namespace Tests\Feature\Files;

use App\Models\User;
use App\Models\File;
use App\Models\FileUserAccess;
use App\Enums\AccessType;
use Tests\TestCase;

class FileDeleteTest extends TestCase
{
    public function test_owner_can_soft_delete_file(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $user->id]);

        FileUserAccess::factory()->owner()->create([
            'file_id' => $file->id,
            'user_id' => $user->id,
        ]);

        $response = $this->actingAs($user)
            ->deleteJson("/api/v1/files/{$file->id}");

        $response->assertOk();
        $this->assertSoftDeleted($file);
    }

    public function test_shared_user_can_detach_file(): void
    {
        $owner = User::factory()->create();
        $shared = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $owner->id]);

        $access = FileUserAccess::factory()->create([
            'file_id' => $file->id,
            'user_id' => $shared->id,
        ]);

        $response = $this->actingAs($shared)
            ->deleteJson("/api/v1/files/{$file->id}");

        $response->assertOk();
        $this->assertDatabaseMissing('file_user_access', ['id' => $access->id]);
    }

    public function test_user_without_access_cannot_delete(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $owner->id]);

        $response = $this->actingAs($other)
            ->deleteJson("/api/v1/files/{$file->id}");

        $response->assertStatus(404);
    }
}
