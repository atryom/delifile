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

class DocumentControllerTest extends TestCase
{
    // ── POST /api/v1/documents ────────────────────────────────────────────────

    public function test_user_can_create_document(): void
    {
        Storage::fake('s3');
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/documents', ['fileName' => 'Тест']);

        $response->assertCreated()
            ->assertJsonPath('data.document.mimeType', 'text/markdown')
            ->assertJsonPath('data.document.isEditable', true)
            ->assertJsonPath('data.document.editorType', 'markdown')
            ->assertJsonPath('data.document.content', '');

        $this->assertDatabaseHas('files', [
            'owner_id'    => $user->id,
            'is_editable' => true,
            'editor_type' => 'markdown',
            'mime_type'   => 'text/markdown',
        ]);
    }

    public function test_create_appends_md_extension_if_missing(): void
    {
        Storage::fake('s3');
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/documents', ['fileName' => 'Заметка']);

        $response->assertCreated();
        $this->assertStringEndsWith('.md', $response->json('data.document.fileName'));
    }

    public function test_create_requires_auth(): void
    {
        $this->postJson('/api/v1/documents', ['fileName' => 'test.md'])
            ->assertUnauthorized();
    }

    public function test_create_requires_file_name(): void
    {
        Storage::fake('s3');
        $user = User::factory()->create();

        $this->actingAs($user)
            ->postJson('/api/v1/documents', [])
            ->assertUnprocessable();
    }

    // ── GET /api/v1/documents/:id ─────────────────────────────────────────────

    public function test_owner_can_get_document(): void
    {
        Storage::fake('s3');
        $user = User::factory()->create();
        $doc  = $this->makeMarkdownFile($user, '# Привет');

        $response = $this->actingAs($user)
            ->getJson('/api/v1/documents/' . $doc->id);

        $response->assertOk()
            ->assertJsonPath('data.document.id', $doc->id)
            ->assertJsonPath('data.document.capabilities.canEdit', true)
            ->assertJsonPath('data.document.capabilities.canRename', true)
            ->assertJsonPath('data.document.capabilities.canDelete', true);
    }

    public function test_shared_user_with_can_edit_gets_edit_capability(): void
    {
        Storage::fake('s3');
        $owner  = User::factory()->create();
        $viewer = User::factory()->create();
        $doc    = $this->makeMarkdownFile($owner);

        FileUserAccess::factory()->create([
            'file_id'     => $doc->id,
            'user_id'     => $viewer->id,
            'access_type' => AccessType::Shared,
            'can_edit'    => true,
        ]);

        $response = $this->actingAs($viewer)
            ->getJson('/api/v1/documents/' . $doc->id);

        $response->assertOk()
            ->assertJsonPath('data.document.capabilities.canEdit', true)
            ->assertJsonPath('data.document.capabilities.canRename', false)
            ->assertJsonPath('data.document.capabilities.canDelete', false);
    }

