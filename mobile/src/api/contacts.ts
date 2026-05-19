import { apiClient } from './client';
import type { ApiResponse, Contact, ContactRequest } from '@/types';

export const contactsApi = {
  list: (search?: string) =>
    apiClient.get<ApiResponse<{ items: Contact[] }>>('/contacts', { params: search ? { search } : undefined }),

  create: (email: string) =>
    apiClient.post<ApiResponse<{ contact: Contact; invitation_sent: boolean }>>('/contacts', { email }),

  remove: (id: string) =>
    apiClient.delete<ApiResponse<Record<string, never>>>(`/contacts/${id}`),

  listRequests: () =>
    apiClient.get<ApiResponse<{ items: ContactRequest[] }>>('/contact-requests'),

  acceptRequest: (id: string) =>
    apiClient.post<ApiResponse<Record<string, never>>>(`/contact-requests/${id}/accept`),

  rejectRequest: (id: string) =>
    apiClient.post<ApiResponse<Record<string, never>>>(`/contact-requests/${id}/reject`),
};
