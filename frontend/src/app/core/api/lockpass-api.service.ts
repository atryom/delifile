import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse, CurrentUser } from '../../shared/models/api.models';

export interface TwoFaSession {
  requires_2fa: true;
  session_id: string;
  qr_payload: string | null;
  expires_at: string;
}

export interface TwoFaPollResult {
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  token?: string;
  user?: CurrentUser;
}

export interface ProjectQR {
  qr_payload: string;
  deep_link: string;
  app_store: string;
  ru_store: string;
}

export interface ConnectSession {
  temp_token: string;
  qr_payload: string;
  deep_link: string;
  expires_at?: string;
}

export interface ConnectPollResult {
  status: 'pending' | 'connected';
  user?: CurrentUser;
}

export interface LockpassLoginSession {
  session_id: string;
  qr_payload: string | null;
  expires_at: string;
}

export interface AnonymousLoginSession {
  session_id: string;
  qr_payload: string;
  deep_link: string;
  expires_at: string;
}

export interface AnonPollResult {
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  token?: string;
  user?: CurrentUser;
}

@Injectable({ providedIn: 'root' })
export class LockPassApiService {
  private readonly api = inject(ApiService);

  getProjectQR(): Observable<ApiResponse<ProjectQR>> {
    return this.api.get('/auth/2fa/qr');
  }

  poll(sessionId: string): Observable<ApiResponse<TwoFaPollResult>> {
    return this.api.post('/auth/2fa/poll', { session_id: sessionId });
  }

  verifyTotp(sessionId: string, code: string): Observable<ApiResponse<TwoFaPollResult>> {
    return this.api.post('/auth/2fa/totp', { session_id: sessionId, code });
  }

  verifyRecovery(sessionId: string, code: string): Observable<ApiResponse<TwoFaPollResult>> {
    return this.api.post('/auth/2fa/recovery', { session_id: sessionId, code });
  }

  enable(lockpassUserId: number): Observable<ApiResponse<{ user: CurrentUser }>> {
    return this.api.post('/settings/2fa/enable', { lockpass_user_id: lockpassUserId });
  }

  disable(): Observable<ApiResponse<{ user: CurrentUser }>> {
    return this.api.post('/settings/2fa/disable');
  }

  initConnect(): Observable<ApiResponse<ConnectSession>> {
    return this.api.post('/auth/2fa/init-connect', {});
  }

  pollConnect(tempToken: string): Observable<ApiResponse<ConnectPollResult>> {
    return this.api.get(`/auth/2fa/poll-connect/${tempToken}`);
  }

  loginInit(email: string, deviceId: string, deviceType: string): Observable<ApiResponse<LockpassLoginSession>> {
    return this.api.post('/auth/lockpass/login-init', { email, device_id: deviceId, device_type: deviceType });
  }

  setMode(mode: '2fa' | 'alternative'): Observable<ApiResponse<{ user: CurrentUser }>> {
    return this.api.post('/settings/lockpass/set-mode', { mode });
  }

  createAnonymousSession(): Observable<ApiResponse<AnonymousLoginSession>> {
    return this.api.post('/auth/lockpass/session-create', {});
  }

  pollAnonymous(sessionId: string): Observable<ApiResponse<AnonPollResult>> {
    return this.api.post('/auth/2fa/poll', { session_id: sessionId });
  }

  verifyLoginCode(code: string): Observable<ApiResponse<AnonPollResult>> {
    return this.api.post('/auth/lockpass/verify-code', { code });
  }
}
