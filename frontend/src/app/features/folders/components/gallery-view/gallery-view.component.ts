import {
  Component, input, signal, computed, ChangeDetectionStrategy, HostListener,
} from '@angular/core';
import { SharedFolderFileItem } from '../../../../shared/models/api.models';

@Component({
  selector: 'app-gallery-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gallery-grid" role="list">
      @for (file of mediaFiles(); track file.id; let i = $index) {
        <button
          type="button"
          class="gallery-cell"
          role="listitem"
          [attr.aria-label]="file.display_name ?? file.original_name"
          (click)="open(i)"
        >
          @if (file.preview_url) {
            <img [src]="file.preview_url" [alt]="file.display_name ?? file.original_name" class="gallery-thumb" loading="lazy" />
          } @else {
            <div class="gallery-placeholder" aria-hidden="true">🖼</div>
          }
          @if (isVideo(file)) {
            <div class="gallery-play" aria-hidden="true">&#9654;</div>
          }
        </button>
      }
      @if (mediaFiles().length === 0) {
        <div class="gallery-empty">
          <span aria-hidden="true">🖼</span>
          <p>В галерее нет фото и видео</p>
        </div>
      }
    </div>

    <!-- Lightbox -->
    @if (lightboxOpen()) {
      <div class="lightbox-backdrop" role="dialog" aria-modal="true" [attr.aria-label]="currentFile()?.display_name ?? currentFile()?.original_name ?? 'Просмотр'" (click)="close()">
        <div class="lightbox-content" (click)="$event.stopPropagation()">
          <button type="button" class="lightbox-close" (click)="close()" aria-label="Закрыть">✕</button>

          <button type="button" class="lightbox-nav lightbox-prev" (click)="prev()" [disabled]="lightboxIndex() === 0" aria-label="Назад">‹</button>

          <div class="lightbox-media">
            @if (currentFile()) {
              @if (isVideo(currentFile()!)) {
                <video [src]="currentFile()!.preview_url ?? ''" class="lightbox-video" controls [attr.autoplay]="true"></video>
              } @else {
                <img [src]="currentFile()!.preview_url ?? ''" [alt]="(currentFile()!.display_name ?? currentFile()!.original_name)!" class="lightbox-img" />
              }
            }
          </div>

          <button type="button" class="lightbox-nav lightbox-next" (click)="next()" [disabled]="lightboxIndex() === mediaFiles().length - 1" aria-label="Вперёд">›</button>

          <div class="lightbox-counter" aria-live="polite">{{ lightboxIndex() + 1 }} / {{ mediaFiles().length }}</div>
        </div>
      </div>
    }
  `,
  styleUrl: './gallery-view.component.scss',
})
export class GalleryViewComponent {
  readonly files = input.required<SharedFolderFileItem[]>();

  readonly mediaFiles = computed(() =>
    this.files().filter(f =>
      f.content_kind === 'binary_file' && f.mime_type &&
      (f.mime_type.startsWith('image/') || f.mime_type.startsWith('video/'))
    )
  );

  readonly lightboxOpen  = signal(false);
  readonly lightboxIndex = signal(0);
  readonly currentFile   = computed(() => this.mediaFiles()[this.lightboxIndex()] ?? null);

  open(index: number): void {
    this.lightboxIndex.set(index);
    this.lightboxOpen.set(true);
  }

  close(): void { this.lightboxOpen.set(false); }

  prev(): void {
    if (this.lightboxIndex() > 0) this.lightboxIndex.update(i => i - 1);
  }

  next(): void {
    if (this.lightboxIndex() < this.mediaFiles().length - 1) this.lightboxIndex.update(i => i + 1);
  }

  isVideo(file: SharedFolderFileItem): boolean {
    return !!file.mime_type?.startsWith('video/');
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (!this.lightboxOpen()) return;
    if (e.key === 'Escape')     { this.close(); e.preventDefault(); }
    if (e.key === 'ArrowLeft')  { this.prev();  e.preventDefault(); }
    if (e.key === 'ArrowRight') { this.next();  e.preventDefault(); }
  }
}
