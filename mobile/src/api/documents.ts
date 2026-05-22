import { apiClient } from './client';
import type { ApiResponse } from '@/types';
import type { MarkdownDocument } from '@/types/document';

export interface SaveDocumentResult {
  id: string;
  etag: string;
  updatedAt: string;
  updatedBy: { id: number; name: string | null; email: string } | null;
}

export const documentsApi = {
  get: (id: string) =>
    apiClient.get<ApiResponse<{ document: MarkdownDocument }>>(`/documents/${id}`),

  update: (id: string, content: string, etag: string) =>
    apiClient.put<ApiResponse<SaveDocumentResult>>(`/documents/${id}`, { content, etag }),

  acquireLock: (id: string) =>
    apiClient.post<ApiResponse<{ lock: { expiresAt: string } }>>(`/documents/${id}/lock`),

  heartbeat: (id: string) =>
    apiClient.post(`/documents/${id}/lock/heartbeat`),

  releaseLock: (id: string) =>
    apiClient.delete(`/documents/${id}/lock`),

  takeoverLock: (id: string) =>
    apiClient.post<ApiResponse<{ lock: { expiresAt: string } }>>(`/documents/${id}/lock/takeover`),

  create: (fileName: string) =>
    apiClient.post<ApiResponse<{ document: MarkdownDocument }>>('/documents', { fileName }),
};
