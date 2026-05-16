import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  ApiResponse,
  Document,
  DocumentLock,
  DocumentSaveResult,
  ImageAssetsResponse,
} from '../../shared/models/api.models';

@Injectable({ providedIn: 'root' })
export class DocumentsApiService {
  private readonly api = inject(ApiService);

  create(fileName: string): Observable<ApiResponse<{ document: Document }>> {
    return this.api.post('/documents', { fileName });
  }

  get(id: string): Observable<ApiResponse<{ document: Document }>> {
    return this.api.get(`/documents/${id}`);
  }

  save(
    id: string,
    content: string,
    etag: string
  ): Observable<ApiResponse<DocumentSaveResult>> {
    return this.api.put(`/documents/${id}`, { content, etag });
  }

  acquireLock(id: string): Observable<ApiResponse<{ lock: DocumentLock }>> {
    return this.api.post(`/documents/${id}/lock`, {});
  }

  heartbeat(id: string): Observable<ApiResponse<Record<string, never>>> {
    return this.api.post(`/documents/${id}/lock/heartbeat`, {});
  }

  takeover(id: string): Observable<ApiResponse<{ lock: DocumentLock }>> {
    return this.api.post(`/documents/${id}/lock/takeover`, {});
  }

  releaseLock(id: string): Observable<ApiResponse<Record<string, never>>> {
    return this.api.delete(`/documents/${id}/lock`);
  }

  getImages(params?: {
    search?: string;
    cursor?: string;
    per_page?: number;
  }): Observable<ApiResponse<ImageAssetsResponse>> {
    const query: Record<string, string | number> = {};
    if (params?.search)   query['search']   = params.search;
    if (params?.cursor)   query['cursor']   = params.cursor;
    if (params?.per_page) query['per_page'] = params.per_page;
    return this.api.get('/assets/images', query);
  }

  updateAccess(
    fileId: string,
    accessId: string,
    canEdit: boolean
  ): Observable<ApiResponse<Record<string, never>>> {
    return this.api.patch(`/files/${fileId}/accesses/${accessId}`, { can_edit: canEdit });
  }
}
