import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse, FileCard, LinkPreview } from '../../shared/models/api.models';

@Injectable({ providedIn: 'root' })
export class UrlFilesApiService {
  private readonly api = inject(ApiService);

  preview(url: string): Observable<ApiResponse<{ preview: LinkPreview }>> {
    return this.api.post('/links-preview', { url });
  }

  create(url: string): Observable<ApiResponse<{ file: FileCard }>> {
    return this.api.post('/url-files', { url });
  }
}
