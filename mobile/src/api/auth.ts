import { apiClient } from './client';
import type { User, LoginPayload, RegisterPayload, DeviceSession, ApiResponse } from '@/types';

export const authApi = {
  login: (payload: LoginPayload) =>
    apiClient.post<ApiResponse<{ token: string; user: User }>>('/auth/login', payload),

  register: (payload: RegisterPayload) =>
    apiClient.post<ApiResponse<{ token: string; user: User }>>('/auth/register', payload),

  logout: () =>
    apiClient.post<ApiResponse<null>>('/auth/logout'),

  me: () =>
    apiClient.get<ApiResponse<{ user: User }>>('/auth/me'),

  forgotPassword: (email: string) =>
    apiClient.post<ApiResponse<null>>('/auth/password/forgot', { email }),

  verifyResetToken: (token: string, email?: string) =>
    apiClient.post<ApiResponse<{ token: string } | null>>('/auth/password/verify-reset-token', { token, email }),

  resetPassword: (token: string, password: string, password_confirmation: string) =>
    apiClient.post<ApiResponse<null>>('/auth/password/reset', { token, password, password_confirmation }),

  changePassword: (current_password: string, password: string, password_confirmation: string) =>
    apiClient.post<ApiResponse<null>>('/auth/password/change', { current_password, password, password_confirmation }),

  resendVerification: () =>
    apiClient.post<ApiResponse<null>>('/auth/email/resend-verification'),

  sessions: () =>
    apiClient.get<ApiResponse<{ items: DeviceSession[] }>>('/auth/sessions'),

  revokeSession: (id: string) =>
    apiClient.delete<ApiResponse<null>>(`/auth/sessions/${id}`),

  updateSettings: (settings: Partial<Pick<User,
    'notifications_enabled' | 'notify_new_files' | 'notify_folder_shared' | 'notify_shared_folder_updates' |
    'notify_comments' | 'notify_mentions' | 'notify_support_reply' | 'notify_contacts_added' | 'notify_task_assigned' |
    'allow_contacts_without_confirmation' | 'auto_add_received_files'
  >>) =>
    apiClient.patch<ApiResponse<{ user: User }>>('/user/settings', settings),
};
