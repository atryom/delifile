import { ContentKind } from '../models/api.models';

export type FileIconType = 'image' | 'video' | 'audio' | 'pdf' | 'xlsx' | 'pptx' | 'archive' | 'link' | 'note' | 'file';

/** Map content_kind + mime_type to a display icon type. */
export function classifyMimeType(
  contentKind: ContentKind | string | null | undefined,
  mimeType: string | null | undefined,
): FileIconType {
  if (contentKind === 'url_file') return 'link';
  const m = mimeType ?? '';
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  if (m.includes('pdf')) return 'pdf';
  if (m.includes('spreadsheet') || m.includes('excel')) return 'xlsx';
  if (m.includes('presentation') || m.includes('powerpoint')) return 'pptx';
  if (m.includes('zip') || m.includes('rar') || m.includes('tar') || m.includes('gzip')) return 'archive';
  if (m === 'text/markdown') return 'note';
  return 'file';
}

/** Return true when the file can be opened inline in the browser. */
export function canViewInBrowser(
  mimeType: string | null | undefined,
  viewUrl: string | null | undefined,
  contentKind?: ContentKind | string | null,
): boolean {
  if (contentKind === 'url_file') return false;
  const m = mimeType ?? '';
  return !!viewUrl && (
    m.startsWith('image/') ||
    m.startsWith('video/') ||
    m.startsWith('audio/') ||
    m.includes('pdf')
  );
}
