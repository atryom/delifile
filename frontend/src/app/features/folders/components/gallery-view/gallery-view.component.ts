import {
  Component, input, output, signal, computed, ChangeDetectionStrategy, HostListener,
} from '@angular/core';
import { SharedFolderFileItem } from '../../../../shared/models/api.models';

@Component({
  selector: 'app-gallery-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gallery-grid" role="list">
      @for (file of mediaFiles(); track file.id; let i = $index) {
        <div class="gallery-cell" role="listitem">
          <!-- Thumbnail -->
          <button
            type="button"
            class="gallery-thumb-btn"
            [attr.aria-label]="'Открыть ' + (file.display_name ?? file.original_name)"
            (click)="open(i)"
          >
            @if (file.preview_url) {
              <img [src]="file.preview_url" [alt]="file.display_name ?? file.original_name" class="gallery-thumb" loading="lazy" />
            } @else {
              <div class="gallery-placeholder" aria-hidden="true">
                @if (isVideo(file)) { 🎬 } @else { 🖼 }
              </div>
            }
            @if (isVideo(file)) {
              <div class="gallery-play" aria-hidden="true">&#9654;</div>
            }
          </button>

          <!-- Hover actions -->
          <div class="gallery-actions" aria-label="Действия с файлом">
            <button
              type="button"
              class="gallery-action-btn"
              title="Детали файла"
              (click)="viewFile.emit(file)"
              aria-label="Открыть детали"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </button>
            <button
              type="button"
              class="gallery-action-btn gallery-action-btn--danger"
              title="Убрать из папки"
              (click)="removeFile.emit(file.id)"
              aria-label="Убрать из папки"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
          </div>
        </div>
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
      <div class="lightbox-backdrop" role="dialog" aria-modal="true"
           [attr.aria-label]="currentFile()?.display_name ?? currentFile()?.original_name ?? 'Просмотр'"
           (click)="close()">
        <div class="lightbox-content" (click)="$event.stopPropagation()">
          <button type="button" class="lightbox-close" (click)="close()" aria-label="Закрыть">✕</button>

          <button type="button" class="lightbox-nav lightbox-prev"
                  (click)="prev()" [disabled]="lightboxIndex() === 0" aria-label="Назад">‹</button>

          <div class="lightbox-media">
            @if (currentFile()) {
              @if (isVideo(currentFile()!)) {
                @if (currentFile()!.view_url) {
                  <!-- autoplay через JS — [attr.autoplay] не надёжен в Angular -->
                  <video #videoEl
                         [src]="currentFile()!.view_url!"
                         class="lightbox-video"
                         controls
                         autoplay
                         (click)="$event.stopPropagation()">
                  </video>
                } @else {
                  <div class="lightbox-no-video">Видео недоступно</div>
                }
              } @else {
                <img [src]="currentFile()!.view_url ?? currentFile()!.preview_url ?? ''"
                     [alt]="(currentFile()!.display_name ?? currentFile()!.original_name)!"
                     class="lightbox-img" />
              }
            }
          </div>

          <button type="button" class="lightbox-nav lightbox-next"
                  (click)="next()" [disabled]="lightboxIndex() === mediaFiles().length - 1" aria-label="Вперёд">›</button>

          <div class="lightbox-counter" aria-live="polite">
            {{ lightboxIndex() + 1 }} / {{ mediaFiles().length }}
          </div>
        </div>
      </div>
    }
  `,
  styleUrl: './gallery-view.component.scss',
})
export class GalleryViewComponent {
  readonly files      = input.required<SharedFolderFileItem[]>();
  readonly removeFile = output<string>();
  readonly viewFile   = output<SharedFolderFileItem>();

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
