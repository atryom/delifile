<?php

namespace App\Services;

use App\Enums\CommentScope;
use App\Enums\CommentTargetType;
use App\Enums\SharedCommentMode;
use App\Enums\SharedCommentOverride;
use App\Models\Comment;
use App\Models\CommentAuditLog;
use App\Models\CommentMention;
use App\Models\CommentRead;
use App\Models\CommentThread;
use App\Models\File;
use App\Models\FileCommentSettings;
use App\Models\Folder;
use App\Models\SharedFolder;
use App\Enums\SharedFolderAccessType;
use App\Models\SharedFolderAccess;
use App\Models\SharedFolderCommentSettings;
use App\Models\SharedFolderFile;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class CommentService
{
    public function __construct(
        private readonly PushNotificationService $pushService,
        private readonly NotificationService     $notificationService,
    ) {}

    // ─── Access checks ────────────────────────────────────────────────────────

    public function canAccessTarget(User $user, CommentTargetType $type, string $targetId, ?string $contextSharedFolderId): bool
    {
        return match ($type) {
            CommentTargetType::File         => $this->canAccessFile($user, $targetId),
            CommentTargetType::SharedFolder => $this->canAccessSharedFolder($user, $targetId),
            CommentTargetType::LocalFolder  => $this->canAccessLocalFolder($user, $targetId),
        };
    }

    public function isFileOwner(User $user, string $fileId): bool
    {
        $file = File::find($fileId);
        return $file && $file->owner_id === $user->id;
    }

    public function isSharedFolderOwner(User $user, string $folderId): bool
    {
        $folder = SharedFolder::find($folderId);
        return $folder && $folder->owner_id === $user->id;
    }

    /**
     * Compute effective shared-comment policy for a file.
     * Returns ['allowed' => bool, 'source' => string, 'can_write' => bool, ...]
     */
    public function fileEffectivePolicy(User $user, string $fileId, ?string $contextSharedFolderId): array
    {
        $file     = File::find($fileId);
        $settings = $file?->commentSettings ?? $this->defaultFileSettings($fileId);

        $allowed = false;
        $source  = 'file_setting';

        if ($contextSharedFolderId) {
            $folderSettings = SharedFolderCommentSettings::find($contextSharedFolderId)
                ?? $this->defaultFolderSettings($contextSharedFolderId);

            $override = $settings->shared_comments_override ?? SharedCommentOverride::Inherit;
            $mode     = $folderSettings->shared_comments_mode ?? SharedCommentMode::Enabled;

            if ($override === SharedCommentOverride::Enabled) {
                $allowed = true;
                $source  = 'file_override';
            } elseif ($override === SharedCommentOverride::Disabled) {
                $allowed = false;
                $source  = 'file_override';
            } else {
                // inherit
                $allowed = $mode !== SharedCommentMode::Disabled;
                $source  = 'shared_folder_mode';
            }
        } else {
            $allowed = $settings->shared_comments_enabled ?? true;
            $source  = 'file_setting';
        }

        $canWrite = $allowed && $this->userCanWriteSharedComment($user, CommentTargetType::File, $fileId, $contextSharedFolderId);

        return [
            'shared_comments_allowed'   => $allowed,
            'source'                    => $source,
            'shared_comments_mode'      => $contextSharedFolderId
                ? ($folderSettings->shared_comments_mode?->value ?? 'enabled')
                : null,
            'file_override'             => $settings->shared_comments_override?->value ?? 'inherit',
            'shared_comments_enabled'   => $settings->shared_comments_enabled ?? true,
            'can_write_shared'          => $canWrite,
            'can_write_private'         => true,
            'mentions_enabled'          => $settings->mentions_enabled ?? true,
        ];
    }

    public function sharedFolderEffectivePolicy(User $user, string $folderId): array
    {
        $settings = SharedFolderCommentSettings::find($folderId)
            ?? $this->defaultFolderSettings($folderId);

        $allowed  = $settings->shared_comments_mode !== SharedCommentMode::Disabled;
        $canWrite = $allowed && $this->userCanWriteSharedComment($user, CommentTargetType::SharedFolder, $folderId, null);

        return [
            'shared_comments_allowed' => $allowed,
            'shared_comments_mode'    => $settings->shared_comments_mode?->value ?? 'enabled',
            'can_write_shared'        => $canWrite,
            'can_write_private'       => true,
            'mentions_enabled'        => $settings->mentions_enabled ?? true,
        ];
    }

    public function localFolderEffectivePolicy(User $user, string $folderId): array
    {
        return [
            'shared_comments_allowed' => false,
            'can_write_shared'        => false,
            'can_write_private'       => true,
        ];
    }

    /** Check if user has write permission for shared comments on a given target. */
    public function userCanWriteSharedComment(User $user, CommentTargetType $type, string $targetId, ?string $contextSharedFolderId): bool
    {
        return match ($type) {
            CommentTargetType::File         => $this->fileUserCanWriteShared($user, $targetId, $contextSharedFolderId),
            CommentTargetType::SharedFolder => $this->sfUserCanWriteShared($user, $targetId),
            CommentTargetType::LocalFolder  => false,
        };
    }

    // ─── Thread management ────────────────────────────────────────────────────

    public function getOrCreateSharedThread(CommentTargetType $type, string $targetId, User $user): CommentThread
    {
        return CommentThread::firstOrCreate(
            [
                'target_type'    => $type->value,
                'target_id'      => $targetId,
                'scope'          => CommentScope::Shared->value,
                'owner_user_id'  => null,
            ],
            ['created_by' => $user->id]
        );
    }

    public function getOrCreatePrivateThread(CommentTargetType $type, string $targetId, User $user): CommentThread
    {
        return CommentThread::firstOrCreate(
            [
                'target_type'    => $type->value,
                'target_id'      => $targetId,
                'scope'          => CommentScope::Private->value,
                'owner_user_id'  => $user->id,
            ],
            ['created_by' => $user->id]
        );
    }

    // ─── Comment formatting ───────────────────────────────────────────────────

    public function formatComment(Comment $comment, int $currentUserId): array
    {
        return [
            'id'                => $comment->id,
            'thread_id'         => $comment->thread_id,
            'parent_comment_id' => $comment->parent_comment_id,
            'author'            => [
                'id'   => $comment->author?->id,
                'name' => $comment->author?->name ?? $comment->author?->email ?? '—',
            ],
            'body'              => $comment->isDeleted() ? null : $comment->body,
            'is_deleted'        => $comment->isDeleted(),
            'replies_count'     => $comment->replies_count,
            'edited_at'         => $comment->edited_at?->toIso8601String(),
            'created_at'        => $comment->created_at?->toIso8601String(),
            'can_edit'          => !$comment->isDeleted() && $comment->author_user_id === $currentUserId,
            'can_delete'        => !$comment->isDeleted() && $comment->author_user_id === $currentUserId,
            'replies'           => [],
        ];
    }

    public function formatThread(CommentThread $thread, int $currentUserId, int $page = 1, int $perPage = 30): array
    {
        $query = $thread->comments()
            ->with('author')
            ->whereNull('parent_comment_id')
            ->orderBy('created_at')
            ->paginate($perPage, ['*'], 'page', $page);

        $rootIds    = $query->pluck('id')->all();
        $repliesMap = [];
        if ($rootIds) {
            $replies = Comment::with('author')
                ->whereIn('parent_comment_id', $rootIds)
                ->whereNull('deleted_at')
                ->orderBy('created_at')
                ->get();
            foreach ($replies as $reply) {
                $repliesMap[$reply->parent_comment_id][] = $this->formatComment($reply, $currentUserId);
            }
        }

        $items = $query->map(function (Comment $c) use ($currentUserId, $repliesMap) {
            $item            = $this->formatComment($c, $currentUserId);
            $item['replies'] = $repliesMap[$c->id] ?? [];
            return $item;
        })->all();

        $read = CommentRead::where('thread_id', $thread->id)->where('user_id', $currentUserId)->first();

        return [
            'id'             => $thread->id,
            'scope'          => $thread->scope?->value,
            'comments_count' => $thread->comments_count,
            'unread_count'   => $read?->unread_count_cache ?? $thread->comments_count,
            'items'          => $items,
            'pagination'     => [
                'page'     => $query->currentPage(),
                'per_page' => $query->perPage(),
                'total'    => $query->total(),
            ],
        ];
    }

    // ─── Unread handling ──────────────────────────────────────────────────────

    public function markRead(CommentThread $thread, User $user): void
    {
        $lastComment = $thread->allComments()->latest()->first();
        CommentRead::updateOrCreate(
            ['thread_id' => $thread->id, 'user_id' => $user->id],
            [
                'last_read_comment_id' => $lastComment?->id,
                'last_read_at'         => now(),
                'unread_count_cache'   => 0,
            ]
        );
    }

    /** Increment unread for all watchers of a thread except the author. */
    public function incrementUnread(CommentThread $thread, int $authorId): void
    {
        CommentRead::where('thread_id', $thread->id)
            ->where('user_id', '!=', $authorId)
            ->increment('unread_count_cache');
    }

    /** Batch unread counters for a list of thread IDs, keyed by thread_id. */
    public function batchUnreadCounts(array $threadIds, int $userId): array
    {
        if (empty($threadIds)) return [];

        return CommentRead::whereIn('thread_id', $threadIds)
            ->where('user_id', $userId)
            ->pluck('unread_count_cache', 'thread_id')
            ->all();
    }

    // ─── Audit ────────────────────────────────────────────────────────────────

    public function auditComment(Comment $comment, User $actor, string $action, ?array $old = null, ?array $new = null): void
    {
        CommentAuditLog::create([
            'comment_id'     => $comment->id,
            'actor_user_id'  => $actor->id,
            'action'         => $action,
            'old_value_json' => $old,
            'new_value_json' => $new,
            'created_at'     => now(),
        ]);
    }

    public function auditSettings(User $actor, string $action, ?array $old, ?array $new): void
    {
        CommentAuditLog::create([
            'comment_id'     => null,
            'actor_user_id'  => $actor->id,
            'action'         => $action,
            'old_value_json' => $old,
            'new_value_json' => $new,
            'created_at'     => now(),
        ]);
    }

    // ─── Mentions ─────────────────────────────────────────────────────────────

    /**
     * Save mention records and send push notifications.
     * @param array $mentionedUserIds list of user IDs extracted from mentions_json
     */
    public function processMentions(Comment $comment, array $mentionedUserIds, string $targetUrl): void
    {
        if (empty($mentionedUserIds)) {
            return;
        }

        // Filter out users who don't have access to the thread target
        $thread = $comment->thread;
        if ($thread) {
            $ctxFolder = $thread->context_shared_folder_id;
            $mentionedUserIds = array_values(array_filter($mentionedUserIds, function ($uid) use ($thread, $ctxFolder) {
                $mentionedUser = User::find($uid);
                return $mentionedUser && $this->canAccessTarget($mentionedUser, $thread->target_type, $thread->target_id, $ctxFolder);
            }));
            if (empty($mentionedUserIds)) {
                return;
            }
        }

        $author = $comment->author;
        $users  = User::whereIn('id', $mentionedUserIds)->get()->keyBy('id');
        $now    = now();

        CommentMention::insert(array_map(fn ($uid) => [
            'id'                => \Illuminate\Support\Str::ulid(),
            'comment_id'        => $comment->id,
            'mentioned_user_id' => $uid,
            'created_at'        => $now,
            'updated_at'        => $now,
        ], $mentionedUserIds));

        $delivered = [];
        foreach ($mentionedUserIds as $uid) {
            $mentioned = $users[$uid] ?? null;
            if (!$mentioned) continue;
            if (!($mentioned->notify_mentions ?? true)) continue;

            $this->pushService->sendToUser(
                $mentioned,
                'Вас упомянули в комментарии',
                ($author?->name ?? 'Пользователь') . ' упомянул вас в обсуждении',
                $targetUrl,
            );
            $delivered[] = $uid;
        }

        if (!empty($delivered)) {
            CommentMention::where('comment_id', $comment->id)
                ->whereIn('mentioned_user_id', $delivered)
                ->update(['delivered_at' => $now]);
        }
    }

    /**
     * Notify all members of a shared folder when a new shared note is posted.
     * Called instead of notifyNewComment for SharedFolder+Shared scope threads.
     */
    public function notifySharedFolderNote(Comment $comment, CommentThread $thread, string $targetUrl): void
    {
        $folder = SharedFolder::find($thread->target_id);
        if (!$folder) {
            return;
        }

        $memberIds = array_unique(array_merge(
            [$folder->owner_id],
            SharedFolderAccess::where('shared_folder_id', $folder->id)
                ->whereNotNull('user_id')
                ->pluck('user_id')
                ->toArray()
        ));

        $author    = $comment->author;
        $adderName = $author?->name ?? $author?->email ?? 'Пользователь';

        foreach ($memberIds as $memberId) {
            if ($memberId === $comment->author_user_id) continue;
            $member = User::find($memberId);
            if (!$member) continue;

            $this->notificationService->notifySharedFolderContentAdded(
                $member, $adderName, $folder->name, $folder->id, 'note',
            );
            if ($member->notifications_enabled ?? true) {
                $this->pushService->sendToUser(
                    $member,
                    'Новая заметка в общей папке',
                    "{$adderName} добавил заметку в папку «{$folder->name}»",
                    $targetUrl,
                );
            }
        }
    }

    /**
     * Notify thread participants (except author) about a new comment.
     */
    public function notifyNewComment(Comment $comment, CommentThread $thread, string $targetUrl): void
    {
        $author = $comment->author;
        $title  = 'Новый комментарий';
        $body   = ($author?->name ?? 'Пользователь') . ' оставил комментарий';

        // Notify users who previously commented in the thread (except author)
        $participantIds = Comment::where('thread_id', $thread->id)
            ->where('author_user_id', '!=', $comment->author_user_id)
            ->whereNull('deleted_at')
            ->distinct()
            ->pluck('author_user_id')
            ->all();

        $users = User::whereIn('id', $participantIds)->get()->keyBy('id');
        foreach ($participantIds as $uid) {
            $user = $users[$uid] ?? null;
            if ($user && ($user->notify_comments ?? true)) {
                $this->pushService->sendToUser($user, $title, $body, $targetUrl);
            }
        }
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private function canAccessFile(User $user, string $fileId): bool
    {
        $file = File::find($fileId);
        if (!$file) return false;
        if ($file->owner_id === $user->id) return true;
        if ($file->accesses()->where('user_id', $user->id)->exists()) return true;

        $sharedFolderIds = SharedFolderFile::where('file_id', $fileId)->pluck('shared_folder_id');
        if ($sharedFolderIds->isEmpty()) return false;

        if (SharedFolder::whereIn('id', $sharedFolderIds)->where('owner_id', $user->id)->exists()) {
            return true;
        }

        return SharedFolderAccess::whereIn('shared_folder_id', $sharedFolderIds)
            ->where('user_id', $user->id)
            ->exists();
    }

    private function canAccessSharedFolder(User $user, string $folderId): bool
    {
        $folder = SharedFolder::with(['parent.parent.parent.parent'])->find($folderId);
        if (!$folder) return false;

        $ancestorIds = [];
        $current     = $folder;
        $visited     = [];
        while ($current) {
            if (isset($visited[$current->id])) break;
            $visited[$current->id] = true;
            if ($current->owner_id === $user->id) return true;
            $ancestorIds[] = $current->id;
            $current = $current->parent;
        }

        return !empty($ancestorIds) && SharedFolderAccess::where('user_id', $user->id)
            ->whereIn('shared_folder_id', $ancestorIds)
            ->exists();
    }

    private function canAccessLocalFolder(User $user, string $folderId): bool
    {
        $folder = Folder::find($folderId);
        return $folder && $folder->user_id === $user->id;
    }

    private function fileUserCanWriteShared(User $user, string $fileId, ?string $contextSharedFolderId): bool
    {
        $file = File::find($fileId);
        if (!$file) return false;
        if ($file->owner_id === $user->id) return true;

        // In explicit shared folder context: check shared folder role
        if ($contextSharedFolderId) {
            if (SharedFolder::where('id', $contextSharedFolderId)->where('owner_id', $user->id)->exists()) {
                return true;
            }
            return SharedFolderAccess::where('shared_folder_id', $contextSharedFolderId)
                ->where('user_id', $user->id)
                ->exists();
        }

        // Direct file access
        $access = $file->accesses()->where('user_id', $user->id)->first();
        if ($access) {
            return $access->can_comment ?? true;
        }

        // Fallback: access via any shared folder containing this file
        $sharedFolderIds = SharedFolderFile::where('file_id', $fileId)->pluck('shared_folder_id');
        if ($sharedFolderIds->isNotEmpty()) {
            if (SharedFolder::whereIn('id', $sharedFolderIds)->where('owner_id', $user->id)->exists()) {
                return true;
            }
            return SharedFolderAccess::whereIn('shared_folder_id', $sharedFolderIds)
                ->where('user_id', $user->id)
                ->exists();
        }

        return false;
    }

    private function sfUserCanWriteShared(User $user, string $folderId): bool
    {
        $folder = SharedFolder::find($folderId);
        if (!$folder) return false;
        if ($folder->owner_id === $user->id) return true;
        return SharedFolderAccess::where('shared_folder_id', $folderId)
            ->where('user_id', $user->id)
            ->exists();
    }

    private function defaultFileSettings(string $fileId): object
    {
        return (object)[
            'shared_comments_enabled'  => true,
            'shared_comments_override' => SharedCommentOverride::Inherit,
            'private_comments_enabled' => true,
            'mentions_enabled'         => true,
        ];
    }

    private function defaultFolderSettings(string $folderId): object
    {
        return (object)[
            'shared_comments_mode'     => SharedCommentMode::Enabled,
            'private_comments_enabled' => true,
            'mentions_enabled'         => true,
        ];
    }
}
