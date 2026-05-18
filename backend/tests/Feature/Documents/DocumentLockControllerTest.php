<?php

namespace Tests\Feature\Documents;

use App\Enums\AccessType;
use App\Enums\FileStatus;
use App\Models\DocumentLock;
use App\Models\File;
use App\Models\FileUserAccess;
use App\Models\User;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DocumentLockControllerTest extends TestCase
{
    // ── POST /lock — acquire ──────────────────────────────────────────────────

    public function test_owner_can_acquire_lock(): void
    {
        Storage::fake('s3');
        $user = User::factory()->create();
        $doc  = $this->makeMarkdownFile($user);

        $this->actingAs($user)
            ->postJson("/api/v1/documents/{$doc->id}/lock")
            ->assertCreated()
            ->assertJsonPath('data.lock.isLocked', true);

        $this->assertDatabaseHas('document_locks', [
            'file_id' => $doc->id,
            'user_id' => $user->id,
        ]);
    }

    public function test_acquire_returns_423_when_locked_by_another(): void
    {
        Storage::fake('s3');
        $owner  = User::factory()->create();
        $editor = User::factory()->create();
        $viewer = User::factory()->create();
        $doc    = $this->makeMarkdownFile($owner);

        FileUserAccess::factory()->create([
            'file_id'     => $doc->id,
            'user_id'     => $viewer->id,
            'access_type' => AccessType::Shared,
            'can_edit'    => true,
        ]);

        // editor holds lock
        DocumentLock::create([
            'file_id'    => $doc->id,
            'user_id'    => $editor->id,
            'expires_at' => now()->addMinutes(5),
            'created_at' => now(),
        ]);

        $this->actingAs($viewer)
            ->postJson("/api/v1/documents/{$doc->id}/lock")
            ->assertStatus(423)
            ->assertJsonPath('data.lock.isLocked', true);
    }

    public function test_user_without_edit_right_cannot_acquire_lock(): void
    {
        Storage::fake('s3');
        $owner  = User::factory()->create();
        $viewer = User::factory()->create();
        $doc    = $this->makeMarkdownFile($owner);

        FileUserAccess::factory()->create([
            'file_id'     => $doc->id,
            'user_id'     => $viewer->id,
            'access_type' => AccessType::Shared,
            'can_edit'    => false,
        ]);

        $this->actingAs($viewer)
            ->postJson("/api/v1/documents/{$doc->id}/lock")
            ->assertForbidden();
    }

    public function test_expired_lock_can_be_reacquired(): void
    {
        Storage::fake('s3');
        $owner  = User::factory()->create();
        $editor = User::factory()->create();
        $user2  = User::factory()->create();
        $doc    = $this->makeMarkdownFile($owner);

        FileUserAccess::factory()->create([
            'file_id'     => $doc->id,
            'user_id'     => $user2->id,
            'access_type' => AccessType::Shared,
            'can_edit'    => true,
        ]);

        // expired lock from editor
        DocumentLock::create([
            'file_id'    => $doc->id,
            'user_id'    => $editor->id,
            'expires_at' => now()->subMinutes(1),
            'created_at' => now()->subMinutes(10),
        ]);

        $this->actingAs($user2)
            ->postJson("/api/v1/documents/{$doc->id}/lock")
            ->assertCreated()
            ->assertJsonPath('data.lock.isLocked', true);

        $this->assertDatabaseHas('document_locks', [
            'file_id' => $doc->id,
            'user_id' => $user2->id,
        ]);
    }

    // ── POST /lock/heartbeat ──────────────────────────────────────────────────

    public function test_heartbeat_renews_own_lock(): void
    {
        Storage::fake('s3');
        $user = User::factory()->create();
        $doc  = $this->makeMarkdownFile($user);

        DocumentLock::create([
            'file_id'    => $doc->id,
            'user_id'    => $user->id,
            'expires_at' => now()->addMinutes(1),
            'created_at' => now(),
        ]);

        $this->actingAs($user)
            ->postJson("/api/v1/documents/{$doc->id}/lock/heartbeat")
            ->assertOk();
    }

    public function test_heartbeat_returns_423_lock_expired_when_no_lock(): void
    {
        Storage::fake('s3');
        $user = User::factory()->create();
        $doc  = $this->makeMarkdownFile($user);

        $this->actingAs($user)
            ->postJson("/api/v1/documents/{$doc->id}/lock/heartbeat")
            ->assertStatus(423)
            ->assertJsonPath('data.reason', 'LOCK_EXPIRED');
    }

    public function test_heartbeat_returns_423_lock_taken_over_when_lock_belongs_to_another(): void
    {
        Storage::fake('s3');
        $owner    = User::factory()->create();
        $original = User::factory()->create();
        $doc      = $this->makeMarkdownFile($owner);

        FileUserAccess::factory()->create([
            'file_id'     => $doc->id,
            'user_id'     => $original->id,
            'access_type' => AccessType::Shared,
            'can_edit'    => true,
        ]);

        // lock was taken over by owner
        DocumentLock::create([
            'file_id'    => $doc->id,
            'user_id'    => $owner->id,
            'expires_at' => now()->addMinutes(5),
            'created_at' => now(),
        ]);

        $this->actingAs($original)
            ->postJson("/api/v1/documents/{$doc->id}/lock/heartbeat")
            ->assertStatus(423)
            ->assertJsonPath('data.reason', 'LOCK_TAKEN_OVER');
    }

    // ── POST /lock/takeover ───────────────────────────────────────────────────

    public function test_owner_can_takeover_lock(): void
    {
        Storage::fake('s3');
        $owner  = User::factory()->create();
        $editor = User::factory()->create();
        $doc    = $this->makeMarkdownFile($owner);

        DocumentLock::create([
            'file_id'    => $doc->id,
            'user_id'    => $editor->id,
            'expires_at' => now()->addMinutes(5),
            'created_at' => now(),
        ]);

        $this->actingAs($owner)
            ->postJson("/api/v1/documents/{$doc->id}/lock/takeover")
            ->assertOk()
            ->assertJsonPath('data.lock.isLocked', true);

        $this->assertDatabaseHas('document_locks', [
            'file_id' => $doc->id,
            'user_id' => $owner->id,
        ]);
    }

    public function test_non_owner_cannot_takeover_lock(): void
    {
        Storage::fake('s3');
        $owner  = User::factory()->create();
        $editor = User::factory()->create();
        $other  = User::factory()->create();
        $doc    = $this->makeMarkdownFile($owner);

        FileUserAccess::factory()->create([
            'file_id'     => $doc->id,
            'user_id'     => $other->id,
            'access_type' => AccessType::Shared,
            'can_edit'    => true,
        ]);

        DocumentLock::create([
            'file_id'    => $doc->id,
            'user_id'    => $editor->id,
            'expires_at' => now()->addMinutes(5),
            'created_at' => now(),
        ]);

        $this->actingAs($other)
            ->postJson("/api/v1/documents/{$doc->id}/lock/takeover")
            ->assertForbidden();
    }

    // ── re-acquire own active lock ────────────────────────────────────────────

    public function test_same_user_can_reacquire_own_active_lock(): void
    {
        Storage::fake('s3');
        $user = User::factory()->create();
        $doc  = $this->makeMarkdownFile($user);

        DocumentLock::create([
            'file_id'    => $doc->id,
            'user_id'    => $user->id,
            'expires_at' => now()->addMinutes(5),
            'created_at' => now(),
        ]);

        // Same user re-acquires → 201 (not 423)
        $this->actingAs($user)
            ->postJson("/api/v1/documents/{$doc->id}/lock")
            ->assertCreated()
            ->assertJsonPath('data.lock.isLocked', true);

        $this->assertDatabaseHas('document_locks', [
            'file_id' => $doc->id,
            'user_id' => $user->id,
        ]);
    }

    // ── heartbeat with expired own lock ───────────────────────────────────────

    public function test_heartbeat_with_expired_own_lock_returns_lock_expired(): void
    {
        Storage::fake('s3');
        $user = User::factory()->create();
        $doc  = $this->makeMarkdownFile($user);

        DocumentLock::create([
            'file_id'    => $doc->id,
            'user_id'    => $user->id,
            'expires_at' => now()->subMinutes(1),
            'created_at' => now()->subMinutes(10),
        ]);

        $this->actingAs($user)
            ->postJson("/api/v1/documents/{$doc->id}/lock/heartbeat")
            ->assertStatus(423)
            ->assertJsonPath('data.reason', 'LOCK_EXPIRED');
    }

    // ── takeover own lock ────────────────────────────────────────────────────

    public function test_owner_takeover_own_lock_refreshes_expiry(): void
    {
        Storage::fake('s3');
        $owner = User::factory()->create();
        $doc   = $this->makeMarkdownFile($owner);

        DocumentLock::create([
            'file_id'    => $doc->id,
            'user_id'    => $owner->id,
            'expires_at' => now()->addMinutes(1), // almost expired
            'created_at' => now(),
        ]);

        $this->actingAs($owner)
            ->postJson("/api/v1/documents/{$doc->id}/lock/takeover")
            ->assertOk()
            ->assertJsonPath('data.lock.isLocked', true);

        // Lock still belongs to owner, expiry refreshed
        $lock = DocumentLock::find($doc->id);
        $this->assertEquals($owner->id, $lock->user_id);
        $this->assertTrue($lock->expires_at->gt(now()->addMinutes(4)));
    }

    // ── DELETE /lock — release ────────────────────────────────────────────────

    public function test_user_can_release_own_lock(): void
    {
        Storage::fake('s3');
        $user = User::factory()->create();
        $doc  = $this->makeMarkdownFile($user);

        DocumentLock::create([
            'file_id'    => $doc->id,
            'user_id'    => $user->id,
            'expires_at' => now()->addMinutes(5),
            'created_at' => now(),
        ]);

        $this->actingAs($user)
            ->deleteJson("/api/v1/documents/{$doc->id}/lock")
            ->assertNoContent();

        $this->assertDatabaseMissing('document_locks', ['file_id' => $doc->id]);
    }

    public function test_release_is_idempotent_when_no_lock(): void
    {
        Storage::fake('s3');
        $user = User::factory()->create();
        $doc  = $this->makeMarkdownFile($user);

        $this->actingAs($user)
            ->deleteJson("/api/v1/documents/{$doc->id}/lock")
            ->assertNoContent();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeMarkdownFile(User $owner): File
    {
        $file = File::factory()->create([
            'owner_id'     => $owner->id,
            'is_editable'  => true,
            'editor_type'  => 'markdown',
            'mime_type'    => 'text/markdown',
            'content_kind' => 'binary_file',
            'storage_key'  => 'files/' . $owner->id . '/test.md',
            'etag'         => '"test_etag"',
        ]);

        FileUserAccess::factory()->create([
            'file_id'     => $file->id,
            'user_id'     => $owner->id,
            'access_type' => AccessType::Owner,
            'can_edit'    => true,
        ]);

        return $file;
    }
}
