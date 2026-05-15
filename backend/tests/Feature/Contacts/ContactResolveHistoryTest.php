<?php

namespace Tests\Feature\Contacts;

use App\Models\Contact;
use App\Models\File;
use App\Models\FileUserAccess;
use App\Models\User;
use Tests\TestCase;

class ContactResolveHistoryTest extends TestCase
{
    // ─── Resolve ───────────────────────────────────────────────────────────

    public function test_resolve_links_contacts_by_email(): void
    {
        $user = User::factory()->create();
        $registered = User::factory()->create();
        Contact::factory()->create([
            'user_id'           => $user->id,
            'email'             => $registered->email,
            'resolved_user_id'  => null,
        ]);

        $response = $this->actingAs($user)
            ->postJson('/api/v1/contacts/resolve');

        $response->assertOk()
            ->assertJsonPath('data.newly_resolved', 1);
    }

    public function test_resolve_links_contacts_by_phone(): void
    {
        $user = User::factory()->create();
        $registered = User::factory()->create(['phone' => '+79991112233']);
        Contact::factory()->create([
            'user_id'           => $user->id,
            'phone'             => '+79991112233',
            'email'             => null,
            'resolved_user_id'  => null,
        ]);

        $response = $this->actingAs($user)
            ->postJson('/api/v1/contacts/resolve');

        $response->assertOk()
            ->assertJsonPath('data.newly_resolved', 1);
    }

    public function test_resolve_skips_already_resolved_contacts(): void
    {
        $user = User::factory()->create();
        $registered = User::factory()->create();
        Contact::factory()->create([
            'user_id'          => $user->id,
            'email'            => $registered->email,
            'resolved_user_id' => $registered->id,
        ]);

        $response = $this->actingAs($user)
            ->postJson('/api/v1/contacts/resolve');

        $response->assertOk()
            ->assertJsonPath('data.newly_resolved', 0);
    }

    public function test_resolve_returns_zero_when_no_contacts(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/contacts/resolve');

        $response->assertOk()
            ->assertJsonPath('data.newly_resolved', 0);
    }

    // ─── History ───────────────────────────────────────────────────────────

    public function test_history_returns_shared_files_for_contact(): void
    {
        $user = User::factory()->create();
        $recipient = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $user->id]);
        $contact = Contact::factory()->resolvedTo($recipient)->create([
            'user_id' => $user->id,
        ]);
        FileUserAccess::create([
            'file_id'     => $file->id,
            'user_id'     => $recipient->id,
            'contact_id'  => $contact->id,
            'access_type' => 'shared',
        ]);

        $response = $this->actingAs($user)
            ->getJson("/api/v1/contacts/{$contact->id}/history");

        $response->assertOk()
            ->assertJsonPath('result', 'success')
            ->assertJsonStructure(['data' => ['items']]);
        $this->assertCount(1, $response->json('data.items'));
    }

    public function test_history_returns_empty_when_no_shares(): void
    {
        $user = User::factory()->create();
        $contact = Contact::factory()->create(['user_id' => $user->id]);

        $response = $this->actingAs($user)
            ->getJson("/api/v1/contacts/{$contact->id}/history");

        $response->assertOk()
            ->assertJsonPath('data.items', []);
    }

    public function test_history_other_users_contact_returns_404(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $contact = Contact::factory()->create(['user_id' => $other->id]);

        $response = $this->actingAs($user)
            ->getJson("/api/v1/contacts/{$contact->id}/history");

        $response->assertStatus(404);
    }

    public function test_history_nonexistent_contact_returns_404(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->getJson('/api/v1/contacts/nonexistent/history');

        $response->assertStatus(404);
    }

    public function test_unauthenticated_cannot_resolve(): void
    {
        $response = $this->postJson('/api/v1/contacts/resolve');
        $response->assertUnauthorized();
    }

    public function test_unauthenticated_cannot_view_history(): void
    {
        $response = $this->getJson('/api/v1/contacts/some-id/history');
        $response->assertUnauthorized();
    }
}
