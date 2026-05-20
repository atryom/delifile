/** Format a byte count as a human-readable string using Russian locale (КБ/МБ/ГБ). */
export function formatSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} КБ`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} МБ`;
  return `${(bytes / 1_073_741_824).toFixed(1)} ГБ`;
}
