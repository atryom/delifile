import { apiClient } from './client';
import type { ApiResponse, PaginatedData, SupportTicketListItem, SupportTicketDetail } from '@/types';

export const supportApi = {
  listTickets: (page = 1) =>
    apiClient.get<ApiResponse<PaginatedData<SupportTicketListItem>>>('/support/tickets', { params: { page } }),

  getTicket: (id: string) =>
    apiClient.get<ApiResponse<{ ticket: SupportTicketDetail }>>(`/support/tickets/${id}`),

  createTicket: (body: string) =>
    apiClient.post<ApiResponse<{ ticket: SupportTicketDetail }>>('/support/tickets', { body }),

  sendMessage: (ticketId: string, body: string) =>
    apiClient.post<ApiResponse<Record<string, unknown>>>(`/support/tickets/${ticketId}/messages`, { body }),

  markRead: (ticketId: string) =>
    apiClient.post<ApiResponse<Record<string, never>>>(`/support/tickets/${ticketId}/mark-read`),

  confirmTicket: (ticketId: string) =>
    apiClient.post<ApiResponse<Record<string, never>>>(`/support/tickets/${ticketId}/confirm`),
};
