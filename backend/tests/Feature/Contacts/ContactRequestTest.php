<?php

namespace Tests\Feature\Contacts;

use App\Models\Contact;
use App\Models\ContactRequest;
use App\Models\User;
use Tests\TestCase;

class ContactRequestTest extends TestCase
{
    public function test_list_returns_pending_requests(): void
    {
        $user = User::factory()->create();
        $requester = User::factory()->create();

        ContactRequest::create([
            'requester_id'    => $requester->id,
            'target_user_id'  => $user->id,
            'status'          => 'pending',
        ]);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/contact-requests');

        $response->assertOk()
            ->assertJsonPath('result', 'success')
            ->assertJsonStructure(['data' => ['items' => [['id', 'requester', 'status', 'created_at']]]]);
        $this->assertCount(1, $response->json('data.items'));
    }

    public function test_list_returns_only_pending_requests(): void
    {
        $user = User::factory()->create();
        $requester = User::factory()->create();
        $otherRequester = User::factory()->create();

        ContactRequest::create([
            'requester_id'    => $requester->id,
            'target_user_id'  => $user->id,
            'status'          => 'pending',
        ]);
        ContactRequest::create([
            'requester_id'    => $otherRequester->id,
            'target_user_id'  => $user->id,
            'status'          => 'accepted',
        ]);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/contact-requests');

        $response->assertOk();
        $this->assertCount(1, $response->json('data.items'));
    }

    public function test_accept_request_updates_status(): void
    {
        $user = User::factory()->create();
        $requester = User::factory()->create();
        $contact = Contact::factory()->create([
            'user_id' => $requester->id,
            'email'   => $user->email,
        ]);

        $request = ContactRequest::create([
            'requester_id'    => $requester->id,
            'target_user_id'  => $user->id,
            'contact_id'      => $contact->id,
            'status'          => 'pending',
        ]);

        $response = $this->actingAs($user)
            ->postJson("/api/v1/contact-requests/{$request->id}/accept");

        $response->assertOk()
            ->assertJsonPath('result', 'success');
        $this->assertDatabaseHas('contact_requests', ['id' => $request->id, 'status' => 'accepted']);
    }

    public function test_accept_nonexistent_request_returns_404(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/contact-requests/nonexistent-id/accept');

        $response->assertStatus(404);
    }

    public function test_reject_request_updates_status(): void
    {
        $user = User::factory()->create();
        $requester = User::factory()->create();

        $request = ContactRequest::create([
            'requester_id'    => $requester->id,
            'target_user_id'  => $user->id,
            'status'          => 'pending',
        ]);

        $response = $this->actingAs($user)
            ->postJson("/api/v1/contact-requests/{$request->id}/reject");

        $response->assertOk()
            ->assertJsonPath('result', 'success');
        $this->assertDatabaseHas('contact_requests', ['id' => $request->id, 'status' => 'rejected']);
    }

    public function test_reject_other_users_request_returns_404(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $requester = User::factory()->create();

        $request = ContactRequest::create([
            'requester_id'    => $requester->id,
            'target_user_id'  => $other->id,
            'status'          => 'pending',
        ]);

        $response = $this->actingAs($user)
            ->postJson("/api/v1/contact-requests/{$request->id}/reject");

        $response->assertStatus(404);
    }

    public function test_unauthenticated_user_cannot_access_contact_requests(): void
    {
        $response = $this->getJson('/api/v1/contact-requests');
        $response->assertUnauthorized();
    }
}
