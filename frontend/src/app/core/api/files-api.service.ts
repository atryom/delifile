import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../api/api.service';
import {
  ApiResponse,
  FileListItem,
  FileCard,
  FileVersion,
  FileAccess,
  ShareLink,
  ActivityLog,
  InitUploadRequest,
  InitUploadResponse,
  CompleteUploadResponse,
  PaginatedData,
  TaskStatus,
} from '../../shared/models/api.models';

export interface VersionInitResponse {
  version: { id: string; status: string };
  upload: { method: string; url: string; headers: Record<string, string> };
  thumbnail?: { key: string; method: string; url: string; headers: Record<string, string> };
}

export type FileFilter = 'all' | 'mine' | 'received' | 'favorites';

@Injectable({ providedIn: 'root' })
export class FilesApiService {
  private readonly api = inject(ApiService);

  list(
    filter: FileFilter = 'mine',
    page = 1,
    search?: string,
    options?: {
      tag_id?: string;
      folder_id?: string | null;
      content_kind?: string;
      file_type_group?: string;
      sort_by?: string;
      sort_order?: string;
      per_page?: number;
      is_task?: boolean;
      task_status?: string;
      task_date_from?: string;
      task_date_to?: string;
    }
  ): Observable<ApiResponse<PaginatedData<FileListItem>>> {
    const params: Record<string, string | number> = { filter, page };
    if (search)                           params['search']         = search;
    if (options?.tag_id)                  params['tag_id']         = options.tag_id;
    if (options?.folder_id !== undefined) params['folder_id']      = options.folder_id ?? '';
    if (options?.content_kind)            params['content_kind']   = options.content_kind;
    if (options?.file_type_group)         params['file_type_group'] = options.file_type_group;
    if (options?.sort_by)                 params['sort_by']        = options.sort_by;
    if (options?.sort_order)              params['sort_order']     = options.sort_order;
    if (options?.per_page)                params['per_page']       = options.per_page;
    if (options?.is_task !== undefined)   params['is_task']        = options.is_task ? 1 : 0;
    if (options?.task_status)             params['task_status']    = options.task_status;
    if (options?.task_date_from)          params['task_date_from'] = options.task_date_from;
    if (options?.task_date_to)            params['task_date_to']   = options.task_date_to;
    return this.api.get('/files', params);
  }

  get(id: string): Observable<ApiResponse<{ file: FileCard }>> {
    return this.api.get(`/files/${id}`);
  }

  delete(id: string): Observable<ApiResponse<Record<string, never>>> {
    return this.api.delete(`/files/${id}`);
  }

  initUpload(data: InitUploadRequest): Observable<ApiResponse<InitUploadResponse>> {
    return this.api.post('/files/init-upload', data);
  }

  completeUpload(fileId: string, thumbnailKey?: string): Observable<ApiResponse<CompleteUploadResponse>> {
    const body: Record<string, unknown> = { file_id: fileId };
    if (thumbnailKey) body['thumbnail_key'] = thumbnailKey;
    return this.api.post('/files/complete-upload', body);
  }

  updateDescription(id: string, description: string | null): Observable<ApiResponse<{ description: string | null }>> {
    return this.api.patch(`/files/${id}/description`, { description });
  }

  cancelUpload(fileId: string): Observable<ApiResponse<Record<string, never>>> {
    return this.api.post(`/files/${fileId}/cancel-upload`);
  }

  download(id: string): Observable<ApiResponse<{ url: string; expires_in: number }>> {
    return this.api.post(`/files/${id}/download`);
  }

  /** Read-only text content for simple formats (.txt, .log, .csv, …). */
  getTextContent(id: string): Observable<ApiResponse<{ content: string }>> {
    return this.api.get(`/files/${id}/text-content`);
  }

  pin(id: string): Observable<ApiResponse<Record<string, never>>> {
    return this.api.post(`/files/${id}/pin`);
  }

  unpin(id: string): Observable<ApiResponse<Record<string, never>>> {
    return this.api.post(`/files/${id}/unpin`);
  }

  favorite(id: string): Observable<ApiResponse<Record<string, never>>> {
    return this.api.post(`/files/${id}/favorite`);
  }

  unfavorite(id: string): Observable<ApiResponse<Record<string, never>>> {
    return this.api.post(`/files/${id}/unfavorite`);
  }

  likeFile(id: string): Observable<ApiResponse<{ likes_count: number; is_liked: boolean }>> {
    return this.api.post(`/files/${id}/like`);
  }

  unlikeFile(id: string): Observable<ApiResponse<{ likes_count: number; is_liked: boolean }>> {
    return this.api.delete(`/files/${id}/like`);
  }

