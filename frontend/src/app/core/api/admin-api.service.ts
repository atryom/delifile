import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AdminStats, AdminUser, ApiResponse, TariffPlan } from '../../shared/models/api.models';

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1/admin';

  getStats(): Observable<ApiResponse<AdminStats>> {
    return this.http.get<ApiResponse<AdminStats>>(`${this.base}/stats`);
  }

  getUsers(): Observable<ApiResponse<{ items: AdminUser[] }>> {
    return this.http.get<ApiResponse<{ items: AdminUser[] }>>(`${this.base}/users`);
  }

  updatePlan(userId: string, plan: TariffPlan): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.base}/users/${userId}/plan`, { plan });
  }

  blockUser(userId: string): Observable<ApiResponse<{ account_status: string }>> {
    return this.http.post<ApiResponse<{ account_status: string }>>(`${this.base}/users/${userId}/block`, {});
  }

  generateResetLink(userId: string): Observable<ApiResponse<{ url: string }>> {
    return this.http.post<ApiResponse<{ url: string }>>(`${this.base}/users/${userId}/reset-link`, {});
  }

  resetSessions(userId: string): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}/users/${userId}/reset-sessions`, {});
  }
}
