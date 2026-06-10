import { apiClient } from './client';
import type { ApiResponse } from '@/types';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  action_url: string | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationCount {
  unread: number;
}

export const notificationsApi = {
  list: (page = 1) =>
    apiClient.get<ApiResponse<{ items: AppNotification[]; pagination: { page: number; per_page: number; total: number } }>>(
      `/notifications?page=${page}`
    ),

  count: () =>
    apiClient.get<ApiResponse<NotificationCount>>('/notifications/count'),

  markRead: (id: string) =>
    apiClient.post<ApiResponse<Record<string, never>>>(`/notifications/${id}/read`, {}),

  markAllRead: () =>
    apiClient.post<ApiResponse<Record<string, never>>>('/notifications/read-all', {}),
};
