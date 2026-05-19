import { apiClient } from './client';
import type { ApiResponse } from '@/types';

export interface LinkMeta {
  token: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  content_kind: string;
  expires_at: string | null;
  owner_name: string | null;
  preview_url: string | null;
}

export const linksApi = {
  resolve: (token: string) =>
    apiClient.post<ApiResponse<LinkMeta>>(`/links/${token}/resolve`),

  download: (token: string) =>
    apiClient.post<ApiResponse<{ url: string }>>(`/links/${token}/download`),
};
