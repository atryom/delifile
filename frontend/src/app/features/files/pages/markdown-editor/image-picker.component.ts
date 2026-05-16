import {
  Component,
  inject,
  signal,
  output,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DocumentsApiService } from '../../../../core/api/documents-api.service';
import { ImageAsset } from '../../../../shared/models/api.models';

@Component({
  selector: 'app-image-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div
      class="image-picker-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Выбор изображения"
      (click)="onOverlayClick($event)"
    >
      <div class="image-picker-panel">
        <div class="image-picker-header">
          <h2 class="image-picker-title">Вставить изображение</h2>
          <button
            type="button"
            class="image-picker-close"
            aria-label="Закрыть"
            (click)="cancelled.emit()"
          >✕</button>
        </div>

        <div class="image-picker-search">
          <input
            type="search"
            placeholder="Поиск по имени..."
            aria-label="Поиск изображений"
            [(ngModel)]="searchQuery"
            (ngModelChange)="onSearchChange()"
            class="image-picker-search-input"
          />
        </div>

        @if (loading()) {
          <div class="image-picker-state" aria-live="polite">Загрузка...</div>
        } @else if (images().length === 0) {
          <div class="image-picker-state" aria-live="polite">Изображения не найдены</div>
        } @else {
          <ul class="image-picker-grid" role="listbox" aria-label="Доступные изображения">
            @for (img of images(); track img.id) {
              <li
                role="option"
                [attr.aria-selected]="selected()?.id === img.id"
                class="image-picker-item"
                [class.selected]="selected()?.id === img.id"
                (click)="select(img)"
                (keydown.enter)="select(img)"
                (keydown.space)="select(img)"
                tabindex="0"
              >
                <img
                  [src]="img.previewUrl"
                  [alt]="img.fileName"
                  class="image-picker-thumb"
                  loading="lazy"
                />
                <span class="image-picker-name">{{ img.fileName }}</span>
              </li>
            }
          </ul>

          @if (nextCursor()) {
            <button
              type="button"
              class="image-picker-load-more"
              [disabled]="loadingMore()"
              (click)="loadMore()"
            >
              {{ loadingMore() ? 'Загрузка...' : 'Загрузить ещё' }}
            </button>
          }
        }

        <div class="image-picker-footer">
          <button
            type="button"
            class="btn btn-secondary"
            (click)="cancelled.emit()"
          >Отмена</button>
          <button
            type="button"
            class="btn btn-primary"
            [disabled]="!selected()"
            (click)="confirm()"
          >Вставить</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .image-picker-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.5);
      display: flex; align-items: center; justify-content: center; z-index: 1000;
    }
    .image-picker-panel {
      background: var(--color-surface, #fff); border-radius: 8px;
      width: 640px; max-width: 95vw; max-height: 80vh;
      display: flex; flex-direction: column; overflow: hidden;
    }
    .image-picker-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px; border-bottom: 1px solid var(--color-border, #e5e7eb);
    }
    .image-picker-title { margin: 0; font-size: 1.1rem; font-weight: 600; }
    .image-picker-close {
      background: none; border: none; font-size: 1.2rem; cursor: pointer;
      color: var(--color-text-secondary, #6b7280); line-height: 1;
    }
    .image-picker-search { padding: 12px 20px; }
    .image-picker-search-input {
      width: 100%; padding: 8px 12px; border: 1px solid var(--color-border, #e5e7eb);
      border-radius: 6px; font-size: 0.9rem; box-sizing: border-box;
    }
    .image-picker-state {
      padding: 32px 20px; text-align: center;
      color: var(--color-text-secondary, #6b7280);
    }
    .image-picker-grid {
      list-style: none; margin: 0; padding: 0 20px;
      display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 8px; overflow-y: auto; flex: 1;
    }
    .image-picker-item {
      border: 2px solid transparent; border-radius: 6px; cursor: pointer;
      padding: 4px; text-align: center; transition: border-color .15s;
    }
    .image-picker-item:hover, .image-picker-item:focus { border-color: var(--color-primary, #3b82f6); outline: none; }
    .image-picker-item.selected { border-color: var(--color-primary, #3b82f6); background: var(--color-primary-light, #eff6ff); }
    .image-picker-thumb { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 4px; display: block; }
    .image-picker-name {
      display: block; font-size: 0.75rem; margin-top: 4px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .image-picker-load-more {
      display: block; margin: 12px auto; padding: 8px 20px;
      background: none; border: 1px solid var(--color-border, #e5e7eb);
      border-radius: 6px; cursor: pointer; font-size: 0.9rem;
    }
    .image-picker-footer {
      display: flex; justify-content: flex-end; gap: 8px;
      padding: 12px 20px; border-top: 1px solid var(--color-border, #e5e7eb);
    }
    .btn { padding: 8px 16px; border-radius: 6px; font-size: 0.9rem; cursor: pointer; border: none; }
    .btn-primary { background: var(--color-primary, #3b82f6); color: #fff; }
    .btn-primary:disabled { opacity: .5; cursor: not-allowed; }
    .btn-secondary { background: var(--color-bg-secondary, #f3f4f6); }
  `],
})
export class ImagePickerComponent implements OnInit {
  readonly selected$ = output<ImageAsset>({ alias: 'selected' });
  readonly cancelled = output<void>();

  private readonly docsApi = inject(DocumentsApiService);

  readonly images     = signal<ImageAsset[]>([]);
  readonly loading    = signal(false);
  readonly loadingMore = signal(false);
  readonly nextCursor = signal<string | null>(null);
  readonly selected   = signal<ImageAsset | null>(null);

  searchQuery = '';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.load();
  }

  select(img: ImageAsset): void {
    this.selected.set(img);
  }

  confirm(): void {
    const img = this.selected();
    if (img) this.selected$.emit(img);
  }

  onOverlayClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('image-picker-overlay')) {
      this.cancelled.emit();
    }
  }

  onSearchChange(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), 400);
  }

  loadMore(): void {
    const cursor = this.nextCursor();
    if (!cursor) return;

    this.loadingMore.set(true);
    this.docsApi
      .getImages({ search: this.searchQuery || undefined, cursor })
      .subscribe({
        next: res => {
          this.images.update(prev => [...prev, ...res.data.items]);
          this.nextCursor.set(res.data.nextCursor);
          this.loadingMore.set(false);
        },
        error: () => this.loadingMore.set(false),
      });
  }

  private load(): void {
    this.loading.set(true);
    this.images.set([]);
    this.nextCursor.set(null);
    this.selected.set(null);

    this.docsApi
      .getImages({ search: this.searchQuery || undefined })
      .subscribe({
        next: res => {
          this.images.set(res.data.items);
          this.nextCursor.set(res.data.nextCursor);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
