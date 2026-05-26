<?php

namespace Tests\Feature\Files;

use App\Models\File;
use App\Models\FileUserAccess;
use App\Models\User;
use App\Enums\AccessType;
use Tests\TestCase;

class FilePinTest extends TestCase
{
    public function test_shared_user_pin_upgrades_to_saved(): void
    {
        $owner = User::factory()->create();
        $shared = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $owner->id]);

        FileUserAccess::factory()->owner()->create([
            'file_id' => $file->id,
            'user_id' => $owner->id,
        ]);
        FileUserAccess::factory()->create([
            'file_id' => $file->id,
            'user_id' => $shared->id,
        ]);

        $response = $this->actingAs($shared)
            ->postJson("/api/v1/files/{$file->id}/pin");

        $response->assertOk();

        $access = FileUserAccess::where('file_id', $file->id)
            ->where('user_id', $shared->id)
            ->first();

        $this->assertSame(AccessType::Saved, $access->access_type);
        $this->assertNotNull($access->pinned_at);
        $this->assertNotNull($access->saved_at);
    }

    public function test_shared_user_can_unpin(): void
    {
        $owner = User::factory()->create();
        $shared = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $owner->id]);

        FileUserAccess::factory()->owner()->create([
            'file_id' => $file->id,
            'user_id' => $owner->id,
        ]);
        FileUserAccess::factory()->create([
            'file_id'             => $file->id,
            'user_id'             => $shared->id,
            'access_type'         => AccessType::Saved,
            'pinned_at'           => now(),
            'saved_at'            => now(),
        ]);

        $response = $this->actingAs($shared)
            ->postJson("/api/v1/files/{$file->id}/unpin");

        $response->assertOk();

        $access = FileUserAccess::where('file_id', $file->id)
            ->where('user_id', $shared->id)
            ->first();

        $this->assertNull($access->pinned_at);
    }

    public function test_saved_user_pin_keeps_saved_type(): void
    {
        $owner = User::factory()->create();
        $saved = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $owner->id]);

        FileUserAccess::factory()->owner()->create([
            'file_id' => $file->id,
            'user_id' => $owner->id,
        ]);
        FileUserAccess::factory()->saved()->create([
            'file_id' => $file->id,
            'user_id' => $saved->id,
        ]);

        $response = $this->actingAs($saved)
            ->postJson("/api/v1/files/{$file->id}/pin");

        $response->assertOk();

        $access = FileUserAccess::where('file_id', $file->id)
            ->where('user_id', $saved->id)
            ->first();

        $this->assertSame(AccessType::Saved, $access->access_type);
        $this->assertNotNull($access->pinned_at);
    }

    public function test_pin_twice_does_not_error(): void
    {
        $owner = User::factory()->create();
        $shared = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $owner->id]);

        FileUserAccess::factory()->owner()->create([
            'file_id' => $file->id,
            'user_id' => $owner->id,
        ]);
        FileUserAccess::factory()->create([
            'file_id' => $file->id,
            'user_id' => $shared->id,
        ]);

        $this->actingAs($shared)
            ->postJson("/api/v1/files/{$file->id}/pin")
            ->assertOk();

        $this->actingAs($shared)
            ->postJson("/api/v1/files/{$file->id}/pin")
            ->assertOk();
    }

    public function test_unauthenticated_user_cannot_pin(): void
    {
        $file = File::factory()->create();

        $this->postJson("/api/v1/files/{$file->id}/pin")
            ->assertUnauthorized();
    }
}
