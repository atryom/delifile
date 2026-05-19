import { apiClient } from './client';
import type { ApiResponse, Tag } from '@/types';

export const tagsApi = {
  list: (search?: string) =>
    apiClient.get<ApiResponse<{ items: Tag[] }>>('/tags', { params: search ? { search } : undefined }),

  create: (name: string) =>
    apiClient.post<ApiResponse<{ tag: Tag }>>('/tags', { name }),

  update: (id: string, name: string) =>
    apiClient.patch<ApiResponse<{ tag: Tag }>>(`/tags/${id}`, { name }),

  remove: (id: string) =>
    apiClient.delete<ApiResponse<Record<string, never>>>(`/tags/${id}`),
};
