import { Component, computed, input, ChangeDetectionStrategy } from '@angular/core';
import { ContentKind } from '../../models/api.models';

type IconType = 'image' | 'video' | 'audio' | 'pdf' | 'xlsx' | 'pptx' | 'archive' | 'link' | 'file';

@Component({
  selector: 'app-file-type-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (iconType()) {
      @case ('image') {
        <svg [attr.width]="size()" [attr.height]="size()" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
      }
      @case ('video') {
        <svg [attr.width]="size()" [attr.height]="size()" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="2" y="2" width="20" height="20" rx="2.18"/>
          <line x1="7" y1="2" x2="7" y2="22"/>
          <line x1="17" y1="2" x2="17" y2="22"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <line x1="2" y1="7" x2="7" y2="7"/>
          <line x1="2" y1="17" x2="7" y2="17"/>
          <line x1="17" y1="17" x2="22" y2="17"/>
          <line x1="17" y1="7" x2="22" y2="7"/>
        </svg>
      }
      @case ('audio') {
        <svg [attr.width]="size()" [attr.height]="size()" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 18V5l12-2v13"/>
          <circle cx="6" cy="18" r="3"/>
          <circle cx="18" cy="16" r="3"/>
        </svg>
      }
      @case ('pdf') {
        <svg [attr.width]="size()" [attr.height]="size()" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="9" y1="15" x2="15" y2="15"/>
        </svg>
      }
      @case ('xlsx') {
        <svg [attr.width]="size()" [attr.height]="size()" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="8" y1="13" x2="16" y2="13"/>
          <line x1="8" y1="17" x2="16" y2="17"/>
          <line x1="10" y1="9" x2="14" y2="9"/>
        </svg>
      }
      @case ('archive') {
        <svg [attr.width]="size()" [attr.height]="size()" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
          <polyline points="21 8 21 21 3 21 3 8"/>
          <rect x="1" y="3" width="22" height="5"/>
          <line x1="10" y1="12" x2="14" y2="12"/>
        </svg>
      }
      @case ('link') {
        <svg [attr.width]="size()" [attr.height]="size()" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
      }
      @default {
        <svg [attr.width]="size()" [attr.height]="size()" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      }
    }
  `,
  styles: [`
    :host { display: inline-flex; align-items: center; justify-content: center; }
  `],
})
export class FileTypeIconComponent {
  mime = input<string | null>(null);
  kind = input<ContentKind | null>(null);
  size = input<number>(20);

  readonly iconType = computed<IconType>(() => {
    if (this.kind() === 'url_file') return 'link';
    const m = this.mime() ?? '';
    if (m.startsWith('image/'))  return 'image';
    if (m.startsWith('video/'))  return 'video';
    if (m.startsWith('audio/'))  return 'audio';
    if (m.includes('pdf'))       return 'pdf';
    if (m.includes('spreadsheet') || m.includes('excel')) return 'xlsx';
    if (m.includes('presentation') || m.includes('powerpoint')) return 'pptx';
    if (m.includes('zip') || m.includes('rar') || m.includes('tar') || m.includes('gzip')) return 'archive';
    return 'file';
  });
}
