export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Б';
  const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const MIME_ICONS: Record<string, string> = {
  'application/pdf': 'document',
  'application/zip': 'archive',
  'application/x-zip-compressed': 'archive',
  'text/plain': 'document-text',
  'text/csv': 'grid',
  'application/json': 'code',
};

export function getMimeIcon(mimeType: string | null): string {
  if (!mimeType) return 'document';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'videocam';
  if (mimeType.startsWith('audio/')) return 'musical-notes';
  return MIME_ICONS[mimeType] ?? 'document';
}
