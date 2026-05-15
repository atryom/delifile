<?php

namespace Tests\Feature\Admin;

use App\Models\SuggestionAdminComment;
use App\Models\SuggestionTicket;
use App\Models\User;
use Tests\TestCase;

class SuggestionAdminTest extends TestCase
{
    private User $admin;
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['is_superuser' => true]);
        $this->user  = User::factory()->create();
    }

    public function test_non_superuser_cannot_access_admin_suggestions(): void
    {
        $user = User::factory()->create(['is_superuser' => false]);

        $response = $this->actingAs($user)->getJson('/api/v1/admin/suggestions');

        $response->assertStatus(403)
            ->assertJsonPath('data.code', 'FORBIDDEN');
    }

    public function test_admin_can_list_suggestions(): void
    {
        SuggestionTicket::create(['user_id' => $this->user->id, 'body' => 'Great idea', 'status' => 'new']);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/v1/admin/suggestions');

        $response->assertOk()
            ->assertJsonPath('result', 'success')
            ->assertJsonStructure(['data' => ['items', 'pagination']]);
    }

    public function test_admin_can_list_suggestions_with_status_filter(): void
    {
        SuggestionTicket::create(['user_id' => $this->user->id, 'body' => 'Idea 1', 'status' => 'new']);
        SuggestionTicket::create(['user_id' => $this->user->id, 'body' => 'Idea 2', 'status' => 'accepted']);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/v1/admin/suggestions?status=accepted');

        $response->assertOk();
        $this->assertGreaterThanOrEqual(1, $response->json('data.items'));
    }

    public function test_admin_can_view_suggestion_detail(): void
    {
        $suggestion = SuggestionTicket::create(['user_id' => $this->user->id, 'body' => 'My idea', 'status' => 'new']);

        $response = $this->actingAs($this->admin)
            ->getJson("/api/v1/admin/suggestions/{$suggestion->id}");

        $response->assertOk()
            ->assertJsonStructure(['data' => ['suggestion' => ['id', 'body', 'status', 'user', 'admin_comments']]]);
    }

    public function test_admin_view_nonexistent_suggestion_returns_404(): void
    {
        $response = $this->actingAs($this->admin)
            ->getJson('/api/v1/admin/suggestions/nonexistent');

        $response->assertStatus(404);
    }

    public function test_admin_can_update_suggestion_status(): void
    {
        $suggestion = SuggestionTicket::create(['user_id' => $this->user->id, 'body' => 'Idea', 'status' => 'new']);

        $response = $this->actingAs($this->admin)
            ->patchJson("/api/v1/admin/suggestions/{$suggestion->id}/status", [
                'status' => 'accepted',
            ]);

        $response->assertOk()
            ->assertJsonPath('data.status', 'accepted');

        $this->assertDatabaseHas('suggestion_tickets', [
            'id'     => $suggestion->id,
            'status' => 'accepted',
        ]);
    }

    public function test_update_status_requires_valid_status(): void
    {
        $suggestion = SuggestionTicket::create(['user_id' => $this->user->id, 'body' => 'Idea', 'status' => 'new']);

        $response = $this->actingAs($this->admin)
            ->patchJson("/api/v1/admin/suggestions/{$suggestion->id}/status", [
                'status' => 'invalid_status',
            ]);

        $response->assertStatus(422);
    }

    public function test_admin_can_add_comment_to_suggestion(): void
    {
        $suggestion = SuggestionTicket::create(['user_id' => $this->user->id, 'body' => 'Idea', 'status' => 'new']);

        $response = $this->actingAs($this->admin)
            ->postJson("/api/v1/admin/suggestions/{$suggestion->id}/comments", [
                'body' => 'We like this idea',
            ]);

        $response->assertOk()
            ->assertJsonStructure(['data' => ['comment' => ['id', 'body', 'created_at']]]);

        $this->assertDatabaseHas('suggestion_admin_comments', [
            'suggestion_id' => $suggestion->id,
            'body'          => 'We like this idea',
        ]);
    }

    public function test_add_comment_requires_body(): void
    {
        $suggestion = SuggestionTicket::create(['user_id' => $this->user->id, 'body' => 'Idea', 'status' => 'new']);

        $response = $this->actingAs($this->admin)
            ->postJson("/api/v1/admin/suggestions/{$suggestion->id}/comments", []);

        $response->assertStatus(422);
    }

    public function test_add_comment_to_nonexistent_suggestion_returns_404(): void
    {
        $response = $this->actingAs($this->admin)
            ->postJson('/api/v1/admin/suggestions/nonexistent/comments', ['body' => 'Comment']);

        $response->assertStatus(404);
    }

    public function test_unauthenticated_cannot_access_admin_suggestions(): void
    {
        $response = $this->getJson('/api/v1/admin/suggestions');
        $response->assertUnauthorized();
    }
}
