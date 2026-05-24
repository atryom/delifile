import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse, NotificationGroup, NotificationsPage } from '../../shared/models/api.models';

@Injectable({ providedIn: 'root' })
export class NotificationsApiService {
  private readonly api = inject(ApiService);

  /** Shared unread count — used by layout badge AND communication tab badge. */
  readonly unreadCount = signal(0);

  refreshCount(): void {
    this.getCount().subscribe({
      next: res => this.unreadCount.set(res.data.unread),
      error: () => { /* ignore */ },
    });
  }

  /** Optimistic decrement when a single notification is marked read. */
  decrementCount(): void {
    this.unreadCount.update(n => Math.max(0, n - 1));
  }

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
