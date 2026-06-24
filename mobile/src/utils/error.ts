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
  if (isAxiosError<{ data?: { code?: string; errors?: { file_count?: number } } }>(e)) {
    const inner = e.response?.data?.data;
    if (inner?.code === 'FOLDER_HAS_FILES') {
      return inner?.errors?.file_count ?? 0;
    }
  }
  return null;
}
