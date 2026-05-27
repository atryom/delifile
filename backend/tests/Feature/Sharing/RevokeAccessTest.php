<?php

namespace Tests\Feature\Sharing;

use App\Models\Contact;
use App\Models\ContactPendingShare;
use App\Models\File;
use App\Models\FileUserAccess;
use App\Models\PendingReceivedFile;
use App\Models\User;
use Tests\TestCase;

class RevokeAccessTest extends TestCase
{
    public function test_revoke_by_contact_id_also_removes_contact_pending_share(): void
    {
        $owner   = User::factory()->create();
        $file    = File::factory()->create(['owner_id' => $owner->id]);

        FileUserAccess::factory()->owner()->create([
            'file_id' => $file->id,
            'user_id' => $owner->id,
        ]);

        // Unresolved/pending contact (no resolved_user_id)
        $contact = Contact::factory()->create(['user_id' => $owner->id]);

        $pendingShare = ContactPendingShare::create([
            'contact_id'     => $contact->id,
            'file_id'        => $file->id,
            'sender_user_id' => $owner->id,
            'can_edit'       => false,
        ]);

        $response = $this->actingAs($owner)
            ->deleteJson("/api/v1/files/{$file->id}/share-to-contact/{$contact->id}");

        $response->assertOk();

        $this->assertDatabaseMissing('contact_pending_shares', [
            'id' => $pendingShare->id,
        ]);
    }

    public function test_revoke_by_user_id_removes_pending_received_file(): void
    {
        $owner     = User::factory()->create();
        $recipient = User::factory()->create(['auto_add_received_files' => false]);
        $file      = File::factory()->create(['owner_id' => $owner->id]);

        FileUserAccess::factory()->owner()->create([
            'file_id' => $file->id,
            'user_id' => $owner->id,
        ]);

        $pending = PendingReceivedFile::create([
            'file_id'           => $file->id,
            'recipient_user_id' => $recipient->id,
            'sender_user_id'    => $owner->id,
            'can_edit'          => false,
        ]);

        // Revoke using numeric user ID (no contact UUID)
        $response = $this->actingAs($owner)
            ->deleteJson("/api/v1/files/{$file->id}/share-to-contact/{$recipient->id}");

        $response->assertOk();

        $this->assertDatabaseMissing('pending_received_files', [
            'id' => $pending->id,
        ]);
    }

    public function test_revoke_by_user_id_returns_404_when_no_access_exists(): void
    {
        $owner     = User::factory()->create();
        $otherUser = User::factory()->create();
        $file      = File::factory()->create(['owner_id' => $owner->id]);

        FileUserAccess::factory()->owner()->create([
            'file_id' => $file->id,
            'user_id' => $owner->id,
        ]);

        // No FileUserAccess or PendingReceivedFile for $otherUser
        $response = $this->actingAs($owner)
            ->deleteJson("/api/v1/files/{$file->id}/share-to-contact/{$otherUser->id}");

        $response->assertNotFound();
    }

    public function test_revoke_reassigns_task_assignee_to_owner_when_assignee_is_revoked(): void
    {
        $owner     = User::factory()->create();
        $recipient = User::factory()->create();
        $file      = File::factory()->create([
            'owner_id'              => $owner->id,
            'is_task'               => true,
            'task_assigned_user_id' => $recipient->id,
        ]);
        $contact = Contact::factory()->resolvedTo($recipient)->create([
            'user_id' => $owner->id,
        ]);

        FileUserAccess::factory()->owner()->create([
            'file_id' => $file->id,
            'user_id' => $owner->id,
        ]);
        FileUserAccess::factory()->create([
            'file_id' => $file->id,
            'user_id' => $recipient->id,
        ]);

        $response = $this->actingAs($owner)
            ->deleteJson("/api/v1/files/{$file->id}/share-to-contact/{$contact->id}");

        $response->assertOk();

        $this->assertDatabaseHas('files', [
            'id'                    => $file->id,
            'task_assigned_user_id' => $owner->id,
        ]);
    }

    public function test_revoke_does_not_change_assignee_when_different_user_revoked(): void
    {
        $owner   = User::factory()->create();
        $userA   = User::factory()->create();
        $userB   = User::factory()->create();
        $file    = File::factory()->create([
            'owner_id'              => $owner->id,
            'is_task'               => true,
            'task_assigned_user_id' => $userA->id,
        ]);
        $contactB = Contact::factory()->resolvedTo($userB)->create([
            'user_id' => $owner->id,
        ]);

        FileUserAccess::factory()->owner()->create([
            'file_id' => $file->id,
            'user_id' => $owner->id,
        ]);
        FileUserAccess::factory()->create([
            'file_id' => $file->id,
            'user_id' => $userA->id,
        ]);
        FileUserAccess::factory()->create([
            'file_id' => $file->id,
            'user_id' => $userB->id,
        ]);

        // Revoke access for userB (not the assignee)
        $response = $this->actingAs($owner)
            ->deleteJson("/api/v1/files/{$file->id}/share-to-contact/{$contactB->id}");

        $response->assertOk();

        // task_assigned_user_id should remain userA
        $this->assertDatabaseHas('files', [
            'id'                    => $file->id,
            'task_assigned_user_id' => $userA->id,
        ]);
    }
}
