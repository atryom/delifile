<?php

namespace Tests\Feature\Sharing;

use App\Models\Contact;
use App\Models\ContactPendingShare;
use App\Models\File;
use App\Models\FileUserAccess;
use App\Models\User;
use App\Enums\AccessType;
use Tests\TestCase;

class PendingShareTest extends TestCase
{
    private User $owner;
    private File $file;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = User::factory()->create();
        $this->file = File::factory()->create(['owner_id' => $this->owner->id]);
        FileUserAccess::factory()->owner()->create([
            'file_id' => $this->file->id,
            'user_id' => $this->owner->id,
        ]);
    }

    public function test_share_to_unresolved_contact_creates_pending_share(): void
    {
        $contact = Contact::factory()->create([
            'user_id'          => $this->owner->id,
            'email'            => 'pending@test.com',
            'resolved_user_id' => null,
        ]);

        $response = $this->actingAs($this->owner)
            ->postJson("/api/v1/files/{$this->file->id}/share-to-contact", [
                'contact_id' => $contact->id,
            ]);

        $response->assertOk()
            ->assertJsonPath('data.share.status', 'pending');

        $this->assertDatabaseHas('contact_pending_shares', [
            'contact_id' => $contact->id,
            'file_id'    => $this->file->id,
        ]);
    }

    public function test_share_to_unresolved_contact_twice_does_not_duplicate(): void
    {
        $contact = Contact::factory()->create([
            'user_id'          => $this->owner->id,
            'email'            => 'pending@test.com',
            'resolved_user_id' => null,
        ]);

        $this->actingAs($this->owner)
            ->postJson("/api/v1/files/{$this->file->id}/share-to-contact", [
                'contact_id' => $contact->id,
            ])->assertOk();

        $this->actingAs($this->owner)
            ->postJson("/api/v1/files/{$this->file->id}/share-to-contact", [
                'contact_id' => $contact->id,
            ])->assertOk();

        $count = ContactPendingShare::where('contact_id', $contact->id)
            ->where('file_id', $this->file->id)
            ->count();

        $this->assertSame(1, $count);
    }

    public function test_pending_share_delivered_on_invitation_accept(): void
    {
        $contactEmail = 'recipient@test.com';

        $contact = Contact::factory()->create([
            'user_id'          => $this->owner->id,
            'email'            => $contactEmail,
            'resolved_user_id' => null,
        ]);

        $this->actingAs($this->owner)
            ->postJson("/api/v1/files/{$this->file->id}/share-to-contact", [
                'contact_id' => $contact->id,
            ])->assertOk();

        $invitation = \App\Models\Invitation::factory()->create([
            'sender_user_id' => $this->owner->id,
            'target_email'   => $contactEmail,
        ]);

        $recipient = User::factory()->create(['email' => $contactEmail]);

        $acceptResponse = $this->actingAs($recipient)
            ->postJson("/api/v1/invitations/{$invitation->token}/accept");

        $acceptResponse->assertOk();

        $this->assertDatabaseMissing('contact_pending_shares', [
            'contact_id' => $contact->id,
        ]);

        $this->assertDatabaseHas('file_user_access', [
            'file_id'     => $this->file->id,
            'user_id'     => $recipient->id,
            'access_type' => AccessType::Shared->value,
        ]);
    }

    public function test_share_to_resolved_contact_does_not_create_pending(): void
    {
        $recipient = User::factory()->create();
        $contact = Contact::factory()->resolvedTo($recipient)->create([
            'user_id' => $this->owner->id,
            'email'   => $recipient->email,
        ]);

        $response = $this->actingAs($this->owner)
            ->postJson("/api/v1/files/{$this->file->id}/share-to-contact", [
                'contact_id' => $contact->id,
            ]);

        $response->assertOk()
            ->assertJsonPath('data.share.status', 'shared');

        $this->assertDatabaseMissing('contact_pending_shares', [
            'contact_id' => $contact->id,
        ]);
    }
}
