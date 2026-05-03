import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../api/api.service';
import { ApiResponse, CurrentUser, DeviceSession } from '../../shared/models/api.models';

export interface LoginRequest {
  phone: string;
  password: string;
}

export interface RegisterRequest {
  phone: string;
  password: string;
  password_confirmation: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  password: string;
  password_confirmation: string;
}

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly api = inject(ApiService);

  register(data: RegisterRequest): Observable<ApiResponse<{ token: string; user: CurrentUser; next_step: string }>> {
    return this.api.post('/auth/register', data);
  }

  login(data: LoginRequest): Observable<ApiResponse<{ token: string; user: CurrentUser }>> {
    return this.api.post('/auth/login', data);
  }

  logout(): Observable<ApiResponse<Record<string, never>>> {
    return this.api.post('/auth/logout');
  }

  logoutAll(): Observable<ApiResponse<Record<string, never>>> {
    return this.api.post('/auth/logout-all');
  }

  me(): Observable<ApiResponse<{ user: CurrentUser }>> {
    return this.api.get('/auth/me');
  }

  sessions(): Observable<ApiResponse<{ items: DeviceSession[] }>> {
    return this.api.get('/auth/sessions');
  }

  deleteSession(id: string): Observable<ApiResponse<Record<string, never>>> {
    return this.api.delete(`/auth/sessions/${id}`);
  }

  forgotPassword(phone: string): Observable<ApiResponse<Record<string, never>>> {
    return this.api.post('/auth/password/forgot', { phone });
  }

  resetPassword(data: { phone: string; token: string; password: string; password_confirmation: string }): Observable<ApiResponse<Record<string, never>>> {
    return this.api.post('/auth/password/reset', data);
  }

  changePassword(data: ChangePasswordRequest): Observable<ApiResponse<Record<string, never>>> {
    return this.api.post('/auth/password/change', data);
  }
}
