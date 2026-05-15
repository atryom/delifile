<?php

namespace Tests\Feature\Comments;

use App\Models\User;
use App\Models\File;
use App\Models\FileUserAccess;
use App\Models\CommentThread;
use App\Models\Comment;
use Tests\TestCase;

class CommentTest extends TestCase
{
    private function createFileWithAccess(User $user): File
    {
        $file = File::factory()->create(['owner_id' => $user->id]);
        FileUserAccess::factory()->owner()->create([
            'file_id' => $file->id,
            'user_id' => $user->id,
        ]);
        return $file;
    }

    // ─── Threads ─────────────────────────────────────────────────────────────

    public function test_user_can_list_comment_threads(): void
    {
        $user = User::factory()->create();
        $file = $this->createFileWithAccess($user);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/comment-threads?' . http_build_query([
                'targetType' => 'file',
                'targetId'   => $file->id,
                'scope'      => 'all',
            ]));

        $response->assertOk()
            ->assertJsonPath('result', 'success')
            ->assertJsonStructure(['data' => ['policy', 'threads']]);
    }

    public function test_user_can_create_comment_on_file(): void
    {
        $user = User::factory()->create();
        $file = $this->createFileWithAccess($user);

        $response = $this->actingAs($user)
            ->postJson('/api/v1/comments', [
                'targetType' => 'file',
                'targetId'   => $file->id,
                'scope'      => 'private',
                'body'       => 'Nice file!',
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('result', 'success')
            ->assertJsonPath('data.comment.body', 'Nice file!')
            ->assertJsonStructure(['data' => ['comment' => ['id', 'body', 'author']]]);
    }

    public function test_user_can_reply_to_comment(): void
    {
        $user = User::factory()->create();
        $file = $this->createFileWithAccess($user);

        // Create parent comment
        $parentResponse = $this->actingAs($user)
            ->postJson('/api/v1/comments', [
                'targetType' => 'file',
                'targetId'   => $file->id,
                'scope'      => 'private',
                'body'       => 'Parent',
            ]);

        $threadId = $parentResponse->json('data.comment.thread_id');
        $parentId = $parentResponse->json('data.comment.id');

        // Reply
        $response = $this->actingAs($user)
            ->postJson('/api/v1/comments', [
                'threadId'        => $threadId,
                'body'            => 'Reply!',
                'parentCommentId' => $parentId,
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.comment.body', 'Reply!');
    }

    public function test_user_can_update_own_comment(): void
    {
        $user = User::factory()->create();
        $file = $this->createFileWithAccess($user);

        $createResponse = $this->actingAs($user)
            ->postJson('/api/v1/comments', [
                'targetType' => 'file',
                'targetId'   => $file->id,
                'scope'      => 'private',
                'body'       => 'Original',
            ]);

        $commentId = $createResponse->json('data.comment.id');

        $response = $this->actingAs($user)
            ->patchJson("/api/v1/comments/{$commentId}", ['body' => 'Updated']);

        $response->assertOk()
            ->assertJsonPath('data.comment.body', 'Updated');
    }

    public function test_user_cannot_update_others_comment(): void
    {
        $author = User::factory()->create();
        $other = User::factory()->create();
        $file = $this->createFileWithAccess($author);

        $createResponse = $this->actingAs($author)
            ->postJson('/api/v1/comments', [
                'targetType' => 'file',
                'targetId'   => $file->id,
                'scope'      => 'private',
                'body'       => 'Author comment',
            ]);

        $commentId = $createResponse->json('data.comment.id');

        $response = $this->actingAs($other)
            ->patchJson("/api/v1/comments/{$commentId}", ['body' => 'Hacked']);

        $response->assertStatus(403);
    }

    public function test_user_can_delete_own_comment(): void
    {
        $user = User::factory()->create();
        $file = $this->createFileWithAccess($user);

        $createResponse = $this->actingAs($user)
            ->postJson('/api/v1/comments', [
                'targetType' => 'file',
                'targetId'   => $file->id,
                'scope'      => 'private',
                'body'       => 'Delete me',
            ]);

        $commentId = $createResponse->json('data.comment.id');

        $response = $this->actingAs($user)
            ->deleteJson("/api/v1/comments/{$commentId}");

        $response->assertOk();
    }

    public function test_user_cannot_delete_others_comment(): void
    {
        $author = User::factory()->create();
        $other = User::factory()->create();
        $file = $this->createFileWithAccess($author);

        $createResponse = $this->actingAs($author)
            ->postJson('/api/v1/comments', [
                'targetType' => 'file',
                'targetId'   => $file->id,
                'scope'      => 'private',
                'body'       => 'Mine',
            ]);

        $commentId = $createResponse->json('data.comment.id');

        $response = $this->actingAs($other)
            ->deleteJson("/api/v1/comments/{$commentId}");

        $response->assertStatus(403);
    }

    // ─── Thread read ─────────────────────────────────────────────────────────

    public function test_user_can_mark_thread_as_read(): void
    {
        $user = User::factory()->create();
        $file = $this->createFileWithAccess($user);

        $createResponse = $this->actingAs($user)
            ->postJson('/api/v1/comments', [
                'targetType' => 'file',
                'targetId'   => $file->id,
                'scope'      => 'private',
                'body'       => 'Hello',
            ]);

        $threadId = $createResponse->json('data.comment.thread_id');

        $response = $this->actingAs($user)
            ->postJson("/api/v1/comment-threads/{$threadId}/read");

        $response->assertOk();
    }

    // ─── Comment settings ────────────────────────────────────────────────────

    public function test_owner_can_update_file_comment_settings(): void
    {
        $user = User::factory()->create();
        $file = $this->createFileWithAccess($user);

        $response = $this->actingAs($user)
            ->patchJson("/api/v1/files/{$file->id}/comment-settings", [
                'sharedCommentsEnabled' => false,
                'mentionsEnabled'       => true,
            ]);

        $response->assertOk()
            ->assertJsonPath('result', 'success');
    }

    public function test_non_owner_cannot_update_file_comment_settings(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $file = $this->createFileWithAccess($owner);

        $response = $this->actingAs($other)
            ->patchJson("/api/v1/files/{$file->id}/comment-settings", [
                'sharedCommentsEnabled' => false,
            ]);

        $response->assertStatus(403);
    }

    // ─── Validation ──────────────────────────────────────────────────────────

    public function test_creating_comment_without_thread_or_target_fails(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/comments', ['body' => 'Orphan']);

        $response->assertStatus(422);
    }

    public function test_creating_comment_with_empty_body_fails(): void
    {
        $user = User::factory()->create();
        $file = $this->createFileWithAccess($user);

        $response = $this->actingAs($user)
            ->postJson('/api/v1/comments', [
                'targetType' => 'file',
                'targetId'   => $file->id,
                'scope'      => 'private',
                'body'       => '',
            ]);

        $response->assertStatus(422);
    }

    public function test_unauthenticated_user_cannot_access_comments(): void
    {
        $response = $this->getJson('/api/v1/comment-threads?targetType=file&targetId=x&scope=all');
        $response->assertUnauthorized();
    }
}
