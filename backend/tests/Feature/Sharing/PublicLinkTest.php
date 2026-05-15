<?php

namespace Tests\Feature\Sharing;

use App\Models\User;
use App\Models\File;
use App\Models\ShareLink;
use App\Models\FileUserAccess;
use Tests\TestCase;
use Illuminate\Support\Facades\Storage;

class PublicLinkTest extends TestCase
{
    public function test_public_user_can_resolve_link(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $user->id]);
        $link = ShareLink::factory()->create([
            'file_id'    => $file->id,
            'created_by' => $user->id,
        ]);

        $response = $this->postJson("/api/v1/links/{$link->token}/resolve");

        $response->assertOk()
            ->assertJson(['result' => 'success']);
    }

    public function test_public_user_cannot_resolve_disabled_link(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $user->id]);
        $link = ShareLink::factory()->disabled()->create([
            'file_id'    => $file->id,
            'created_by' => $user->id,
        ]);

        $response = $this->postJson("/api/v1/links/{$link->token}/resolve");

        $response->assertStatus(404)
            ->assertJsonPath('data.code', 'LINK_INVALID');
    }

    public function test_public_user_cannot_resolve_expired_link(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $user->id]);
        $link = ShareLink::factory()->expired()->create([
            'file_id'    => $file->id,
            'created_by' => $user->id,
        ]);

        $response = $this->postJson("/api/v1/links/{$link->token}/resolve");

        $response->assertStatus(404)
            ->assertJsonPath('data.code', 'LINK_INVALID');
    }

    public function test_save_via_link_requires_authentication(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $user->id]);
        $link = ShareLink::factory()->withSave()->create([
            'file_id'    => $file->id,
            'created_by' => $user->id,
        ]);

        $response = $this->postJson("/api/v1/links/{$link->token}/save");

        $response->assertUnauthorized();
    }
}
