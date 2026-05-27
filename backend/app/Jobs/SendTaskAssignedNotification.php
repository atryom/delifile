<?php

namespace App\Jobs;

use App\Models\File;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendTaskAssignedNotification implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public readonly int    $assigneeId,
        public readonly string $fileId,
        public readonly int    $assignerId,
        public readonly int    $expectedAssigneeId,
    ) {}

    public function handle(NotificationService $notifSvc): void
    {
        $file = File::find($this->fileId);

        // Guard: assignee may have been changed during the 30s delay
        if (!$file || $file->task_assigned_user_id !== $this->expectedAssigneeId) {
            return;
        }

        $assignee = User::find($this->assigneeId);
        $assigner = User::find($this->assignerId);

        if (!$assignee || !$assigner) {
            return;
        }

        if (!($assignee->notify_task_assigned ?? true)) {
            return;
        }

        $notifSvc->notifyTaskAssigned($assignee, $file, $assigner);
    }
}
