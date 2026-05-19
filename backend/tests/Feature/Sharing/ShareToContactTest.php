<?php

namespace Tests\Feature\Sharing;

use App\Models\User;
use App\Models\File;
use App\Models\Contact;
use App\Models\DocumentLock;
use App\Models\FileUserAccess;
use App\Enums\AccessType;
use Tests\TestCase;

class ShareToContactTest extends TestCase
{
    public function test_owner_can_share_file_to_resolved_contact(): void
    {
        $owner = User::factory()->create();
        $recipient = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $owner->id]);
        $contact = Contact::factory()->resolvedTo($recipient)->create([
            'user_id' => $owner->id,
        ]);

        FileUserAccess::factory()->owner()->create([
            'file_id' => $file->id,
            'user_id' => $owner->id,
        ]);

        $response = $this->actingAs($owner)
            ->postJson("/api/v1/files/{$file->id}/share-to-contact", [
                'contact_id' => $contact->id,
            ]);

        $response->assertOk()
            ->assertJson(['result' => 'success']);
    }

    public function test_owner_can_revoke_contact_access(): void
    {
        $owner = User::factory()->create();
        $recipient = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $owner->id]);
        $contact = Contact::factory()->resolvedTo($recipient)->create([
            'user_id' => $owner->id,
        ]);

        FileUserAccess::factory()->owner()->create([
            'file_id' => $file->id,
            'user_id' => $owner->id,
        ]);

        $access = FileUserAccess::factory()->create([
            'file_id' => $file->id,
            'user_id' => $recipient->id,
        ]);

        $response = $this->actingAs($owner)
            ->deleteJson("/api/v1/files/{$file->id}/share-to-contact/{$contact->id}");

        $response->assertOk();
    }

    public function test_revoke_also_releases_document_lock_held_by_revoked_user(): void
    {
        $owner = User::factory()->create();
        $recipient = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $owner->id, 'mime_type' => 'text/markdown']);
        $contact = Contact::factory()->resolvedTo($recipient)->create(['user_id' => $owner->id]);

        FileUserAccess::factory()->owner()->create(['file_id' => $file->id, 'user_id' => $owner->id]);
        FileUserAccess::factory()->create(['file_id' => $file->id, 'user_id' => $recipient->id]);

        // Recipient is currently editing — they hold the lock.
        DocumentLock::create([
            'file_id'    => $file->id,
            'user_id'    => $recipient->id,
            'expires_at' => now()->addMinutes(5),
            'created_at' => now(),
        ]);

        $response = $this->actingAs($owner)
            ->deleteJson("/api/v1/files/{$file->id}/share-to-contact/{$contact->id}");

        $response->assertOk();
        $this->assertDatabaseMissing('file_user_access', ['file_id' => $file->id, 'user_id' => $recipient->id]);
        $this->assertDatabaseMissing('document_locks', ['file_id' => $file->id, 'user_id' => $recipient->id]);
    }

    public function test_revoke_by_user_id_also_releases_document_lock(): void
    {
        $owner = User::factory()->create();
        $recipient = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $owner->id, 'mime_type' => 'text/markdown']);

        FileUserAccess::factory()->owner()->create(['file_id' => $file->id, 'user_id' => $owner->id]);
        FileUserAccess::factory()->create(['file_id' => $file->id, 'user_id' => $recipient->id]);

        // Recipient holds the lock.
        DocumentLock::create([
            'file_id'    => $file->id,
            'user_id'    => $recipient->id,
            'expires_at' => now()->addMinutes(5),
            'created_at' => now(),
        ]);

        // Use numeric user ID as fallback (no contact UUID).
        $response = $this->actingAs($owner)
            ->deleteJson("/api/v1/files/{$file->id}/share-to-contact/{$recipient->id}");

        $response->assertOk();
        $this->assertDatabaseMissing('document_locks', ['file_id' => $file->id, 'user_id' => $recipient->id]);
    }

    public function test_non_owner_cannot_share_file(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $recipient = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $owner->id]);
        $contact = Contact::factory()->resolvedTo($recipient)->create([
            'user_id' => $other->id,
        ]);

        $response = $this->actingAs($other)
            ->postJson("/api/v1/files/{$file->id}/share-to-contact", [
                'contact_id' => $contact->id,
            ]);

        $response->assertStatus(404);
    }
}
