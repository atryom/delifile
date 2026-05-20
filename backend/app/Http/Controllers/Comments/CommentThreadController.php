<?php

namespace App\Http\Controllers\Comments;

use App\Enums\CommentScope;
use App\Enums\CommentTargetType;
use App\Http\Controllers\Controller;
use App\Models\CommentThread;
use App\Services\CommentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CommentThreadController extends Controller
{
    public function __construct(
        private readonly CommentService $commentService,
    ) {}

    /**
     * GET /api/v1/comment-threads
     * Query: targetType, targetId, scope (shared|private|all), contextSharedFolderId
     */
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'targetType'            => 'required|in:file,shared_folder,local_folder',
            'targetId'              => 'required|string',
            'scope'                 => 'nullable|in:shared,private,all',
            'contextSharedFolderId' => 'nullable|string',
        ]);

        $user      = $request->user();
        $type      = CommentTargetType::from($data['targetType']);
        $targetId  = $data['targetId'];
        $scope     = $data['scope'] ?? 'all';
        $ctxFolder = $data['contextSharedFolderId'] ?? null;

        if (!$this->commentService->canAccessTarget($user, $type, $targetId, $ctxFolder)) {
            return $this->notFound('Target not found');
        }

        $policy = match ($type) {
            CommentTargetType::File         => $this->commentService->fileEffectivePolicy($user, $targetId, $ctxFolder),
            CommentTargetType::SharedFolder => $this->commentService->sharedFolderEffectivePolicy($user, $targetId),
            CommentTargetType::LocalFolder  => $this->commentService->localFolderEffectivePolicy($user, $targetId),
        };

        $result = ['policy' => $policy, 'threads' => []];

        if (in_array($scope, [CommentScope::Shared->value, 'all']) && $policy['shared_comments_allowed'] && $type !== CommentTargetType::LocalFolder) {
            $sharedThread = CommentThread::where('target_type', $type->value)
                ->where('target_id', $targetId)
                ->where('scope', CommentScope::Shared->value)
                ->first();

            $result['threads']['shared'] = $sharedThread ? [
                'id'             => $sharedThread->id,
                'comments_count' => $sharedThread->comments_count,
                'unread_count'   => $this->getUnreadCount($sharedThread, $user->id),
            ] : null;
        }

        if (in_array($scope, [CommentScope::Private->value, 'all'])) {
            $privateThread = CommentThread::where('target_type', $type->value)
                ->where('target_id', $targetId)
                ->where('scope', CommentScope::Private->value)
                ->where('owner_user_id', $user->id)
                ->first();

            $result['threads']['private'] = $privateThread ? [
                'id'             => $privateThread->id,
                'comments_count' => $privateThread->comments_count,
                'unread_count'   => 0,
            ] : null;
        }

        return $this->success('Threads loaded', $result);
    }

    /**
     * GET /api/v1/comment-threads/{threadId}
     * Load thread with paginated comments.
     */
    public function show(Request $request, string $threadId): JsonResponse
    {
        $thread = CommentThread::find($threadId);
        if (!$thread) {
            return $this->notFound('Thread not found');
        }

        $user = $request->user();
        $type = $thread->target_type;

        if (!$this->commentService->canAccessTarget($user, $type, $thread->target_id, $thread->context_shared_folder_id)) {
            return $this->forbidden();
        }

        // Private threads are only visible to their owner
        if ($thread->scope === CommentScope::Private && $thread->owner_user_id !== $user->id) {
            return $this->forbidden();
        }

        $page    = (int) $request->query('page', 1);
        $perPage = (int) $request->query('per_page', 30);

        return $this->success('Thread loaded', [
            'thread' => $this->commentService->formatThread($thread, $user->id, $page, $perPage),
        ]);
    }

    /**
     * POST /api/v1/comment-threads/{threadId}/read
     */
    public function markRead(Request $request, string $threadId): JsonResponse
    {
        $thread = CommentThread::find($threadId);
        if (!$thread) {
            return $this->notFound('Thread not found');
        }

        $user = $request->user();

        if ($thread->scope === CommentScope::Private && $thread->owner_user_id !== $user->id) {
            return $this->forbidden();
        }

        if (!$this->commentService->canAccessTarget($user, $thread->target_type, $thread->target_id, null)) {
            return $this->forbidden();
        }

        $this->commentService->markRead($thread, $user);

        return $this->success('Marked as read');
    }

    /**
     * GET /api/v1/comment-threads/unread-counters
     * Query: threadIds[] (batch)
     */
    public function unreadCounters(Request $request): JsonResponse
    {
        $data = $request->validate([
            'threadIds'   => 'required|array|max:100',
            'threadIds.*' => 'string',
        ]);

        $user    = $request->user();
        $counts  = $this->commentService->batchUnreadCounts($data['threadIds'], $user->id);

        return $this->success('Unread counters', ['counters' => $counts]);
    }

    private function getUnreadCount(CommentThread $thread, int $userId): int
    {
        $read = \App\Models\CommentRead::where('thread_id', $thread->id)
            ->where('user_id', $userId)
            ->first();

        return $read ? $read->unread_count_cache : $thread->comments_count;
    }
}
