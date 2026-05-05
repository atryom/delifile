import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse, CurrentUser, UserSettings, ContactRequestItem } from '../../shared/models/api.models';

@Injectable({ providedIn: 'root' })
export class UserSettingsApiService {
  private readonly api = inject(ApiService);

  updateSettings(settings: UserSettings): Observable<ApiResponse<{ user: CurrentUser }>> {
    return this.api.patch('/user/settings', settings);
  }

  getContactRequests(): Observable<ApiResponse<{ items: ContactRequestItem[] }>> {
    return this.api.get('/contact-requests');
  }

  acceptContactRequest(id: string): Observable<ApiResponse> {
    return this.api.post(`/contact-requests/${id}/accept`);
  }

  rejectContactRequest(id: string): Observable<ApiResponse> {
    return this.api.post(`/contact-requests/${id}/reject`);
  }
}
