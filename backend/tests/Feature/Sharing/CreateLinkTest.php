<?php

namespace Tests\Feature\Sharing;

use App\Models\User;
use App\Models\File;
use App\Models\ShareLink;
use App\Models\FileUserAccess;
use App\Enums\ShareLinkStatus;
use Tests\TestCase;

class CreateLinkTest extends TestCase
{
    public function test_owner_can_create_share_link(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $user->id]);

        FileUserAccess::factory()->owner()->create([
            'file_id' => $file->id,
            'user_id' => $user->id,
        ]);

        $response = $this->actingAs($user)
            ->postJson("/api/v1/files/{$file->id}/create-link", [
                'ttl_hours' => 24,
            ]);

        $response->assertStatus(201)
            ->assertJson(['result' => 'success']);
    }

    public function test_owner_can_list_links(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $user->id]);

        FileUserAccess::factory()->owner()->create([
            'file_id' => $file->id,
            'user_id' => $user->id,
        ]);

        ShareLink::factory()->count(2)->create([
            'file_id'    => $file->id,
            'created_by' => $user->id,
        ]);

        $response = $this->actingAs($user)
            ->getJson("/api/v1/files/{$file->id}/links");

        $response->assertOk();
    }

    public function test_owner_can_disable_link(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $user->id]);

        FileUserAccess::factory()->owner()->create([
            'file_id' => $file->id,
            'user_id' => $user->id,
        ]);

        $link = ShareLink::factory()->create([
            'file_id'    => $file->id,
            'created_by' => $user->id,
        ]);

        $response = $this->actingAs($user)
            ->postJson("/api/v1/links/{$link->id}/disable");

        $response->assertOk();
    }
}
