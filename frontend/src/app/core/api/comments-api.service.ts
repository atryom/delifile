import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  ApiResponse,
  CommentItem,
  CommentThreadDetail,
  CommentThreadsResponse,
  CommentTargetType,
  CommentScope,
  FileCommentSettings,
  SharedFolderCommentSettings,
} from '../../shared/models/api.models';

@Injectable({ providedIn: 'root' })
export class CommentsApiService {
  private readonly api = inject(ApiService);

  getThreads(
    targetType: CommentTargetType,
    targetId: string,
    scope: 'shared' | 'private' | 'all' = 'all',
    contextSharedFolderId?: string | null,
  ): Observable<ApiResponse<CommentThreadsResponse>> {
    const params: Record<string, string> = { targetType, targetId, scope };
    if (contextSharedFolderId) params['contextSharedFolderId'] = contextSharedFolderId;
    return this.api.get('/comment-threads', params);
  }

  getThread(threadId: string, page = 1, perPage = 30): Observable<ApiResponse<{ thread: CommentThreadDetail }>> {
    return this.api.get(`/comment-threads/${threadId}`, { page, per_page: perPage });
  }

  markRead(threadId: string): Observable<ApiResponse<Record<string, never>>> {
    return this.api.post(`/comment-threads/${threadId}/read`);
  }

  unreadCounters(threadIds: string[]): Observable<ApiResponse<{ counters: Record<string, number> }>> {
    return this.api.post('/comment-threads/unread-counters', { threadIds });
  }

  createComment(body: {
    threadId: string;
    body: string;
    parentCommentId?: string | null;
    mentions?: number[];
    contextSharedFolderId?: string | null;
  }): Observable<ApiResponse<{ comment: CommentItem }>> {
    return this.api.post('/comments', body);
  }

  updateComment(id: string, body: string): Observable<ApiResponse<{ comment: CommentItem }>> {
    return this.api.patch(`/comments/${id}`, { body });
  }

  deleteComment(id: string): Observable<ApiResponse<Record<string, never>>> {
    return this.api.delete(`/comments/${id}`);
  }

  getFileCommentSettings(fileId: string): Observable<ApiResponse<{ settings: FileCommentSettings }>> {
    return this.api.get(`/files/${fileId}/comment-settings`);
  }

  updateFileCommentSettings(
    fileId: string,
    settings: Partial<{ sharedCommentsEnabled: boolean; sharedCommentsOverride: string; mentionsEnabled: boolean }>,
  ): Observable<ApiResponse<{ settings: FileCommentSettings }>> {
    return this.api.patch(`/files/${fileId}/comment-settings`, settings);
  }

  getSharedFolderCommentSettings(folderId: string): Observable<ApiResponse<{ settings: SharedFolderCommentSettings }>> {
    return this.api.get(`/shared-folders/${folderId}/comment-settings`);
  }

  updateSharedFolderCommentSettings(
    folderId: string,
    settings: Partial<{ sharedCommentsMode: string; mentionsEnabled: boolean }>,
  ): Observable<ApiResponse<{ settings: SharedFolderCommentSettings }>> {
    return this.api.patch(`/shared-folders/${folderId}/comment-settings`, settings);
  }
}
