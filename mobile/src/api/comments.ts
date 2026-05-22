import { apiClient } from './client';
import type { ApiResponse } from '@/types';
import type {
  CommentThread, CommentThreadsResult, CommentTargetType, CommentScope, Comment,
} from '@/types/comment';

export const commentsApi = {
  getThreads: (
    targetType: CommentTargetType,
    targetId: string,
    contextSharedFolderId?: string,
  ) =>
    apiClient.get<ApiResponse<CommentThreadsResult>>('/comment-threads', {
      params: { targetType, targetId, scope: 'all', contextSharedFolderId },
    }),

  getThread: (threadId: string, page = 1, perPage = 50) =>
    apiClient.get<ApiResponse<{ thread: CommentThread }>>(`/comment-threads/${threadId}`, {
      params: { page, per_page: perPage },
    }),

  markRead: (threadId: string) =>
    apiClient.post(`/comment-threads/${threadId}/read`),

  addComment: (data: {
    threadId?: string;
    targetType?: CommentTargetType;
    targetId?: string;
    scope?: CommentScope;
    body: string;
    parentCommentId?: string;
    contextSharedFolderId?: string;
  }) => apiClient.post<ApiResponse<{ comment: Comment }>>('/comments', {
    threadId: data.threadId,
    targetType: data.targetType,
    targetId: data.targetId,
    scope: data.scope,
    body: data.body,
    parentCommentId: data.parentCommentId,
    contextSharedFolderId: data.contextSharedFolderId,
  }),

  editComment: (id: string, body: string) =>
    apiClient.patch<ApiResponse<{ comment: Comment }>>(`/comments/${id}`, { body }),

  deleteComment: (id: string) =>
    apiClient.delete(`/comments/${id}`),
};
