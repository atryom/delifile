import { apiClient } from './client';
import type { ApiResponse, TwoFaPollResult, User } from '@/types';

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
  user?: User;
}

export const lockpassApi = {
  getProjectQR: () =>
    apiClient.get<ApiResponse<ProjectQR>>('/auth/2fa/qr'),

  poll: (sessionId: string) =>
    apiClient.post<ApiResponse<TwoFaPollResult>>('/auth/2fa/poll', { session_id: sessionId }),

  verifyTotp: (sessionId: string, code: string) =>
    apiClient.post<ApiResponse<TwoFaPollResult>>('/auth/2fa/totp', { session_id: sessionId, code }),

  verifyRecovery: (sessionId: string, code: string) =>
    apiClient.post<ApiResponse<TwoFaPollResult>>('/auth/2fa/recovery', { session_id: sessionId, code }),

  enable: (lockpassUserId: number) =>
    apiClient.post<ApiResponse<{ user: User }>>('/settings/2fa/enable', { lockpass_user_id: lockpassUserId }),

  disable: () =>
    apiClient.post<ApiResponse<{ user: User }>>('/settings/2fa/disable'),

  initConnect: () =>
    apiClient.post<ApiResponse<ConnectSession>>('/auth/2fa/init-connect', {}),

  pollConnect: (tempToken: string) =>
    apiClient.get<ApiResponse<ConnectPollResult>>(`/auth/2fa/poll-connect/${tempToken}`),
};
