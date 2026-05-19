import { apiClient } from './client';
import type { ApiResponse, FolderTreeNode, Folder } from '@/types';

export const foldersApi = {
  tree: () =>
    apiClient.get<ApiResponse<{ items: FolderTreeNode[] }>>('/folders/tree'),

  list: () =>
    apiClient.get<ApiResponse<{ items: Folder[] }>>('/folders'),

  create: (name: string, parent_id?: string | null) =>
    apiClient.post<ApiResponse<{ folder: Folder }>>('/folders', { name, parent_id: parent_id ?? null }),
};
