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

export function getFolderHasFilesCount(e: unknown): number | null {
  if (isAxiosError<{ code?: string; data?: { file_count?: number } }>(e) &&
      e.response?.data?.code === 'FOLDER_HAS_FILES') {
    return e.response?.data?.data?.file_count ?? 0;
  }
  return null;
}
