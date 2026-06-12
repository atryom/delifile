import { apiClient } from './client';
import type { ApiResponse, FileRequestItem } from '@/types';

export const fileRequestsApi = {
  create: (description: string, ttlHours: number, folderId?: string | null) =>
    apiClient.post<ApiResponse<{ request: FileRequestItem }>>('/file-requests', {
      description,
      ttl_hours: ttlHours,
      ...(folderId ? { folder_id: folderId } : {}),
    }),

  list: () =>
    apiClient.get<ApiResponse<{ items: FileRequestItem[] }>>('/file-requests'),

  accept: (id: string) =>
    apiClient.post<ApiResponse<{ file_id: string }>>(`/file-requests/${id}/accept`),

  reject: (id: string) =>
    apiClient.post<ApiResponse<Record<string, never>>>(`/file-requests/${id}/reject`),

  cancel: (id: string) =>
    apiClient.post<ApiResponse<Record<string, never>>>(`/file-requests/${id}/cancel`),
};