  moveFolder(id: string, folderId: string | null): Observable<ApiResponse<Record<string, never>>> {
    return this.api.post(`/files/${id}/move-folder`, { folder_id: folderId });
  }

  setTags(id: string, tagIds: string[]): Observable<ApiResponse<Record<string, never>>> {
    return this.api.post(`/files/${id}/set-tags`, { tag_ids: tagIds });
  }

  activity(id: string): Observable<ApiResponse<{ items: ActivityLog[] }>> {
    return this.api.get(`/files/${id}/activity`);
  }

  accesses(id: string): Observable<ApiResponse<{ items: FileAccess[] }>> {
    return this.api.get(`/files/${id}/accesses`);
  }

  // ─── Sharing ──────────────────────────────────────────────────────────────

  shareToContact(fileId: string, contactId: string, canEdit?: boolean): Observable<ApiResponse<{ share: { contact_id: string; status: string } }>> {
    const body: Record<string, unknown> = { contact_id: contactId };
    if (canEdit !== undefined) body['can_edit'] = canEdit;
    return this.api.post(`/files/${fileId}/share-to-contact`, body);
  }

  updateAccess(fileId: string, accessId: string, canEdit: boolean): Observable<ApiResponse<{ access: FileAccess }>> {
    return this.api.patch(`/files/${fileId}/accesses/${accessId}`, { can_edit: canEdit });
  }

  revokeContactAccess(fileId: string, contactId: string): Observable<ApiResponse<Record<string, never>>> {
    return this.api.delete(`/files/${fileId}/share-to-contact/${contactId}`);
  }

  createLink(fileId: string, ttlHours = 12, allowSave = false): Observable<ApiResponse<{ link: ShareLink }>> {
    return this.api.post(`/files/${fileId}/create-link`, { ttl_hours: ttlHours, allow_save: allowSave });
  }

  listLinks(fileId: string): Observable<ApiResponse<{ items: ShareLink[] }>> {
    return this.api.get(`/files/${fileId}/links`);
  }

  disableLink(linkId: string): Observable<ApiResponse<Record<string, never>>> {
    return this.api.post(`/links/${linkId}/disable`);
  }

  resolveLink(token: string): Observable<ApiResponse<{ file: FileListItem; link: { expires_at: string; allow_save: boolean } }>> {
    return this.api.post(`/links/${token}/resolve`);
  }

  downloadViaLink(token: string): Observable<ApiResponse<{ url: string; expires_in: number }>> {
    return this.api.post(`/links/${token}/download`);
  }

  saveViaLink(token: string): Observable<ApiResponse<{ file_id: string }>> {
    return this.api.post(`/links/${token}/save`);
  }

  // ─── Versioning ──────────────────────────────────────────────────────────────

  initVersionUpload(fileId: string, data: InitUploadRequest): Observable<ApiResponse<VersionInitResponse>> {
    return this.api.post(`/files/${fileId}/versions/init-upload`, data);
  }

  completeVersionUpload(fileId: string, versionId: string, thumbnailKey?: string): Observable<ApiResponse<{ version: { id: string; version_number: number }; file: { id: string; has_versions: boolean } }>> {
    const body: Record<string, unknown> = { version_id: versionId };
    if (thumbnailKey) body['thumbnail_key'] = thumbnailKey;
    return this.api.post(`/files/${fileId}/versions/complete-upload`, body);
  }

  updateVersion(fileId: string, versionId: string, patch: { version_label?: string | null; comment?: string | null; is_active?: boolean; version_number?: number }): Observable<ApiResponse<{ version: FileVersion }>> {
    return this.api.patch(`/files/${fileId}/versions/${versionId}`, patch);
  }

  downloadVersion(fileId: string, versionId: string): Observable<ApiResponse<{ url: string; expires_in: number }>> {
    return this.api.post(`/files/${fileId}/versions/${versionId}/download`);
  }

  updateDisplayName(fileId: string, displayName: string | null): Observable<ApiResponse<{ display_name: string | null }>> {
    return this.api.patch(`/files/${fileId}/display-name`, { display_name: displayName });
  }

  rename(fileId: string, displayName: string | null): Observable<ApiResponse<{ display_name: string | null; original_name: string }>> {
    return this.api.patch(`/files/${fileId}/rename`, { display_name: displayName });
  }

  // ─── Task management ─────────────────────────────────────────────────────────

  updateTask(fileId: string, data: {
    is_task?: boolean;
    task_status?: TaskStatus | null;
    task_start_date?: string | null;
    task_due_date?: string | null;
    task_assigned_user_id?: number | null;
  }): Observable<ApiResponse<{ file: FileCard }>> {
    return this.api.patch(`/files/${fileId}/task`, data);
  }
}
