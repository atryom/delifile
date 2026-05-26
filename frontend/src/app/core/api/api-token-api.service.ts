import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse, ApiToken } from '../../shared/models/api.models';

@Injectable({ providedIn: 'root' })
export class ApiTokenApiService {
  private readonly api = inject(ApiService);

  list(): Observable<ApiResponse<{ items: ApiToken[] }>> {
    return this.api.get('/api-tokens');
  }

  create(name: string): Observable<ApiResponse<{ token: string; item: ApiToken }>> {
    return this.api.post('/api-tokens', { name });
  }

  revoke(id: string): Observable<ApiResponse<Record<string, never>>> {
    return this.api.delete(`/api-tokens/${id}`);
  }
}
