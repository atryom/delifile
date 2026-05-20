/** Format a byte count as a human-readable string. Default locale is Russian (КБ/МБ/ГБ). */
export function formatSize(bytes: number | null | undefined, locale: 'ru' | 'en' = 'ru'): string {
  if (bytes == null || bytes === 0) return '—';
  const [b, kb, mb, gb] = locale === 'en' ? ['B', 'KB', 'MB', 'GB'] : ['Б', 'КБ', 'МБ', 'ГБ'];
  if (bytes < 1024) return `${bytes} ${b}`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} ${kb}`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} ${mb}`;
  return `${(bytes / 1_073_741_824).toFixed(1)} ${gb}`;
}
