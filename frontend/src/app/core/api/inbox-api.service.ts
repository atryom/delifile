import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse, InboxFile, InboxSharedFolder, InboxCount } from '../../shared/models/api.models';

@Injectable({ providedIn: 'root' })
export class InboxApiService {
  private readonly api = inject(ApiService);

  getCount(): Observable<ApiResponse<InboxCount>> {
    return this.api.get('/inbox/count');
  }

  getFiles(): Observable<ApiResponse<{ items: InboxFile[] }>> {
    return this.api.get('/inbox/files');
  }

  acceptFiles(ids: string[]): Observable<ApiResponse> {
    return this.api.post('/inbox/files/accept', { ids });
  }

  rejectFiles(ids: string[]): Observable<ApiResponse> {
    return this.api.post('/inbox/files/reject', { ids });
  }

  getSharedFolders(): Observable<ApiResponse<{ items: InboxSharedFolder[] }>> {
    return this.api.get('/inbox/shared-folders');
  }

  acceptSharedFolders(ids: string[]): Observable<ApiResponse> {
    return this.api.post('/inbox/shared-folders/accept', { ids });
  }

  rejectSharedFolders(ids: string[]): Observable<ApiResponse> {
    return this.api.post('/inbox/shared-folders/reject', { ids });
  }
}
