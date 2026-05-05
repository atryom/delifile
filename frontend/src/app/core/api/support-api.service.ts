import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  PaginatedData,
  SupportTicketListItem,
  SupportTicketDetail,
  SupportMessageItem,
  SuggestionItem,
  SuggestionDetail,
} from '../../shared/models/api.models';

@Injectable({ providedIn: 'root' })
export class SupportApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1/support';
  private readonly adminBase = '/api/v1/admin';

  // ─── User: Tickets ────────────────────────────────────────────────────────

  getTickets(page = 1): Observable<ApiResponse<PaginatedData<SupportTicketListItem>>> {
    return this.http.get<ApiResponse<PaginatedData<SupportTicketListItem>>>(
      `${this.base}/tickets`, { params: { page } }
    );
  }

  getTicket(id: string): Observable<ApiResponse<{ ticket: SupportTicketDetail }>> {
    return this.http.get<ApiResponse<{ ticket: SupportTicketDetail }>>(`${this.base}/tickets/${id}`);
  }

  createTicket(body: string, attachments: File[]): Observable<ApiResponse<{ ticket: SupportTicketDetail }>> {
    const form = new FormData();
    form.append('body', body);
    attachments.forEach((f, i) => form.append(`attachments[${i}]`, f));
    return this.http.post<ApiResponse<{ ticket: SupportTicketDetail }>>(`${this.base}/tickets`, form);
  }

  sendMessage(ticketId: string, body: string, attachments: File[]): Observable<ApiResponse<{ message: SupportMessageItem }>> {
    const form = new FormData();
    form.append('body', body);
    attachments.forEach((f, i) => form.append(`attachments[${i}]`, f));
    return this.http.post<ApiResponse<{ message: SupportMessageItem }>>(`${this.base}/tickets/${ticketId}/messages`, form);
  }

  confirmTicket(ticketId: string): Observable<ApiResponse<{ status: string }>> {
    return this.http.post<ApiResponse<{ status: string }>>(`${this.base}/tickets/${ticketId}/confirm`, {});
  }

  markTicketRead(ticketId: string): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}/tickets/${ticketId}/mark-read`, {});
  }

  getAttachmentUrl(ticketId: string, attachmentId: string): Observable<ApiResponse<{ url: string; original_name: string }>> {
    return this.http.get<ApiResponse<{ url: string; original_name: string }>>(
      `${this.base}/tickets/${ticketId}/attachments/${attachmentId}`
    );
  }

  // ─── User: Suggestions ────────────────────────────────────────────────────

  getSuggestions(page = 1): Observable<ApiResponse<PaginatedData<SuggestionItem>>> {
    return this.http.get<ApiResponse<PaginatedData<SuggestionItem>>>(
      `${this.base}/suggestions`, { params: { page } }
    );
  }

  createSuggestion(body: string, attachments: File[]): Observable<ApiResponse<{ suggestion: SuggestionItem }>> {
    const form = new FormData();
    form.append('body', body);
    attachments.forEach((f, i) => form.append(`attachments[${i}]`, f));
    return this.http.post<ApiResponse<{ suggestion: SuggestionItem }>>(`${this.base}/suggestions`, form);
  }

  getSuggestionAttachmentUrl(suggestionId: string, attachmentId: string): Observable<ApiResponse<{ url: string; original_name: string }>> {
    return this.http.get<ApiResponse<{ url: string; original_name: string }>>(
      `${this.base}/suggestions/${suggestionId}/attachments/${attachmentId}`
    );
  }

  // ─── Admin: Tickets ───────────────────────────────────────────────────────

  adminGetTickets(page = 1, status?: string): Observable<ApiResponse<PaginatedData<SupportTicketListItem & { user: { id: number; email: string; name: string | null } | null }>>> {
    const params: Record<string, string | number> = { page };
    if (status) params['status'] = status;
    return this.http.get<any>(`${this.adminBase}/support/tickets`, { params });
  }

  adminGetTicket(id: string): Observable<ApiResponse<{ ticket: SupportTicketDetail }>> {
    return this.http.get<ApiResponse<{ ticket: SupportTicketDetail }>>(`${this.adminBase}/support/tickets/${id}`);
  }

  adminTakeTicket(id: string): Observable<ApiResponse<{ status: string }>> {
    return this.http.post<ApiResponse<{ status: string }>>(`${this.adminBase}/support/tickets/${id}/take`, {});
  }

  adminAwaitConfirmation(id: string): Observable<ApiResponse<{ status: string }>> {
    return this.http.post<ApiResponse<{ status: string }>>(`${this.adminBase}/support/tickets/${id}/await-confirmation`, {});
  }

  adminSendMessage(ticketId: string, body: string, attachments: File[]): Observable<ApiResponse<{ message: SupportMessageItem }>> {
    const form = new FormData();
    form.append('body', body);
    attachments.forEach((f, i) => form.append(`attachments[${i}]`, f));
    return this.http.post<ApiResponse<{ message: SupportMessageItem }>>(`${this.adminBase}/support/tickets/${ticketId}/messages`, form);
  }

  adminMarkTicketRead(ticketId: string): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.adminBase}/support/tickets/${ticketId}/mark-read`, {});
  }

  adminGetAttachmentUrl(ticketId: string, attachmentId: string): Observable<ApiResponse<{ url: string; original_name: string }>> {
    return this.http.get<ApiResponse<{ url: string; original_name: string }>>(
      `${this.adminBase}/support/tickets/${ticketId}/attachments/${attachmentId}`
    );
  }

  // ─── Admin: Suggestions ───────────────────────────────────────────────────

  adminGetSuggestions(page = 1, status?: string): Observable<ApiResponse<PaginatedData<SuggestionItem>>> {
    const params: Record<string, string | number> = { page };
    if (status) params['status'] = status;
    return this.http.get<ApiResponse<PaginatedData<SuggestionItem>>>(`${this.adminBase}/suggestions`, { params });
  }

  adminGetSuggestion(id: string): Observable<ApiResponse<{ suggestion: SuggestionDetail }>> {
    return this.http.get<ApiResponse<{ suggestion: SuggestionDetail }>>(`${this.adminBase}/suggestions/${id}`);
  }

  adminUpdateSuggestionStatus(id: string, status: string): Observable<ApiResponse<{ status: string }>> {
    return this.http.patch<ApiResponse<{ status: string }>>(`${this.adminBase}/suggestions/${id}/status`, { status });
  }

  adminAddSuggestionComment(id: string, body: string): Observable<ApiResponse<{ comment: { id: string; body: string; created_at: string | null } }>> {
    return this.http.post<any>(`${this.adminBase}/suggestions/${id}/comments`, { body });
  }

  adminGetSuggestionAttachmentUrl(suggestionId: string, attachmentId: string): Observable<ApiResponse<{ url: string; original_name: string }>> {
    return this.http.get<ApiResponse<{ url: string; original_name: string }>>(
      `${this.adminBase}/suggestions/${suggestionId}/attachments/${attachmentId}`
    );
  }
}
