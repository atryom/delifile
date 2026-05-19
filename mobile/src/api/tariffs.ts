import { apiClient } from './client';
import type { ApiResponse, TariffUsage, Tariff } from '@/types';

export const tariffsApi = {
  list: () =>
    apiClient.get<ApiResponse<{ plans: Tariff[] }>>('/tariffs'),

  usage: () =>
    apiClient.get<ApiResponse<TariffUsage>>('/tariffs/usage'),

  requestPlan: (plan: string) =>
    apiClient.post<ApiResponse<Record<string, never>>>('/tariffs/request', { plan }),
};
