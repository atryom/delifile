<?php

namespace Tests\Feature\Integration;

use App\Models\Contact;
use App\Models\File;
use App\Models\FileUserAccess;
use App\Models\User;
use App\Enums\AccessType;
use Tests\TestCase;

class DocumentLockFlowTest extends TestCase
{
    /**
     * 14.4: Create markdown → Edit → Lock → Shared readonly → Takeover
     */
    public function test_markdown_document_lock_flow(): void
    {
        $p1 = User::factory()->create();
        $p2 = User::factory()->create(['auto_add_received_files' => true]);

        // ─── P1 creates markdown document ──────────────────────────────
        $docResponse = $this->actingAs($p1)
            ->postJson('/api/v1/documents', [
                'fileName' => 'TestDoc',
            ]);

        $docResponse->assertStatus(201);
        $docId = $docResponse->json('data.document.id');

        // ─── P1 acquires lock ───────────────────────────────────────────
        $this->actingAs($p1)
            ->postJson("/api/v1/documents/{$docId}/lock")
            ->assertStatus(201);

        // ─── P1 opens document ──────────────────────────────────────────
        $showResponse = $this->actingAs($p1)
            ->getJson("/api/v1/documents/{$docId}");

        $showResponse->assertOk()
            ->assertJsonPath('data.document.isEditable', true);

        $currentEtag = $showResponse->json('data.document.etag');

        // ─── P1 saves content ──────────────────────────────────────────
        $this->actingAs($p1)
            ->putJson("/api/v1/documents/{$docId}", [
                'content' => '# Hello World',
                'etag'    => $currentEtag,
            ])
            ->assertOk();

        // ─── P2 tries to open (no access) → 403 ─────────────────────────
        $this->actingAs($p2)
            ->getJson("/api/v1/documents/{$docId}")
            ->assertStatus(403);

        // ─── P1 shares file with P2 via contact → gives view-only ─────
        $contact = Contact::factory()->resolvedTo($p2)->create([
            'user_id' => $p1->id,
            'email'   => $p2->email,
        ]);

        $this->actingAs($p1)
            ->postJson("/api/v1/files/{$docId}/share-to-contact", [
                'contact_id' => $contact->id,
                'can_edit'   => false,
            ])
            ->assertOk()
            ->assertJsonPath('data.share.status', 'shared');

        // ─── P2 opens document → readonly (cannot edit) ─────────────────
        $p2Show = $this->actingAs($p2)
            ->getJson("/api/v1/documents/{$docId}");

        $p2Show->assertOk()
            ->assertJsonPath('data.document.capabilities.canEdit', false);

        // ─── P2 tries to save → 403 (canEditDocument is false) ──────────
        $this->actingAs($p2)
            ->putJson("/api/v1/documents/{$docId}", [
                'content' => '# Hacked by P2',
                'etag'    => 'some-etag',
            ])
            ->assertStatus(403);

        // ─── P1 grants can_edit to P2 ──────────────────────────────────
        $access = FileUserAccess::where('file_id', $docId)
            ->where('user_id', $p2->id)
            ->first();

        $this->actingAs($p1)
            ->patchJson("/api/v1/files/{$docId}/accesses/{$access->id}", [
                'can_edit' => true,
            ])
            ->assertOk();

        // ─── P2 opens document → now can edit ──────────────────────────
        $p2ShowAfterGrant = $this->actingAs($p2)
            ->getJson("/api/v1/documents/{$docId}");

        $p2ShowAfterGrant->assertOk()
            ->assertJsonPath('data.document.capabilities.canEdit', true);

        // ─── P1 releases lock ──────────────────────────────────────────
        $this->actingAs($p1)
            ->deleteJson("/api/v1/documents/{$docId}/lock")
            ->assertNoContent();

        // ─── P2 acquires lock and saves content ─────────────────────────
        $this->actingAs($p2)
            ->postJson("/api/v1/documents/{$docId}/lock")
            ->assertStatus(201);

        $p2Etag = $this->actingAs($p2)
            ->getJson("/api/v1/documents/{$docId}")
            ->json('data.document.etag');

        $this->actingAs($p2)
            ->putJson("/api/v1/documents/{$docId}", [
                'content' => '# Edited by P2',
                'etag'    => $p2Etag,
            ])
            ->assertOk();

        // ─── P1 takes over the lock ────────────────────────────────────
        $this->actingAs($p1)
            ->postJson("/api/v1/documents/{$docId}/lock/takeover")
            ->assertOk();
    }
}
