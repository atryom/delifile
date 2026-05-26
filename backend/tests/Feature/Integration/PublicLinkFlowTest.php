<?php

namespace Tests\Feature\Integration;

use App\Models\File;
use App\Models\FileUserAccess;
use App\Models\ShareLink;
use App\Models\User;
use App\Enums\AccessType;
use Tests\TestCase;

class PublicLinkFlowTest extends TestCase
{
    /**
     * 14.3: Create link → Guest downloads → Auth user saves → Disable → Check
     */
    public function test_public_link_save_flow(): void
    {
        $p1 = User::factory()->create();
        $p2 = User::factory()->create(['auto_add_received_files' => true]);

        $file = File::factory()->create([
            'owner_id' => $p1->id,
            'status'   => \App\Enums\FileStatus::Available,
        ]);
        FileUserAccess::factory()->owner()->create([
            'file_id' => $file->id,
            'user_id' => $p1->id,
        ]);

        // ─── P1 creates public link with allow_save=true ────────────────
        $this->assertTrue($file->isOwnedBy($p1), 'File must be owned by P1');

        $linkResponse = $this->actingAs($p1)
            ->postJson('/api/v1/files/' . $file->id . '/create-link', [
                'ttl_hours'  => 24,
                'allow_save' => true,
            ]);

        $linkResponse->assertStatus(201);
        $url  = $linkResponse->json('data.link.url');
        $token = \Illuminate\Support\Str::afterLast($url, '/link/');

        // ─── Guest resolves the link ────────────────────────────────────
        $resolveResponse = $this->postJson("/api/v1/links/{$token}/resolve");
        $resolveResponse->assertOk()
            ->assertJsonPath('data.file.original_name', $file->original_name);

        // ─── Guest downloads via link ──────────────────────────────────
        $downloadResponse = $this->postJson("/api/v1/links/{$token}/download");
        $downloadResponse->assertOk()
            ->assertJsonStructure(['data' => ['url', 'expires_in']]);

        // ─── P2 (authorized) saves file via link ────────────────────────
        $saveResponse = $this->actingAs($p2)
            ->postJson("/api/v1/links/{$token}/save");

        $saveResponse->assertOk()
            ->assertJsonPath('data.file_id', $file->id);

        $this->assertDatabaseHas('file_user_access', [
            'file_id'     => $file->id,
            'user_id'     => $p2->id,
            'access_type' => AccessType::Saved->value,
        ]);

        // ─── P2 tries save again → ALREADY_SAVED ────────────────────────
        $this->actingAs($p2)
            ->postJson("/api/v1/links/{$token}/save")
            ->assertStatus(422)
            ->assertJsonPath('data.code', 'ALREADY_SAVED');

        // ─── P1 disables the link ───────────────────────────────────────
        $linksList = $this->actingAs($p1)
            ->getJson("/api/v1/files/{$file->id}/links");

        $linksList->assertOk();
        $linkId = $linksList->json('data.items.0.id');

        $this->actingAs($p1)
            ->postJson("/api/v1/links/{$linkId}/disable")
            ->assertOk();

        // ─── Guest tries to resolve disabled link → 404 ─────────────────
        $this->postJson("/api/v1/links/{$token}/resolve")
            ->assertStatus(404);
    }
}
