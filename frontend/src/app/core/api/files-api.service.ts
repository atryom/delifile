import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../api/api.service';
import {
  ApiResponse,
  FileListItem,
  FileCard,
  FileAccess,
  ShareLink,
  ActivityLog,
  InitUploadRequest,
  InitUploadResponse,
  CompleteUploadResponse,
  PaginatedData,
} from '../../shared/models/api.models';

export type FileFilter = 'mine' | 'received' | 'favorites';

@Injectable({ providedIn: 'root' })
export class FilesApiService {
  private readonly api = inject(ApiService);

  list(filter: FileFilter = 'mine', page = 1, search?: string): Observable<ApiResponse<PaginatedData<FileListItem>>> {
    const params: Record<string, string | number> = { filter, page };
    if (search) params['search'] = search;
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

  completeUpload(fileId: string): Observable<ApiResponse<CompleteUploadResponse>> {
    return this.api.post('/files/complete-upload', { file_id: fileId });
  }

  cancelUpload(fileId: string): Observable<ApiResponse<Record<string, never>>> {
    return this.api.post(`/files/${fileId}/cancel-upload`);
  }

  download(id: string): Observable<ApiResponse<{ url: string; expires_in: number }>> {
    return this.api.post(`/files/${id}/download`);
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

  shareToContact(fileId: string, contactId: string): Observable<ApiResponse<{ share: { contact_id: string; status: string } }>> {
    return this.api.post(`/files/${fileId}/share-to-contact`, { contact_id: contactId });
  }

  revokeContactAccess(fileId: string, contactId: string): Observable<ApiResponse<Record<string, never>>> {
    return this.api.delete(`/files/${fileId}/share-to-contact/${contactId}`);
  }

  createLink(fileId: string, ttlHours = 12): Observable<ApiResponse<{ link: ShareLink }>> {
    return this.api.post(`/files/${fileId}/create-link`, { ttl_hours: ttlHours });
  }

  listLinks(fileId: string): Observable<ApiResponse<{ items: ShareLink[] }>> {
    return this.api.get(`/files/${fileId}/links`);
  }

  disableLink(linkId: string): Observable<ApiResponse<Record<string, never>>> {
    return this.api.post(`/links/${linkId}/disable`);
  }

  resolveLink(token: string): Observable<ApiResponse<{ file: FileListItem; link: { expires_at: string } }>> {
    return this.api.post(`/links/${token}/resolve`);
  }

  downloadViaLink(token: string): Observable<ApiResponse<{ url: string; expires_in: number }>> {
    return this.api.post(`/links/${token}/download`);
  }
}
