import { apiClient } from './client';
import type { ApiResponse, PaginatedData, FileListItem, FileCard, FileListParams, FileAccess, ShareLink, TaskStatus } from '@/types';

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
    apiClient.post<ApiResponse<Record<string, never>>>(`/files/${file_id}/cancel-upload`),

  createUrlFile: (url: string) =>
    apiClient.post<ApiResponse<{ file: FileCard }>>('/url-files', { url }),

  rename: (id: string, display_name: string) =>
    apiClient.patch<ApiResponse<{ display_name: string | null; original_name: string }>>(`/files/${id}/rename`, { display_name }),

  delete: (id: string) =>
    apiClient.delete<ApiResponse<Record<string, never>>>(`/files/${id}`),

  initVersionUpload: (fileId: string, payload: InitUploadPayload) =>
    apiClient.post<ApiResponse<InitVersionUploadResult>>(`/files/${fileId}/versions/init-upload`, payload),

  completeVersionUpload: (fileId: string, version_id: string) =>
    apiClient.post<ApiResponse<Record<string, never>>>(`/files/${fileId}/versions/complete-upload`, { version_id }),

  downloadVersion: (fileId: string, versionId: string) =>
    apiClient.post<ApiResponse<{ url: string; expires_in: number }>>(`/files/${fileId}/versions/${versionId}/download`),

  activateVersion: (fileId: string, versionId: string) =>
    apiClient.patch<ApiResponse<Record<string, never>>>(`/files/${fileId}/versions/${versionId}`, { is_active: true }),

  setTags: (id: string, tag_ids: string[]) =>
    apiClient.post<ApiResponse<Record<string, never>>>(`/files/${id}/set-tags`, { tag_ids }),

  shareToContact: (id: string, contact_id: string, can_edit = false) =>
    apiClient.post<ApiResponse<Record<string, never>>>(`/files/${id}/share-to-contact`, { contact_id, can_edit }),

  createLink: (id: string, opts: { ttl_hours?: number; allow_save?: boolean }) =>
    apiClient.post<ApiResponse<{ link: ShareLink }>>(
      `/files/${id}/create-link`,
      opts,
    ),

  listLinks: (id: string) =>
    apiClient.get<ApiResponse<{ items: ShareLink[] }>>(`/files/${id}/links`),

  disableLink: (linkId: string) =>
    apiClient.post<ApiResponse<Record<string, never>>>(`/links/${linkId}/disable`),

  listAccesses: (id: string) =>
    apiClient.get<ApiResponse<{ items: FileAccess[] }>>(`/files/${id}/accesses`),

  revokeAccess: (fileId: string, contactId: string) =>
    apiClient.delete<ApiResponse<Record<string, never>>>(`/files/${fileId}/share-to-contact/${contactId}`),

  updateAccess: (fileId: string, accessId: string, canEdit: boolean) =>
    apiClient.patch<ApiResponse<Record<string, never>>>(`/files/${fileId}/accesses/${accessId}`, { can_edit: canEdit }),

  updateTask: (id: string, data: {
    is_task?: boolean;
    task_status?: TaskStatus | null;
    task_start_date?: string | null;
    task_due_date?: string | null;
    task_assigned_user_id?: number | null;
  }) =>
    apiClient.patch<ApiResponse<{ file: FileCard }>>(`/files/${id}/task`, data),

  like: (id: string) =>
    apiClient.post<ApiResponse<Record<string, never>>>(`/files/${id}/like`),

  unlike: (id: string) =>
    apiClient.delete<ApiResponse<Record<string, never>>>(`/files/${id}/like`),

  updateMovieMeta: (id: string, data: { watched?: boolean | null; personal_rating?: number | null }) =>
    apiClient.patch<ApiResponse<{ custom_metadata: Record<string, unknown> }>>(`/files/${id}/movie-meta`, data),
};
