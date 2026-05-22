import { apiClient } from './client';
import type { ApiResponse, PaginatedData, SharedFolder, FileListItem } from '@/types';
import type { InitUploadPayload, InitUploadResult } from './files';

export const sharedFoldersApi = {
  list: () =>
    apiClient.get<ApiResponse<{ items: SharedFolder[] }>>('/shared-folders'),

  files: (folderId: string, page = 1) =>
    apiClient.get<ApiResponse<PaginatedData<FileListItem>>>(`/shared-folders/${folderId}/files`, {
      params: { page, per_page: 50 },
    }),

  subfolders: (folderId: string) =>
    apiClient.get<ApiResponse<{ items: SharedFolder[] }>>(`/shared-folders/${folderId}/subfolders`),

  createSubfolder: (parentId: string, name: string) =>
    apiClient.post<ApiResponse<{ folder: SharedFolder }>>(`/shared-folders/${parentId}/subfolders`, { name }),

  create: (name: string, parent_id?: string | null) =>
    apiClient.post<ApiResponse<{ folder: SharedFolder }>>('/shared-folders', {
      name,
      parent_id: parent_id ?? null,
    }),

  rename: (id: string, name: string) =>
    apiClient.patch<ApiResponse<{ folder: SharedFolder }>>(`/shared-folders/${id}`, { name }),

  delete: (id: string) =>
    apiClient.delete(`/shared-folders/${id}`),

  leave: (id: string) =>
    apiClient.delete(`/shared-folders/${id}/leave`),

  initUpload: (folderId: string, payload: InitUploadPayload) =>
    apiClient.post<ApiResponse<InitUploadResult>>(`/shared-folders/${folderId}/init-upload`, payload),

  completeUpload: (folderId: string, file_id: string) =>
    apiClient.post(`/shared-folders/${folderId}/complete-upload`, { file_id }),

  addUrlFile: (folderId: string, url: string) =>
    apiClient.post(`/shared-folders/${folderId}/url-file`, { url }),
};
