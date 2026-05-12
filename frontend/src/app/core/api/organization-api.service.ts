import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse, Folder, FolderTreeNode, Tag } from '../../shared/models/api.models';

@Injectable({ providedIn: 'root' })
export class OrganizationApiService {
  private readonly api = inject(ApiService);

  // ── Folders ───────────────────────────────────────────────────────────────

  getFolderTree(): Observable<ApiResponse<{ items: FolderTreeNode[] }>> {
    return this.api.get('/folders/tree');
  }

  getFolders(): Observable<ApiResponse<{ items: Folder[] }>> {
    return this.api.get('/folders');
  }

  createFolder(data: { name: string; parent_id?: string | null; sort_order?: number }): Observable<ApiResponse<{ folder: Folder }>> {
    return this.api.post('/folders', data);
  }

  updateFolder(id: string, data: { name?: string; parent_id?: string | null; sort_order?: number }): Observable<ApiResponse<{ folder: Folder }>> {
    return this.api.patch(`/folders/${id}`, data);
  }

  deleteFolder(id: string, force = false): Observable<ApiResponse<Record<string, never>>> {
    return this.api.delete(`/folders/${id}${force ? '?force=1' : ''}`);
  }

  // ── Tags ──────────────────────────────────────────────────────────────────

  getTags(search?: string): Observable<ApiResponse<{ items: Tag[] }>> {
    const params: Record<string, string> = {};
    if (search) params['search'] = search;
    return this.api.get('/tags', params);
  }

  createTag(name: string): Observable<ApiResponse<{ tag: Tag }>> {
    return this.api.post('/tags', { name });
  }

  updateTag(id: string, name: string): Observable<ApiResponse<{ tag: Tag }>> {
    return this.api.patch(`/tags/${id}`, { name });
  }

  deleteTag(id: string): Observable<ApiResponse<Record<string, never>>> {
    return this.api.delete(`/tags/${id}`);
  }

  // ── File tag/folder actions ───────────────────────────────────────────────

  attachTags(fileId: string, tagIds: string[]): Observable<ApiResponse<{ tags: Tag[] }>> {
    return this.api.post(`/files/${fileId}/attach-tags`, { tag_ids: tagIds });
  }

  detachTags(fileId: string, tagIds: string[]): Observable<ApiResponse<{ tags: Tag[] }>> {
    return this.api.post(`/files/${fileId}/detach-tags`, { tag_ids: tagIds });
  }

  clearFolder(fileId: string): Observable<ApiResponse<Record<string, never>>> {
    return this.api.post(`/files/${fileId}/clear-folder`);
  }
}
