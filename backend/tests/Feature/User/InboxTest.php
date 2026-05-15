<?php

namespace Tests\Feature\User;

use App\Enums\AccessType;
use App\Enums\SharedFolderAccessType;
use App\Models\File;
use App\Models\FileUserAccess;
use App\Models\PendingReceivedFile;
use App\Models\PendingReceivedSharedFolder;
use App\Models\SharedFolder;
use App\Models\User;
use Tests\TestCase;

class InboxTest extends TestCase
{
    public function test_count_returns_zero_when_empty(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson('/api/v1/inbox/count');

        $response->assertOk()
            ->assertJsonPath('data.files', 0)
            ->assertJsonPath('data.folders', 0)
            ->assertJsonPath('data.total', 0);
    }

    public function test_count_returns_correct_counts(): void
    {
        $user = User::factory()->create();
        $sender = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $sender->id]);
        $folder = SharedFolder::factory()->create(['owner_id' => $sender->id]);

        PendingReceivedFile::create([
            'file_id'           => $file->id,
            'recipient_user_id' => $user->id,
            'sender_user_id'    => $sender->id,
        ]);
        PendingReceivedSharedFolder::create([
            'shared_folder_id'  => $folder->id,
            'recipient_user_id' => $user->id,
            'inviter_user_id'   => $sender->id,
            'access_type'       => SharedFolderAccessType::View->value,
        ]);

        $response = $this->actingAs($user)->getJson('/api/v1/inbox/count');

        $response->assertOk()
            ->assertJsonPath('data.files', 1)
            ->assertJsonPath('data.folders', 1)
            ->assertJsonPath('data.total', 2);
    }

    public function test_list_files_returns_empty_when_none(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson('/api/v1/inbox/files');

        $response->assertOk()
            ->assertJsonPath('data.items', []);
    }

    public function test_list_files_returns_pending_files(): void
    {
        $user = User::factory()->create();
        $sender = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $sender->id]);

        PendingReceivedFile::create([
            'file_id'           => $file->id,
            'recipient_user_id' => $user->id,
            'sender_user_id'    => $sender->id,
        ]);

        $response = $this->actingAs($user)->getJson('/api/v1/inbox/files');

        $response->assertOk();
        $this->assertCount(1, $response->json('data.items'));
        $response->assertJsonStructure(['data' => ['items' => [['id', 'file_id', 'file', 'sender', 'received_at']]]]);
    }

    public function test_list_files_shows_only_for_recipient(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $sender = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $sender->id]);

        PendingReceivedFile::create([
            'file_id'           => $file->id,
            'recipient_user_id' => $other->id,
            'sender_user_id'    => $sender->id,
        ]);

        $response = $this->actingAs($user)->getJson('/api/v1/inbox/files');

        $response->assertOk();
        $this->assertCount(0, $response->json('data.items'));
    }

    public function test_accept_file_creates_access(): void
    {
        $user = User::factory()->create();
        $sender = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $sender->id]);

        $pending = PendingReceivedFile::create([
            'file_id'           => $file->id,
            'recipient_user_id' => $user->id,
            'sender_user_id'    => $sender->id,
        ]);

        $response = $this->actingAs($user)
            ->postJson('/api/v1/inbox/files/accept', ['ids' => [$pending->id]]);

        $response->assertOk();
        $this->assertDatabaseHas('file_user_access', [
            'file_id'     => $file->id,
            'user_id'     => $user->id,
            'access_type' => AccessType::Shared,
        ]);
        $this->assertDatabaseMissing('pending_received_files', ['id' => $pending->id]);
    }

    public function test_accept_file_requires_ids(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/inbox/files/accept', []);

        $response->assertStatus(422);
    }

    public function test_reject_file_removes_pending(): void
    {
        $user = User::factory()->create();
        $sender = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $sender->id]);

        $pending = PendingReceivedFile::create([
            'file_id'           => $file->id,
            'recipient_user_id' => $user->id,
            'sender_user_id'    => $sender->id,
        ]);

        $response = $this->actingAs($user)
            ->postJson('/api/v1/inbox/files/reject', ['ids' => [$pending->id]]);

        $response->assertOk();
        $this->assertDatabaseMissing('pending_received_files', ['id' => $pending->id]);
    }

    public function test_list_shared_folders_returns_pending(): void
    {
        $user = User::factory()->create();
        $inviter = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $inviter->id]);

        PendingReceivedSharedFolder::create([
            'shared_folder_id'  => $folder->id,
            'recipient_user_id' => $user->id,
            'inviter_user_id'   => $inviter->id,
            'access_type'       => SharedFolderAccessType::View->value,
        ]);

        $response = $this->actingAs($user)->getJson('/api/v1/inbox/shared-folders');

        $response->assertOk();
        $this->assertCount(1, $response->json('data.items'));
        $response->assertJsonStructure(['data' => ['items' => [['id', 'shared_folder_id', 'folder', 'access_type', 'inviter', 'received_at']]]]);
    }

    public function test_accept_shared_folder_creates_access(): void
    {
        $user = User::factory()->create();
        $inviter = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $inviter->id]);

        $pending = PendingReceivedSharedFolder::create([
            'shared_folder_id'  => $folder->id,
            'recipient_user_id' => $user->id,
            'inviter_user_id'   => $inviter->id,
            'access_type'       => SharedFolderAccessType::View->value,
        ]);

        $response = $this->actingAs($user)
            ->postJson('/api/v1/inbox/shared-folders/accept', ['ids' => [$pending->id]]);

        $response->assertOk();
        $this->assertDatabaseHas('shared_folder_accesses', [
            'shared_folder_id' => $folder->id,
            'user_id'          => $user->id,
        ]);
        $this->assertDatabaseMissing('pending_received_shared_folders', ['id' => $pending->id]);
    }

    public function test_reject_shared_folder_removes_pending(): void
    {
        $user = User::factory()->create();
        $inviter = User::factory()->create();
        $folder = SharedFolder::factory()->create(['owner_id' => $inviter->id]);

        $pending = PendingReceivedSharedFolder::create([
            'shared_folder_id'  => $folder->id,
            'recipient_user_id' => $user->id,
            'inviter_user_id'   => $inviter->id,
            'access_type'       => SharedFolderAccessType::View->value,
        ]);

        $response = $this->actingAs($user)
            ->postJson('/api/v1/inbox/shared-folders/reject', ['ids' => [$pending->id]]);

        $response->assertOk();
        $this->assertDatabaseMissing('pending_received_shared_folders', ['id' => $pending->id]);
    }

    public function test_unauthenticated_user_cannot_access_inbox(): void
    {
        $response = $this->getJson('/api/v1/inbox/count');
        $response->assertUnauthorized();
    }
}
