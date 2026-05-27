<?php

namespace Tests\Feature\Sharing;

use App\Models\Contact;
use App\Models\File;
use App\Models\FileUserAccess;
use App\Models\PendingReceivedFile;
use App\Models\SharedFolder;
use App\Models\SharedFolderAccess;
use App\Models\SharedFolderFile;
use App\Models\User;
use Tests\TestCase;

class SharedFolderAccessShareTest extends TestCase
{
    public function test_share_to_contact_grants_direct_access_when_recipient_has_folder_access(): void
    {
        $owner     = User::factory()->create();
        $recipient = User::factory()->create(['auto_add_received_files' => false]);
        $file      = File::factory()->create(['owner_id' => $owner->id]);
        $contact   = Contact::factory()->resolvedTo($recipient)->create([
            'user_id' => $owner->id,
        ]);

        FileUserAccess::factory()->owner()->create([
            'file_id' => $file->id,
            'user_id' => $owner->id,
        ]);

        // Create a shared folder and add the file to it
        $folder = SharedFolder::factory()->create(['owner_id' => $owner->id]);
        SharedFolderFile::create([
            'shared_folder_id' => $folder->id,
            'file_id'          => $file->id,
            'added_by'         => $owner->id,
        ]);

        // Give recipient access to the folder
        SharedFolderAccess::factory()->create([
            'shared_folder_id' => $folder->id,
            'user_id'          => $recipient->id,
        ]);

        $response = $this->actingAs($owner)
            ->postJson("/api/v1/files/{$file->id}/share-to-contact", [
                'contact_id' => $contact->id,
            ]);

        $response->assertOk()->assertJson(['result' => 'success']);

        // A direct FileUserAccess should be created
        $this->assertDatabaseHas('file_user_access', [
            'file_id' => $file->id,
            'user_id' => $recipient->id,
        ]);

        // No PendingReceivedFile should be created
        $this->assertDatabaseMissing('pending_received_files', [
            'file_id'           => $file->id,
            'recipient_user_id' => $recipient->id,
        ]);
    }

    public function test_share_to_contact_creates_pending_when_no_folder_access(): void
    {
        $owner     = User::factory()->create();
        $recipient = User::factory()->create(['auto_add_received_files' => false]);
        $file      = File::factory()->create(['owner_id' => $owner->id]);
        $contact   = Contact::factory()->resolvedTo($recipient)->create([
            'user_id' => $owner->id,
        ]);

        FileUserAccess::factory()->owner()->create([
            'file_id' => $file->id,
            'user_id' => $owner->id,
        ]);

        // File is NOT in any shared folder accessible by the recipient
        $response = $this->actingAs($owner)
            ->postJson("/api/v1/files/{$file->id}/share-to-contact", [
                'contact_id' => $contact->id,
            ]);

        $response->assertOk()->assertJson(['result' => 'success']);

        // PendingReceivedFile should be created
        $this->assertDatabaseHas('pending_received_files', [
            'file_id'           => $file->id,
            'recipient_user_id' => $recipient->id,
        ]);

        // No direct FileUserAccess should be created
        $this->assertDatabaseMissing('file_user_access', [
            'file_id' => $file->id,
            'user_id' => $recipient->id,
        ]);
    }
}
