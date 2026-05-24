<?php

namespace Tests\Feature\Notifications;

use App\Enums\NotificationType;
use App\Models\User;
use App\Models\UserNotification;
use Tests\TestCase;

class NotificationTest extends TestCase
{
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
    }

    public function test_authenticated_user_can_get_notifications(): void
    {
        UserNotification::create([
            'user_id' => $this->user->id,
            'type'    => NotificationType::FileShared->value,
            'title'   => 'File shared with you',
        ]);

        $response = $this->actingAs($this->user)
            ->getJson('/api/v1/notifications');

        $response->assertOk()
            ->assertJsonStructure([
                'result',
                'data' => ['items', 'total', 'page', 'last_page'],
            ])
            ->assertJsonPath('data.total', 1);
    }

    public function test_user_only_sees_own_notifications(): void
    {
        $other = User::factory()->create();
        UserNotification::create([
            'user_id' => $other->id,
            'type'    => NotificationType::AdminMessage->value,
            'title'   => 'Not yours',
        ]);

        $response = $this->actingAs($this->user)
            ->getJson('/api/v1/notifications');

        $response->assertOk()
            ->assertJsonPath('data.total', 0);
    }

    public function test_user_can_filter_notifications_by_group(): void
    {
        UserNotification::create([
            'user_id' => $this->user->id,
            'type'    => NotificationType::FileShared->value,
            'title'   => 'Access notification',
        ]);
        UserNotification::create([
            'user_id' => $this->user->id,
            'type'    => NotificationType::ContactRequest->value,
            'title'   => 'Contact notification',
        ]);

        $response = $this->actingAs($this->user)
            ->getJson('/api/v1/notifications?group=access');

        $response->assertOk()
            ->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.items.0.group', 'access');
    }

    public function test_user_can_get_unread_count(): void
    {
        UserNotification::create([
            'user_id' => $this->user->id,
            'type'    => NotificationType::FileShared->value,
            'title'   => 'Unread',
        ]);
        UserNotification::create([
            'user_id' => $this->user->id,
            'type'    => NotificationType::FolderShared->value,
            'title'   => 'Already read',
            'read_at' => now(),
        ]);

        $response = $this->actingAs($this->user)
            ->getJson('/api/v1/notifications/count');

        $response->assertOk()
            ->assertJsonPath('data.unread', 1);
    }

    public function test_user_can_mark_notification_as_read(): void
    {
        $notification = UserNotification::create([
            'user_id' => $this->user->id,
            'type'    => NotificationType::FileShared->value,
            'title'   => 'Unread',
        ]);

        $response = $this->actingAs($this->user)
            ->postJson("/api/v1/notifications/{$notification->id}/read");

        $response->assertOk()
            ->assertJson(['result' => 'success']);

        $this->assertNotNull($notification->fresh()->read_at);
    }

    public function test_user_cannot_mark_another_users_notification_as_read(): void
    {
        $other        = User::factory()->create();
        $notification = UserNotification::create([
            'user_id' => $other->id,
            'type'    => NotificationType::FileShared->value,
            'title'   => 'Not yours',
        ]);

        $response = $this->actingAs($this->user)
            ->postJson("/api/v1/notifications/{$notification->id}/read");

        $response->assertNotFound();
    }

    public function test_user_can_mark_all_notifications_as_read(): void
    {
        UserNotification::create([
            'user_id' => $this->user->id,
            'type'    => NotificationType::FileShared->value,
            'title'   => 'First',
        ]);
        UserNotification::create([
            'user_id' => $this->user->id,
            'type'    => NotificationType::ContactRequest->value,
            'title'   => 'Second',
        ]);

        $this->actingAs($this->user)
            ->postJson('/api/v1/notifications/read-all')
            ->assertOk();

        $unread = UserNotification::where('user_id', $this->user->id)
            ->whereNull('read_at')
            ->count();
        $this->assertSame(0, $unread);
    }

    public function test_unauthenticated_user_cannot_access_notifications(): void
    {
        $this->getJson('/api/v1/notifications')->assertUnauthorized();
        $this->getJson('/api/v1/notifications/count')->assertUnauthorized();
        $this->postJson('/api/v1/notifications/read-all')->assertUnauthorized();
    }
}
