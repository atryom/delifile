import type { TariffPlan } from './auth';

export interface TariffUsage {
  storage_used_bytes: number;
  storage_limit_bytes: number;
  device_count: number;
  device_limit: number | null;
  max_file_size_bytes: number;
  file_size_limit_bytes: number;
}

export interface Tariff {
  key: TariffPlan;
  price_rub: number;
  file_size_mb: number;
  storage_mb: number;
  device_limit: number | null;
}
