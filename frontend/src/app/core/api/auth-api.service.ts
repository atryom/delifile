import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../api/api.service';
import { ApiResponse, CurrentUser, DeviceSession } from '../../shared/models/api.models';
import { TwoFaSession } from './lockpass-api.service';

export interface LoginRequest {
  email: string;
  password: string;
  device_id?: string;
  device_type?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  password_confirmation: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  password: string;
  password_confirmation: string;
}

export interface ChangeEmailRequest {
  email: string;
}

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly api = inject(ApiService);

  register(data: RegisterRequest): Observable<ApiResponse<{ token: string; user: CurrentUser }>> {
    return this.api.post('/auth/register', data);
  }

  login(data: LoginRequest): Observable<ApiResponse<{ token: string; user: CurrentUser } | TwoFaSession>> {
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

  resendVerification(): Observable<ApiResponse<Record<string, never>>> {
    return this.api.post('/auth/email/resend-verification');
  }

  changeEmail(data: ChangeEmailRequest): Observable<ApiResponse<{ user: CurrentUser }>> {
    return this.api.post('/auth/email/change', data);
  }

  changePassword(data: ChangePasswordRequest): Observable<ApiResponse<Record<string, never>>> {
    return this.api.post('/auth/password/change', data);
  }

  forgotPassword(email: string): Observable<ApiResponse<Record<string, never>>> {
    return this.api.post('/auth/password/forgot', { email });
  }

  verifyResetToken(token: string, email?: string): Observable<ApiResponse<{ token: string }>> {
    return this.api.post('/auth/password/verify-reset-token', { token, email });
  }

  resetPassword(token: string, password: string, password_confirmation: string): Observable<ApiResponse<Record<string, never>>> {
    return this.api.post('/auth/password/reset', { token, password, password_confirmation });
  }
}