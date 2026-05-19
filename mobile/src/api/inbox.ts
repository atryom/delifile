import { apiClient } from './client';
import type { ApiResponse, InboxCount, InboxFile, InboxSharedFolder } from '@/types';

export const inboxApi = {
  count: () =>
    apiClient.get<ApiResponse<InboxCount>>('/inbox/count'),

  files: () =>
    apiClient.get<ApiResponse<{ items: InboxFile[] }>>('/inbox/files'),

  acceptFiles: (ids: string[]) =>
    apiClient.post<ApiResponse<Record<string, never>>>('/inbox/files/accept', { ids }),

  rejectFiles: (ids: string[]) =>
    apiClient.post<ApiResponse<Record<string, never>>>('/inbox/files/reject', { ids }),

  sharedFolders: () =>
    apiClient.get<ApiResponse<{ items: InboxSharedFolder[] }>>('/inbox/shared-folders'),

  acceptSharedFolders: (ids: string[]) =>
    apiClient.post<ApiResponse<Record<string, never>>>('/inbox/shared-folders/accept', { ids }),

  rejectSharedFolders: (ids: string[]) =>
    apiClient.post<ApiResponse<Record<string, never>>>('/inbox/shared-folders/reject', { ids }),
};
