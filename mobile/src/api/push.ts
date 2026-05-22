import { apiClient } from './client';

export const pushApi = {
  registerToken: (token: string, platform: 'android' | 'ios', deviceId?: string) =>
    apiClient.post('/push/device-token', { token, platform, device_id: deviceId }),

  unregisterToken: (token: string) =>
    apiClient.delete('/push/device-token', { data: { token } }),
};
