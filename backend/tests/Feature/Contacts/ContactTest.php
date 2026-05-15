<?php

namespace Tests\Feature\Contacts;

use App\Models\User;
use App\Models\Contact;
use Tests\TestCase;

class ContactTest extends TestCase
{
    public function test_user_can_list_contacts(): void
    {
        $user = User::factory()->create();
        Contact::factory()->count(3)->create(['user_id' => $user->id]);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/contacts');

        $response->assertOk()
            ->assertJsonStructure([
                'result', 'message',
                'data' => ['items' => [['id', 'name', 'email', 'phone', 'is_registered', 'resolved_user']]],
            ])
            ->assertJsonPath('result', 'success');
    }

    public function test_user_can_create_contact_with_email(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/contacts', [
                'name'  => 'John Doe',
                'email' => 'john@example.com',
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('result', 'success')
            ->assertJsonPath('data.contact.name', 'John Doe')
            ->assertJsonPath('data.contact.email', 'john@example.com');

        $this->assertDatabaseHas('contacts', [
            'user_id' => $user->id,
            'email'   => 'john@example.com',
        ]);
    }

    public function test_user_can_create_contact_with_phone(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/contacts', [
                'name'  => 'Jane Doe',
                'phone' => '+1234567890',
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('result', 'success');

        $this->assertDatabaseHas('contacts', [
            'user_id' => $user->id,
            'phone'   => '+1234567890',
        ]);
    }

    public function test_contact_creation_without_email_or_phone_fails(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/contacts', [
                'name' => 'No Contact Info',
            ]);

        $response->assertStatus(422);
    }

    public function test_creating_duplicate_contact_email_fails(): void
    {
        $user = User::factory()->create();
        Contact::factory()->create([
            'user_id' => $user->id,
            'email'   => 'existing@example.com',
        ]);

        $response = $this->actingAs($user)
            ->postJson('/api/v1/contacts', [
                'name'  => 'Duplicate',
                'email' => 'existing@example.com',
            ]);

        $response->assertStatus(422);
    }

    public function test_user_can_show_contact(): void
    {
        $user = User::factory()->create();
        $contact = Contact::factory()->create(['user_id' => $user->id]);

        $response = $this->actingAs($user)
            ->getJson("/api/v1/contacts/{$contact->id}");

        $response->assertOk()
            ->assertJsonPath('data.contact.id', $contact->id);
    }

    public function test_showing_other_users_contact_returns_404(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $contact = Contact::factory()->create(['user_id' => $other->id]);

        $response = $this->actingAs($user)
            ->getJson("/api/v1/contacts/{$contact->id}");

        $response->assertStatus(404);
    }

    public function test_user_can_delete_contact(): void
    {
        $user = User::factory()->create();
        $contact = Contact::factory()->create(['user_id' => $user->id]);

        $response = $this->actingAs($user)
            ->deleteJson("/api/v1/contacts/{$contact->id}");

        $response->assertOk();
        $this->assertDatabaseMissing('contacts', ['id' => $contact->id]);
    }

    public function test_user_can_import_contacts(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/contacts/import', [
                'contacts' => [
                    ['name' => 'Alice', 'email' => 'alice@example.com'],
                    ['name' => 'Bob',   'email' => 'bob@example.com'],
                ],
            ]);

        $response->assertOk()
            ->assertJsonPath('data.imported', 2);
    }

    public function test_unauthenticated_user_cannot_access_contacts(): void
    {
        $response = $this->getJson('/api/v1/contacts');
        $response->assertUnauthorized();
    }
}
