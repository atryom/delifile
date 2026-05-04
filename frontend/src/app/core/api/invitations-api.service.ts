import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse, Invitation } from '../../shared/models/api.models';

export interface SendInvitationRequest {
  email: string;
  file_id?: string;
  comment?: string;
}

export interface InvitationInfo {
  invitation: Invitation;
  sender: { name: string; email: string };
  target_email: string;
  user_exists: boolean;
}

@Injectable({ providedIn: 'root' })
export class InvitationsApiService {
  private readonly api = inject(ApiService);

  send(data: SendInvitationRequest): Observable<ApiResponse<{ invitation: Invitation }>> {
    return this.api.post('/invitations', data);
  }

  get(token: string): Observable<ApiResponse<InvitationInfo>> {
    return this.api.get(`/invitations/${token}`);
  }

  accept(token: string): Observable<ApiResponse<{ invitation: Invitation }>> {
    return this.api.post(`/invitations/${token}/accept`);
  }

  reject(token: string): Observable<ApiResponse<Record<string, never>>> {
    return this.api.post(`/invitations/${token}/reject`);
  }

  cancel(id: string): Observable<ApiResponse<Record<string, never>>> {
    return this.api.post(`/invitations/${id}/cancel`);
  }
}
