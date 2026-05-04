<?php

namespace App\Services;

use App\Enums\ActivityType;
use App\Models\ActivityLog;
use App\Models\File;
use App\Models\User;

class ActivityService
{
    /**
     * Log an activity event.
     */
    public function log(File $file, User $user, ActivityType $type, array $meta = []): ActivityLog
    {
        return ActivityLog::create([
            'file_id'    => $file->id,
            'user_id'    => $user->id,
            'action'     => $type,
            'meta'       => $meta,
            'created_at' => now(),
        ]);
    }

    /**
     * Get activity logs for a specific file.
     * Pass $userId to scope to that user's events only (for non-owners).
     */
    public function getForFile(File $file, int $limit = 50, ?int $userId = null): array
    {
        $query = ActivityLog::where('file_id', $file->id);
        if ($userId !== null) {
            $query->where('user_id', $userId);
        }

        return $query
            ->with('user:id,phone,name')
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get()
            ->map(fn ($log) => [
                'id'         => $log->id,
                'action'     => $log->action->value,
                'label'      => $log->action->label(),
                'user'       => $log->user ? [
                    'id'    => $log->user->id,
                    'phone' => $log->user->phone,
                    'name'  => $log->user->name,
                ] : null,
                'meta'       => $log->meta,
                'created_at' => $log->created_at?->toIso8601String(),
            ])
            ->toArray();
    }

    /**
     * Get global activity feed for a user.
     */
    public function getForUser(User $user, int $page = 1, int $perPage = 30): array
    {
        $query = ActivityLog::whereHas('file', fn ($q) =>
            $q->where('owner_id', $user->id)->orWhereHas('accesses',
                fn ($aq) => $aq->where('user_id', $user->id)
            )
        );

        $total = $query->count();
        $items = $query->with(['file:id,original_name', 'user:id,phone,name'])
            ->orderByDesc('created_at')
            ->offset(($page - 1) * $perPage)
            ->limit($perPage)
            ->get()
            ->map(fn ($log) => [
                'id'     => $log->id,
                'action' => $log->action->value,
                'label'  => $log->action->label(),
                'file'   => $log->file ? [
                    'id'   => $log->file->id,
                    'name' => $log->file->original_name,
                ] : null,
                'user'   => $log->user ? [
                    'id'    => $log->user->id,
                    'phone' => $log->user->phone,
                    'name'  => $log->user->name,
                ] : null,
                'meta'       => $log->meta,
                'created_at' => $log->created_at?->toIso8601String(),
            ]);

        return [
            'items'      => $items,
            'pagination' => [
                'page'     => $page,
                'per_page' => $perPage,
                'total'    => $total,
            ],
        ];
    }
}
