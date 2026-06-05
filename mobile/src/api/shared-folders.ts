import { apiClient } from './client';
import type { ApiResponse, PaginatedData, SharedFolder, SharedFolderLink, SharedFolderAccess, FileListItem, MovieMetadata } from '@/types';
import type { InitUploadPayload, InitUploadResult } from './files';

export const sharedFoldersApi = {
  list: () =>
    apiClient.get<ApiResponse<{ items: SharedFolder[] }>>('/shared-folders'),

  allFlat: () =>
    apiClient.get<ApiResponse<{ items: SharedFolder[] }>>('/shared-folders/all-flat'),

  ensureRoot: () =>
    apiClient.post<ApiResponse<{ folder: SharedFolder }>>('/shared-folders/ensure-root'),

  files: (folderId: string, page = 1) =>
    apiClient.get<ApiResponse<PaginatedData<FileListItem>>>(`/shared-folders/${folderId}/files`, {
      params: { page, per_page: 50 },
    }),

  subfolders: (folderId: string) =>
    apiClient.get<ApiResponse<{ items: SharedFolder[] }>>(`/shared-folders/${folderId}/subfolders`),

  createSubfolder: (parentId: string, name: string, folder_type?: 'default' | 'gallery' | 'movies') =>
    apiClient.post<ApiResponse<{ folder: SharedFolder }>>(`/shared-folders/${parentId}/subfolders`, {
      name,
      ...(folder_type && folder_type !== 'default' ? { folder_type } : {}),
    }),

  create: (name: string, parent_id?: string | null, folder_type?: 'default' | 'gallery' | 'movies') =>
    apiClient.post<ApiResponse<{ folder: SharedFolder }>>('/shared-folders', {
      name,
      parent_id: parent_id ?? null,
      ...(folder_type && folder_type !== 'default' ? { folder_type } : {}),
    }),

  update: (id: string, data: { name?: string; folder_type?: string }) =>
    apiClient.patch<ApiResponse<{ folder: SharedFolder }>>(`/shared-folders/${id}`, data),

  rename: (id: string, name: string) =>
    apiClient.patch<ApiResponse<{ folder: SharedFolder }>>(`/shared-folders/${id}`, { name }),

  delete: (id: string) =>
    apiClient.delete<ApiResponse<Record<string, never>>>(`/shared-folders/${id}`),

  leave: (id: string) =>
    apiClient.delete<ApiResponse<Record<string, never>>>(`/shared-folders/${id}/leave`),

  setFolderPrivacy: (id: string, isPrivate: boolean) =>
    apiClient.patch<ApiResponse<{ folder: SharedFolder }>>(`/shared-folders/${id}/privacy`, { is_private: isPrivate }),

  setFilePrivacy: (folderId: string, fileId: string, isPrivate: boolean) =>
    apiClient.patch<ApiResponse<Record<string, never>>>(`/shared-folders/${folderId}/files/${fileId}/privacy`, { is_private: isPrivate }),

  listLinks: (id: string) =>
    apiClient.get<ApiResponse<{ items: SharedFolderLink[] }>>(`/shared-folders/${id}/links`),

  createLink: (id: string, opts: { access_type: 'view' | 'edit'; allow_save: boolean; ttl_hours: number }) =>
    apiClient.post<ApiResponse<{ link: SharedFolderLink }>>(`/shared-folders/${id}/links`, opts),

  disableLink: (folderId: string, linkId: string) =>
    apiClient.post<ApiResponse<Record<string, never>>>(`/shared-folders/${folderId}/links/${linkId}/disable`),

  addFile: (folderId: string, fileId: string, move = false) =>
    apiClient.post<ApiResponse<Record<string, never>>>(`/shared-folders/${folderId}/files/${fileId}`, move ? { move: true } : {}),

  removeFile: (folderId: string, fileId: string) =>
    apiClient.delete<ApiResponse<Record<string, never>>>(`/shared-folders/${folderId}/files/${fileId}`),

  listAccesses: (folderId: string) =>
    apiClient.get<ApiResponse<{ items: SharedFolderAccess[] }>>(`/shared-folders/${folderId}/accesses`),

  addAccess: (folderId: string, contactId: string, accessType: 'view' | 'edit') =>
    apiClient.post<ApiResponse<{ access: SharedFolderAccess }>>(`/shared-folders/${folderId}/accesses`, {
      contact_id: contactId,
      access_type: accessType,
    }),

  removeAccess: (folderId: string, accessId: string) =>
    apiClient.delete<ApiResponse<Record<string, never>>>(`/shared-folders/${folderId}/accesses/${accessId}`),

  addToMyFiles: (fileId: string) =>
    apiClient.post<ApiResponse<Record<string, never>>>(`/files/${fileId}/add-to-my-files`),

  initUpload: (folderId: string, payload: InitUploadPayload) =>
    apiClient.post<ApiResponse<InitUploadResult>>(`/shared-folders/${folderId}/init-upload`, payload),

  completeUpload: (folderId: string, file_id: string) =>
    apiClient.post<ApiResponse<Record<string, never>>>(`/shared-folders/${folderId}/complete-upload`, { file_id }),

  addUrlFile: (folderId: string, url: string) =>
    apiClient.post<ApiResponse<Record<string, never>>>(`/shared-folders/${folderId}/url-file`, { url }),

  searchMovie: (folderId: string, input: string) =>
    apiClient.post<ApiResponse<{ results?: MovieMetadata[]; movie?: MovieMetadata; auto_confirm?: boolean }>>(
      `/shared-folders/${folderId}/movies/search`,
      { input }
    ),

  addMovie: (folderId: string, kinopoisk_id: number) =>
    apiClient.post<ApiResponse<{ file: { id: string; original_name: string; content_kind: string; custom_metadata: MovieMetadata } }>>(
      `/shared-folders/${folderId}/movies`,
      { kinopoisk_id }
    ),
};
