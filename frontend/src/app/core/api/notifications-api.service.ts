import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse, AppNotification, NotificationGroup, NotificationsPage } from '../../shared/models/api.models';

@Injectable({ providedIn: 'root' })
export class NotificationsApiService {
  private readonly api = inject(ApiService);

  getNotifications(group?: NotificationGroup, page = 1): Observable<ApiResponse<NotificationsPage>> {
    const params: Record<string, string | number> = { page };
    if (group) params['group'] = group;
    return this.api.get('/notifications', params);
  }

  getCount(): Observable<ApiResponse<{ unread: number }>> {
    return this.api.get('/notifications/count');
  }

  markRead(id: string): Observable<ApiResponse> {
    return this.api.post(`/notifications/${id}/read`, {});
  }

  markAllRead(): Observable<ApiResponse> {
    return this.api.post('/notifications/read-all', {});
  }
}