    public function test_shared_user_without_can_edit_gets_readonly(): void
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
            ->getJson('/api/v1/documents/' . $doc->id)
            ->assertOk()
            ->assertJsonPath('data.document.capabilities.canEdit', false);
    }

    public function test_get_document_forbidden_for_unrelated_user(): void
    {
        Storage::fake('s3');
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $doc   = $this->makeMarkdownFile($owner);

        $this->actingAs($other)
            ->getJson('/api/v1/documents/' . $doc->id)
            ->assertForbidden();
    }

    public function test_get_document_returns_lock_info_when_locked(): void
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

        $response = $this->actingAs($owner)
            ->getJson('/api/v1/documents/' . $doc->id);

        $response->assertOk()
            ->assertJsonPath('data.document.lock.isLocked', true)
            ->assertJsonPath('data.document.capabilities.canTakeOverLock', true);
    }

    public function test_get_returns_404_for_non_markdown_file(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $user->id]);

        $this->actingAs($user)
            ->getJson('/api/v1/documents/' . $file->id)
            ->assertNotFound();
    }

    // ── PUT /api/v1/documents/:id ─────────────────────────────────────────────

    public function test_owner_can_save_document(): void
    {
        Storage::fake('s3');
        $user = User::factory()->create();
        $doc  = $this->makeMarkdownFile($user);
        $this->acquireLock($doc->id, $user->id);

        $response = $this->actingAs($user)
            ->putJson('/api/v1/documents/' . $doc->id, [
                'content' => '# Новое содержимое',
                'etag'    => $doc->etag,
            ]);

        $response->assertOk()
            ->assertJsonStructure(['data' => ['id', 'etag', 'updatedAt', 'updatedBy']]);

        $this->assertDatabaseHas('files', [
            'id'         => $doc->id,
            'updated_by' => $user->id,
        ]);
    }

    public function test_save_fails_with_etag_conflict(): void
    {
        Storage::fake('s3');
        $user = User::factory()->create();
        $doc  = $this->makeMarkdownFile($user, '', '"original_etag"');
        $this->acquireLock($doc->id, $user->id);

        $this->actingAs($user)
            ->putJson('/api/v1/documents/' . $doc->id, [
                'content' => 'new content',
                'etag'    => '"stale_etag"',
            ])
            ->assertStatus(409)
            ->assertJsonPath('data.error', 'DOCUMENT_CONFLICT');
    }

    public function test_save_fails_without_lock(): void
    {
        Storage::fake('s3');
        $user = User::factory()->create();
        $doc  = $this->makeMarkdownFile($user);

        $this->actingAs($user)
            ->putJson('/api/v1/documents/' . $doc->id, [
                'content' => 'text',
                'etag'    => $doc->etag ?? '"etag"',
            ])
            ->assertStatus(423);
    }

    public function test_shared_user_without_can_edit_cannot_save(): void
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
            ->putJson('/api/v1/documents/' . $doc->id, [
                'content' => 'hacked',
                'etag'    => '"any"',
            ])
            ->assertForbidden();
    }

    // ── PATCH /api/v1/files/:id/accesses/:accessId ───────────────────────────

    public function test_owner_can_grant_can_edit(): void
    {
        $owner  = User::factory()->create();
        $viewer = User::factory()->create();
        $doc    = $this->makeMarkdownFile($owner);

        $access = FileUserAccess::factory()->create([
            'file_id'     => $doc->id,
            'user_id'     => $viewer->id,
            'access_type' => AccessType::Shared,
            'can_edit'    => false,
        ]);

        $this->actingAs($owner)
            ->patchJson("/api/v1/files/{$doc->id}/accesses/{$access->id}", ['can_edit' => true])
            ->assertOk();

        $this->assertDatabaseHas('file_user_access', [
            'id'       => $access->id,
            'can_edit' => true,
        ]);
    }

    public function test_non_owner_cannot_change_can_edit(): void
    {
        $owner  = User::factory()->create();
        $viewer = User::factory()->create();
        $doc    = $this->makeMarkdownFile($owner);

        $access = FileUserAccess::factory()->create([
            'file_id'     => $doc->id,
            'user_id'     => $viewer->id,
            'access_type' => AccessType::Shared,
        ]);

        $this->actingAs($viewer)
            ->patchJson("/api/v1/files/{$doc->id}/accesses/{$access->id}", ['can_edit' => true])
            ->assertForbidden();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeMarkdownFile(User $owner, string $content = '', ?string $etag = '"test_etag"'): File
    {
        $file = File::factory()->create([
            'owner_id'     => $owner->id,
            'is_editable'  => true,
            'editor_type'  => 'markdown',
            'mime_type'    => 'text/markdown',
            'content_kind' => 'binary_file',
            'storage_key'  => 'files/' . $owner->id . '/test.md',
            'etag'         => $etag,
        ]);

        FileUserAccess::factory()->create([
            'file_id'     => $file->id,
            'user_id'     => $owner->id,
            'access_type' => AccessType::Owner,
            'can_edit'    => true,
        ]);

        Storage::disk('s3')->put($file->storage_key, $content);

        return $file;
    }

    private function acquireLock(string $fileId, int $userId): void
    {
        DocumentLock::create([
            'file_id'    => $fileId,
            'user_id'    => $userId,
            'expires_at' => now()->addMinutes(5),
            'created_at' => now(),
        ]);
    }
}
