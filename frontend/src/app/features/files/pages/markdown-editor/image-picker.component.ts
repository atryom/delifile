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
  styleUrl: './image-picker.component.scss',
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
        } @else if (loadError()) {
          <div class="image-picker-state" aria-live="polite" role="alert">
            Не удалось загрузить изображения. Попробуйте позже.
          </div>
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
})
export class ImagePickerComponent implements OnInit {
  readonly selected$ = output<ImageAsset>({ alias: 'selected' });
  readonly cancelled = output<void>();

  private readonly docsApi = inject(DocumentsApiService);

  readonly images      = signal<ImageAsset[]>([]);
  readonly loading     = signal(false);
  readonly loadingMore = signal(false);
  readonly loadError   = signal(false);
  readonly nextCursor  = signal<string | null>(null);
  readonly selected    = signal<ImageAsset | null>(null);

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
    this.loadError.set(false);
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
        error: () => {
          this.loading.set(false);
          this.loadError.set(true);
        },
      });
  }
}
