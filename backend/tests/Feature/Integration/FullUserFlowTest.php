<?php

namespace Tests\Feature\Integration;

use App\Models\Contact;
use App\Models\File;
use App\Models\FileUserAccess;
use App\Models\Invitation;
use App\Models\User;
use Tests\TestCase;

class FullUserFlowTest extends TestCase
{
    /**
     * 14.1: Registration → Upload → Share → Download
     */
    public function test_full_registration_to_share_flow(): void
    {
        // ─── P1 registers ───────────────────────────────────────────────
        $registerResponse = $this->postJson('/api/v1/auth/register', [
            'name'                  => 'Test1',
            'email'                 => 'user1@test.com',
            'password'              => 'TestPass123',
            'password_confirmation' => 'TestPass123',
        ]);

        $registerResponse->assertStatus(201);
        $p1 = User::where('email', 'user1@test.com')->first();
        $this->assertNotNull($p1);

        // ─── P1 confirms email ──────────────────────────────────────────
        $p1->update(['email_verified_at' => now(), 'account_status' => 'active']);

        // ─── P1 uploads file ────────────────────────────────────────────
        $file = File::factory()->create([
            'owner_id'      => $p1->id,
            'original_name' => 'document.pdf',
            'status'        => \App\Enums\FileStatus::Available,
        ]);
        FileUserAccess::factory()->owner()->create([
            'file_id' => $file->id,
            'user_id' => $p1->id,
        ]);

        $this->actingAs($p1)
            ->getJson("/api/v1/files/{$file->id}")
            ->assertOk()
            ->assertJsonPath('data.file.original_name', 'document.pdf');

        // ─── P2 registers ───────────────────────────────────────────────
        $this->postJson('/api/v1/auth/register', [
            'name'                  => 'Test2',
            'email'                 => 'user2@test.com',
            'password'              => 'TestPass123',
            'password_confirmation' => 'TestPass123',
        ])->assertStatus(201);

        $p2 = User::where('email', 'user2@test.com')->first();
        $this->assertNotNull($p2);
        $p2->update(['email_verified_at' => now(), 'account_status' => 'active']);

        // ─── P1 adds P2 as contact ──────────────────────────────────────
        $contact = Contact::factory()->resolvedTo($p2)->create([
            'user_id' => $p1->id,
            'email'   => $p2->email,
        ]);

        // ─── P1 shares file with P2 ─────────────────────────────────────
        $shareResponse = $this->actingAs($p1)
            ->postJson("/api/v1/files/{$file->id}/share-to-contact", [
                'contact_id' => $contact->id,
            ]);

        $shareResponse->assertOk()
            ->assertJsonPath('data.share.status', 'shared');

        // ─── P2 receives file (auto_add) ────────────────────────────────
        $this->assertDatabaseHas('file_user_access', [
            'file_id'     => $file->id,
            'user_id'     => $p2->id,
            'access_type' => \App\Enums\AccessType::Shared->value,
        ]);

        // ─── P2 downloads file ──────────────────────────────────────────
        $downloadResponse = $this->actingAs($p2)
            ->postJson("/api/v1/files/{$file->id}/download");

        $downloadResponse->assertOk()
            ->assertJsonStructure(['data' => ['url', 'expires_in']]);

        // ─── P2 views file activity ─────────────────────────────────────
        $activityResponse = $this->actingAs($p2)
            ->getJson("/api/v1/files/{$file->id}/activity");

        $activityResponse->assertOk()
            ->assertJsonPath('result', 'success');
    }
}
