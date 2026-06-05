import { apiClient } from './client';
import type { ApiResponse } from '@/types';

export const pushApi = {
  registerToken: (token: string, platform: 'android' | 'ios', deviceId?: string) =>
    apiClient.post<ApiResponse<Record<string, never>>>('/push/device-token', { token, platform, device_id: deviceId }),

  unregisterToken: (token: string) =>
    apiClient.delete<ApiResponse<Record<string, never>>>('/push/device-token', { data: { token } }),
};
