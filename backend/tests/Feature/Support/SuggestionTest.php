<?php

namespace Tests\Feature\Support;

use App\Models\SuggestionTicket;
use App\Models\User;
use Tests\TestCase;

class SuggestionTest extends TestCase
{
    public function test_user_can_create_suggestion(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/support/suggestions', [
                'body' => 'Please add dark mode support.',
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('result', 'success')
            ->assertJsonStructure(['data' => ['suggestion' => ['id', 'body', 'status']]]);
    }

    public function test_create_suggestion_requires_body(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/support/suggestions', []);

        $response->assertStatus(422);
    }

    public function test_user_can_list_own_suggestions(): void
    {
        $user = User::factory()->create();
        SuggestionTicket::create(['user_id' => $user->id, 'body' => 'Test suggestion', 'status' => 'new']);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/support/suggestions');

        $response->assertOk()
            ->assertJsonPath('result', 'success')
            ->assertJsonStructure(['data' => ['items', 'pagination']]);
        $this->assertCount(1, $response->json('data.items'));
    }

    public function test_list_suggestions_shows_only_own(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        SuggestionTicket::create(['user_id' => $user->id, 'body' => 'Mine', 'status' => 'new']);
        SuggestionTicket::create(['user_id' => $other->id, 'body' => 'Theirs', 'status' => 'new']);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/support/suggestions');

        $response->assertOk();
        $this->assertCount(1, $response->json('data.items'));
    }

    public function test_user_can_show_own_suggestion(): void
    {
        $user = User::factory()->create();
        $suggestion = SuggestionTicket::create(['user_id' => $user->id, 'body' => 'Dark mode', 'status' => 'new']);

        $response = $this->actingAs($user)
            ->getJson("/api/v1/support/suggestions/{$suggestion->id}");

        $response->assertOk()
            ->assertJsonPath('result', 'success')
            ->assertJsonPath('data.suggestion.id', $suggestion->id);
    }

    public function test_show_other_users_suggestion_returns_404(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $suggestion = SuggestionTicket::create(['user_id' => $other->id, 'body' => 'Theirs', 'status' => 'new']);

        $response = $this->actingAs($user)
            ->getJson("/api/v1/support/suggestions/{$suggestion->id}");

        $response->assertStatus(404);
    }

    public function test_download_attachment_with_nonexistent_suggestion(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->getJson('/api/v1/support/suggestions/nonexistent/attachments/att1');

        $response->assertStatus(404);
    }

    public function test_unauthenticated_user_cannot_access_suggestions(): void
    {
        $response = $this->getJson('/api/v1/support/suggestions');
        $response->assertUnauthorized();
    }
}
