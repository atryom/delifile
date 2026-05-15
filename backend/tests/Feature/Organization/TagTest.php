<?php

namespace Tests\Feature\Organization;

use App\Models\User;
use App\Models\Tag;
use App\Models\File;
use App\Models\FileUserAccess;
use Tests\TestCase;

class TagTest extends TestCase
{
    public function test_user_can_list_tags(): void
    {
        $user = User::factory()->create();
        Tag::factory()->count(3)->create(['user_id' => $user->id]);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/tags');

        $response->assertOk()
            ->assertJsonPath('result', 'success')
            ->assertJsonStructure(['data' => ['items' => [['id', 'name', 'files_count']]]]);
    }

    public function test_user_can_search_tags(): void
    {
        $user = User::factory()->create();
        Tag::factory()->create(['user_id' => $user->id, 'name' => 'urgent']);
        Tag::factory()->create(['user_id' => $user->id, 'name' => 'other']);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/tags?search=urg');

        $response->assertOk();
        $this->assertCount(1, $response->json('data.items'));
    }

    public function test_user_can_create_tag(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/tags', ['name' => 'important']);

        $response->assertStatus(201)
            ->assertJsonPath('result', 'success')
            ->assertJsonPath('data.tag.name', 'important');

        $this->assertDatabaseHas('tags', [
            'user_id' => $user->id,
            'name'    => 'important',
        ]);
    }

    public function test_creating_duplicate_tag_fails(): void
    {
        $user = User::factory()->create();
        Tag::factory()->create(['user_id' => $user->id, 'name' => 'duplicate']);

        $response = $this->actingAs($user)
            ->postJson('/api/v1/tags', ['name' => 'duplicate']);

        $response->assertStatus(422)
            ->assertJsonPath('data.code', 'TAG_EXISTS');
    }

    public function test_user_can_update_tag(): void
    {
        $user = User::factory()->create();
        $tag = Tag::factory()->create(['user_id' => $user->id, 'name' => 'old']);

        $response = $this->actingAs($user)
            ->patchJson("/api/v1/tags/{$tag->id}", ['name' => 'new']);

        $response->assertOk()
            ->assertJsonPath('data.tag.name', 'new');
    }

    public function test_updating_other_users_tag_returns_404(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $tag = Tag::factory()->create(['user_id' => $other->id]);

        $response = $this->actingAs($user)
            ->patchJson("/api/v1/tags/{$tag->id}", ['name' => 'hacked']);

        $response->assertStatus(404);
    }

    public function test_user_can_delete_tag(): void
    {
        $user = User::factory()->create();
        $tag = Tag::factory()->create(['user_id' => $user->id]);

        $response = $this->actingAs($user)
            ->deleteJson("/api/v1/tags/{$tag->id}");

        $response->assertOk();
        $this->assertDatabaseMissing('tags', ['id' => $tag->id]);
    }

    public function test_user_can_attach_tags_to_file(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $user->id]);
        FileUserAccess::factory()->owner()->create([
            'file_id' => $file->id,
            'user_id' => $user->id,
        ]);
        $tag = Tag::factory()->create(['user_id' => $user->id]);

        $response = $this->actingAs($user)
            ->postJson("/api/v1/files/{$file->id}/attach-tags", [
                'tag_ids' => [$tag->id],
            ]);

        $response->assertOk();
        $this->assertDatabaseHas('file_tags', [
            'file_id' => $file->id,
            'tag_id'  => $tag->id,
            'user_id' => $user->id,
        ]);
    }

    public function test_user_can_detach_tags_from_file(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $user->id]);
        FileUserAccess::factory()->owner()->create([
            'file_id' => $file->id,
            'user_id' => $user->id,
        ]);
        $tag = Tag::factory()->create(['user_id' => $user->id]);

        // First attach
        $this->actingAs($user)
            ->postJson("/api/v1/files/{$file->id}/attach-tags", ['tag_ids' => [$tag->id]]);

        // Then detach
        $response = $this->actingAs($user)
            ->postJson("/api/v1/files/{$file->id}/detach-tags", ['tag_ids' => [$tag->id]]);

        $response->assertOk();
        $this->assertDatabaseMissing('file_tags', [
            'file_id' => $file->id,
            'tag_id'  => $tag->id,
        ]);
    }

    public function test_unauthenticated_user_cannot_access_tags(): void
    {
        $response = $this->getJson('/api/v1/tags');
        $response->assertUnauthorized();
    }
}
