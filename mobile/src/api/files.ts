import { apiClient } from './client';
import type { ApiResponse, PaginatedData, FileListItem, FileCard, FileListParams } from '@/types';

export const filesApi = {
  list: (params: FileListParams) =>
    apiClient.get<ApiResponse<PaginatedData<FileListItem>>>('/files', { params }),

  get: (id: string) =>
    apiClient.get<ApiResponse<{ file: FileCard }>>(`/files/${id}`),

  download: (id: string) =>
    apiClient.post<ApiResponse<{ url: string; expires_in: number }>>(`/files/${id}/download`),

  favorite: (id: string) =>
    apiClient.post<ApiResponse<Record<string, never>>>(`/files/${id}/favorite`),

  unfavorite: (id: string) =>
    apiClient.post<ApiResponse<Record<string, never>>>(`/files/${id}/unfavorite`),

  pin: (id: string) =>
    apiClient.post<ApiResponse<Record<string, never>>>(`/files/${id}/pin`),

  unpin: (id: string) =>
    apiClient.post<ApiResponse<Record<string, never>>>(`/files/${id}/unpin`),
};
