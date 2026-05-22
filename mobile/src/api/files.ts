import { apiClient } from './client';
import type { ApiResponse, PaginatedData, FileListItem, FileCard, FileListParams } from '@/types';

export interface InitUploadPayload {
  original_name: string;
  size: number;
  mime_type: string;
  checksum?: string;
}

export interface InitUploadResult {
  file: { id: string; status: string };
  upload: { method: string; url: string; headers: Record<string, string> };
}

export interface InitVersionUploadResult {
  version: { id: string; status: string };
  upload: { method: string; url: string; headers: Record<string, string> };
}

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

  initUpload: (payload: InitUploadPayload) =>
    apiClient.post<ApiResponse<InitUploadResult>>('/files/init-upload', payload),

  completeUpload: (file_id: string) =>
    apiClient.post<ApiResponse<{ file: FileCard }>>('/files/complete-upload', { file_id }),

  cancelUpload: (file_id: string) =>
    apiClient.post(`/files/${file_id}/cancel-upload`),

  moveFolder: (file_id: string, folder_id: string | null) =>
    apiClient.post(`/files/${file_id}/move-folder`, { folder_id }),

  createUrlFile: (url: string) =>
    apiClient.post<ApiResponse<{ file: FileCard }>>('/url-files', { url }),

  delete: (id: string) =>
    apiClient.delete(`/files/${id}`),

  initVersionUpload: (fileId: string, payload: InitUploadPayload) =>
    apiClient.post<ApiResponse<InitVersionUploadResult>>(`/files/${fileId}/versions/init-upload`, payload),

  completeVersionUpload: (fileId: string, version_id: string) =>
    apiClient.post(`/files/${fileId}/versions/complete-upload`, { version_id }),

  downloadVersion: (fileId: string, versionId: string) =>
    apiClient.post<ApiResponse<{ url: string; expires_in: number }>>(`/files/${fileId}/versions/${versionId}/download`),

  activateVersion: (fileId: string, versionId: string) =>
    apiClient.patch(`/files/${fileId}/versions/${versionId}`, { is_active: true }),

  setTags: (id: string, tag_ids: string[]) =>
    apiClient.post(`/files/${id}/set-tags`, { tag_ids }),

  shareToContact: (id: string, contact_id: string, can_edit = false) =>
    apiClient.post(`/files/${id}/share-to-contact`, { contact_id, can_edit }),

  createLink: (id: string, opts: { ttl_hours?: number; allow_save?: boolean }) =>
    apiClient.post<ApiResponse<{ link: { id: string; url: string; allow_save: boolean; expires_at: string | null } }>>(
      `/files/${id}/create-link`,
      opts,
    ),
};
