import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse, Tag } from '../../shared/models/api.models';

@Injectable({ providedIn: 'root' })
export class OrganizationApiService {
  private readonly api = inject(ApiService);

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

  attachTags(fileId: string, tagIds: string[]): Observable<ApiResponse<{ tags: Tag[] }>> {
    return this.api.post(`/files/${fileId}/attach-tags`, { tag_ids: tagIds });
  }

  detachTags(fileId: string, tagIds: string[]): Observable<ApiResponse<{ tags: Tag[] }>> {
    return this.api.post(`/files/${fileId}/detach-tags`, { tag_ids: tagIds });
  }
}
