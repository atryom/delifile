import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEventType, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  ApiResponse,
  FileRequestItem,
  FileRequestResolve,
  FileRequestInitUpload,
  InitUploadResponse,
} from '../../shared/models/api.models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FileRequestsApiService {
  private readonly api  = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  create(description: string, ttlHours: number, folderId?: string | null, allowMultiple?: boolean): Observable<ApiResponse<{ request: FileRequestItem }>> {
    const body: Record<string, unknown> = { description, ttl_hours: ttlHours };
    if (folderId) body['folder_id'] = folderId;
    if (allowMultiple) body['allow_multiple'] = true;
    return this.api.post('/file-requests', body);
  }

  list(): Observable<ApiResponse<{ items: FileRequestItem[] }>> {
    return this.api.get('/file-requests');
  }

  cancel(id: string): Observable<ApiResponse> {
    return this.api.post(`/file-requests/${id}/cancel`);
  }

  accept(id: string): Observable<ApiResponse<{ file_id: string }>> {
    return this.api.post(`/file-requests/${id}/accept`);
  }

  reject(id: string): Observable<ApiResponse> {
    return this.api.post(`/file-requests/${id}/reject`);
  }

  acceptFile(requestId: string, fileId: string): Observable<ApiResponse<{ file_id: string }>> {
    return this.api.post(`/file-requests/${requestId}/files/${fileId}/accept`);
  }

  rejectFile(requestId: string, fileId: string): Observable<ApiResponse> {
    return this.api.post(`/file-requests/${requestId}/files/${fileId}/reject`);
  }

  resolve(token: string): Observable<ApiResponse<FileRequestResolve>> {
    return this.api.get(`/file-requests/${token}/resolve`);
  }

  initUpload(token: string, payload: FileRequestInitUpload): Observable<ApiResponse<InitUploadResponse>> {
    return this.http.post<ApiResponse<InitUploadResponse>>(
      `${this.base}/file-requests/${token}/init-upload`,
      payload,
    );
  }

  completeUpload(token: string, fileId: string | null, thumbnailKey?: string): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      `${this.base}/file-requests/${token}/complete-upload`,
      { file_id: fileId ?? null, thumbnail_key: thumbnailKey ?? null },
    );
  }

  putToS3(url: string, file: File, headers: Record<string, string>): Observable<HttpEvent<unknown>> {
    return this.http.put(url, file, {
      headers,
      reportProgress: true,
      observe: 'events',
      withCredentials: false,
    }) as Observable<HttpEvent<unknown>>;
  }
}
