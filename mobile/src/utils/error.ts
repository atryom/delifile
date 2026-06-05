import { isAxiosError } from 'axios';

export function getApiError(e: unknown, fallback = 'Произошла ошибка'): string {
  if (isAxiosError<{ message?: string }>(e)) {
    return e.response?.data?.message ?? fallback;
  }
  if (e instanceof Error) {
    return e.message || fallback;
  }
  return fallback;
}
