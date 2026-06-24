import { apiClient } from './client';
import type { ApiResponse, Contact, ContactRequest } from '@/types';

export const contactsApi = {
  list: (search?: string) =>
    apiClient.get<ApiResponse<{ items: Contact[] }>>('/contacts', { params: search ? { search } : undefined }),

  create: (params: { email: string; name: string }) =>
    apiClient.post<ApiResponse<{ contact: Contact; invitation_sent: boolean }>>('/contacts', params),

  update: (id: string, name: string) =>
    apiClient.patch<ApiResponse<{ contact: Contact }>>(`/contacts/${id}`, { name }),

  remove: (id: string) =>
    apiClient.delete<ApiResponse<Record<string, never>>>(`/contacts/${id}`),

  reorder: (ids: string[]) =>
    apiClient.post<ApiResponse<Record<string, never>>>('/contacts/reorder', { ids }),

  listRequests: () =>
    apiClient.get<ApiResponse<{ items: ContactRequest[] }>>('/contact-requests'),

  acceptRequest: (id: string) =>
    apiClient.post<ApiResponse<Record<string, never>>>(`/contact-requests/${id}/accept`),

  rejectRequest: (id: string) =>
    apiClient.post<ApiResponse<Record<string, never>>>(`/contact-requests/${id}/reject`),
};
