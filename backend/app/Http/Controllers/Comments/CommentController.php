<?php

namespace App\Http\Controllers\Comments;

use App\Enums\CommentScope;
use App\Enums\CommentTargetType;
use App\Http\Controllers\Controller;
use App\Models\Comment;
use App\Models\CommentThread;
use App\Services\CommentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CommentController extends Controller
{
    public function __construct(
        private readonly CommentService $commentService,
    ) {}

    /**
     * POST /api/v1/comments
     *
     * Accepts either:
     *   - threadId (existing thread)
     *   - targetType + targetId + scope (auto-create thread on first comment)
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'threadId'              => 'nullable|string',
            'targetType'            => 'nullable|in:file,shared_folder,local_folder',
            'targetId'              => 'nullable|string',
            'scope'                 => 'nullable|in:shared,private',
            'body'                  => 'required|string|max:5000',
            'parentCommentId'       => 'nullable|string',
            'mentions'              => 'nullable|array',
            'mentions.*'            => 'integer',
            'contextSharedFolderId' => 'nullable|string',
        ]);

        if (empty($data['threadId']) && (empty($data['targetType']) || empty($data['targetId']))) {
            return $this->error('Необходимо указать threadId или targetType+targetId', 'VALIDATION_ERROR', [], 422);
        }

        $user = $request->user();

        // Resolve or create thread
        if (!empty($data['threadId'])) {
            $thread = CommentThread::find($data['threadId']);
            if (!$thread) {
                return $this->notFound('Thread not found');
            }
        } else {
            $type      = CommentTargetType::from($data['targetType']);
            $targetId  = $data['targetId'];
            $scope     = CommentScope::from($data['scope'] ?? 'shared');

            if (!$this->commentService->canAccessTarget($user, $type, $targetId, $data['contextSharedFolderId'] ?? null)) {
                return $this->forbidden();
            }

            if ($scope === CommentScope::Shared) {
                $thread = $this->commentService->getOrCreateSharedThread($type, $targetId, $user);
            } else {
                $thread = $this->commentService->getOrCreatePrivateThread($type, $targetId, $user);
            }
        }

        $type      = $thread->target_type;
        $ctxFolder = $data['contextSharedFolderId'] ?? $thread->context_shared_folder_id;

        // Access check
        if (!$this->commentService->canAccessTarget($user, $type, $thread->target_id, $ctxFolder)) {
            return $this->forbidden();
        }

        // Private thread owner check
        if ($thread->scope === CommentScope::Private && $thread->owner_user_id !== $user->id) {
            return $this->forbidden();
        }

        // Shared policy check
        if ($thread->scope === CommentScope::Shared) {
            $policy = match ($type) {
                CommentTargetType::File         => $this->commentService->fileEffectivePolicy($user, $thread->target_id, $ctxFolder),
                CommentTargetType::SharedFolder => $this->commentService->sharedFolderEffectivePolicy($user, $thread->target_id),
                CommentTargetType::LocalFolder  => ['shared_comments_allowed' => false, 'can_write_shared' => false],
            };

            if (!$policy['shared_comments_allowed']) {
                return $this->error('Общие комментарии для этого объекта отключены', 'SHARED_COMMENTS_DISABLED', [], 403);
            }
            if (!$policy['can_write_shared']) {
                return $this->forbidden('Недостаточно прав для комментирования');
            }
        }

        // Parent comment validation (one level only)
        if (!empty($data['parentCommentId'])) {
            $parent = Comment::where('id', $data['parentCommentId'])
                ->where('thread_id', $thread->id)
                ->whereNull('parent_comment_id')  // only reply to root
                ->whereNull('deleted_at')
                ->first();
            if (!$parent) {
                return $this->error('Нельзя ответить на этот комментарий', 'INVALID_PARENT', [], 422);
            }
        }

        return DB::transaction(function () use ($data, $thread, $user, $ctxFolder) {
            $bodyPlain = strip_tags($data['body']);
            $mentionsJson = !empty($data['mentions']) ? array_map('intval', $data['mentions']) : null;

            $comment = Comment::create([
                'thread_id'         => $thread->id,
                'parent_comment_id' => $data['parentCommentId'] ?? null,
                'author_user_id'    => $user->id,
                'body'              => $data['body'],
                'body_plain'        => $bodyPlain,
                'mentions_json'     => $mentionsJson,
            ]);

            // Update parent replies_count
            if ($comment->parent_comment_id) {
                Comment::where('id', $comment->parent_comment_id)->increment('replies_count');
            }

            // Update thread counters
            $thread->increment('comments_count');
            $thread->update(['last_comment_id' => $comment->id]);

            // Increment unread for others
            $this->commentService->incrementUnread($thread, $user->id);

            // Load author for response
            $comment->load('author');

            // Audit
            $this->commentService->auditComment($comment, $user, 'create', null, ['body' => $comment->body]);

            // Mentions & notifications
            $targetUrl = $this->buildDeepLinkUrl($thread, $ctxFolder);
            if ($mentionsJson) {
                $this->commentService->processMentions($comment, $mentionsJson, $targetUrl);
            }
            $this->commentService->notifyNewComment($comment, $thread, $targetUrl);

            return $this->success('Comment created', [
                'comment' => $this->commentService->formatComment($comment, $user->id),
            ], 201);
        });
    }

    /**
     * PATCH /api/v1/comments/{id}
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $comment = Comment::with('thread')->find($id);
        if (!$comment || $comment->isDeleted()) {
            return $this->notFound('Comment not found');
        }

        if ($comment->author_user_id !== $request->user()->id) {
            return $this->forbidden('Только автор может редактировать комментарий');
        }

        $data = $request->validate(['body' => 'required|string|max:5000']);

        $oldBody = $comment->body;
        $comment->update([
            'body'       => $data['body'],
            'body_plain' => strip_tags($data['body']),
            'edited_at'  => now(),
        ]);

        $this->commentService->auditComment(
            $comment,
            $request->user(),
            'edit',
            ['body' => $oldBody],
            ['body' => $data['body']],
        );

        $comment->load('author');

        return $this->success('Comment updated', [
            'comment' => $this->commentService->formatComment($comment, $request->user()->id),
        ]);
    }

    /**
     * DELETE /api/v1/comments/{id}
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $comment = Comment::with('thread')->find($id);
        if (!$comment || $comment->isDeleted()) {
            return $this->notFound('Comment not found');
        }

        if ($comment->author_user_id !== $request->user()->id) {
            return $this->forbidden('Только автор может удалить комментарий');
        }

        $comment->update(['deleted_at' => now()]);

        $this->commentService->auditComment($comment, $request->user(), 'delete', ['body' => $comment->body], null);

        return $this->success('Comment deleted');
    }

    private function buildDeepLinkUrl(CommentThread $thread, ?string $contextSharedFolderId): string
    {
        $base = rtrim(config('app.url'), '/');

        return match ($thread->target_type) {
            CommentTargetType::File => $contextSharedFolderId
                ? $base . '/files/' . $thread->target_id . '?from=shared-folder&folder_id=' . $contextSharedFolderId
                : $base . '/files/' . $thread->target_id,

            CommentTargetType::SharedFolder =>
                $base . '/folders?tab=shared&shared_folder_id=' . $thread->target_id,

            CommentTargetType::LocalFolder =>
                $base . '/folders',

            default => $base,
        };
    }
}
