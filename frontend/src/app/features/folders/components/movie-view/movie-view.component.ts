import {
  Component, input, output, ChangeDetectionStrategy, signal, computed, inject,
  viewChild, ElementRef, DestroyRef, effect,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SharedFolderFileItem, MovieMetadata } from '../../../../shared/models/api.models';

type FilterStatus = 'all' | 'watched' | 'unwatched';
type SortBy = 'default' | 'kp_rating' | 'personal_rating';

@Component({
  selector: 'app-movie-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="movie-view-wrap">
      <!-- Filter bar -->
      <div class="movies-filter-bar" role="toolbar" aria-label="Фильтры фильмов">
        <div class="filter-chips" role="group" aria-label="Статус просмотра">
          @for (f of filterOpts; track f.val) {
            <button type="button" class="filter-chip"
                    [class.active]="filterStatus() === f.val"
                    (click)="filterStatus.set(f.val)">{{ f.label }}</button>
          }
        </div>
        <div class="sort-chips" role="group" aria-label="Сортировка">
          @for (s of sortOpts; track s.val) {
            <button type="button" class="filter-chip"
                    [class.active]="sortBy() === s.val"
                    (click)="sortBy.set(s.val)">{{ s.label }}</button>
          }
        </div>
      </div>

      <div class="movies-grid" role="list">
        @for (file of filteredFiles(); track file.id) {
          <div class="movie-card" role="listitem"
               [class.watched]="getWatched(file)"
               (click)="fileClick.emit(file)" style="cursor:pointer"
               tabindex="0" (keydown.enter)="fileClick.emit(file)"
               [attr.aria-label]="file.display_name ?? file.original_name">
            <div class="movie-poster-wrap">
              @if (poster(file)) {
                <img [src]="poster(file)!" [alt]="file.display_name ?? file.original_name" class="movie-poster" loading="lazy" />
              } @else {
                <div class="movie-poster-placeholder" aria-hidden="true">🎬</div>
              }
            </div>
            <div class="movie-info">
              <div class="movie-title">{{ file.display_name ?? file.original_name }}</div>
              @if (getMeta(file); as m) {
                <div class="movie-meta">
                  @if (m.year) { <span>{{ m.year }}</span> }
                  @if (m.rating_kp) { <span class="movie-rating">★ {{ m.rating_kp }}</span> }
                  @if (getPersonalRating(file) !== null) {
                    <span class="personal-rating">👤 {{ getPersonalRating(file) }}</span>
                  }
                </div>
                @if (m.genres && m.genres.length) {
                  <div class="movie-genres">
                    @for (g of m.genres.slice(0, 3); track g) {
                      <span class="genre-tag">{{ g }}</span>
                    }
                  </div>
                }
                @if (m.director) {
                  <div class="movie-director">Реж. {{ m.director }}</div>
                }
              }

              <!-- Personal rating + watched -->
              <div class="movie-actions" (click)="$event.stopPropagation()">
                <div class="rating-wrap">
                  <button type="button" class="action-btn rating-btn"
                          (click)="toggleRatingPicker($event, file.id)"
                          [attr.aria-label]="'Личная оценка: ' + (getPersonalRating(file) ?? 'не задана')">
                    @if (getPersonalRating(file) !== null) {
                      <span>⭐ {{ getPersonalRating(file) }}/10</span>
                    } @else {
                      <span class="muted">⭐ Оценить</span>
                    }
                  </button>
                  @if (ratingPickerId() === file.id) {
                    <div class="rating-picker" role="dialog" aria-label="Выберите оценку">
                      <div class="rating-picker-grid">
                        @for (r of ratingValues; track r) {
                          <button type="button" class="rating-pick-btn"
                                  [class.active]="getPersonalRating(file) === r"
                                  (click)="pickRating($event, file, r)">{{ r }}</button>
                        }
                      </div>
                      @if (getPersonalRating(file) !== null) {
                        <button type="button" class="rating-clear-btn" (click)="pickRating($event, file, null)">Сбросить</button>
                      }
                    </div>
                  }
                </div>
                <button type="button" class="action-btn watch-btn"
                        [class.active]="getWatched(file)"
                        (click)="toggleWatched($event, file)"
                        [attr.aria-label]="getWatched(file) ? 'Отметить как непросмотренный' : 'Отметить как просмотренный'">
                  {{ getWatched(file) ? '👁 Смотрел' : '👁 Смотреть' }}
                </button>
              </div>
            </div>
            @if (canEdit()) {
              <button type="button" class="movie-delete-btn"
                      (click)="onDelete($event, file)"
                      [attr.aria-label]="'Удалить ' + (file.display_name ?? file.original_name)">
                ✕
              </button>
            }
          </div>
        }
        @if (files().length === 0) {
          <div class="movies-empty">
            <span aria-hidden="true">🎬</span>
            <p>В папке нет фильмов</p>
            <button type="button" class="btn-add-first" (click)="addClick.emit()">+ Добавить фильм</button>
          </div>
        }
        @if (files().length > 0 && filteredFiles().length === 0) {
          <div class="movies-empty">
            <p>Нет фильмов, соответствующих фильтру</p>
          </div>
        }
        @if (hasMore()) {
          <div #sentinel class="scroll-sentinel" aria-hidden="true"></div>
        }
        @if (loading()) {
          <div class="movies-loading" role="status" aria-live="polite">Загрузка...</div>
        }
      </div>
    </div>
  `,
  styleUrl: './movie-view.component.scss',
})
export class MovieViewComponent {
  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);

  readonly files       = input.required<SharedFolderFileItem[]>();
  readonly canEdit     = input<boolean>(false);
  readonly hasMore     = input<boolean>(false);
  readonly loading     = input<boolean>(false);
  readonly addClick    = output<void>();
  readonly fileClick   = output<SharedFolderFileItem>();
  readonly deleteClick = output<SharedFolderFileItem>();
  readonly loadMore    = output<void>();

  readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');

  private observer: IntersectionObserver | null = null;

  filterStatus = signal<FilterStatus>('all');
  sortBy       = signal<SortBy>('default');

  localMeta      = signal<Record<string, { watched?: boolean | null; personal_rating?: number | null }>>({});
  ratingPickerId  = signal<string | null>(null);
  readonly ratingValues = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  constructor() {
    this.destroyRef.onDestroy(() => this.observer?.disconnect());
  }

  private readonly scrollEffect = effect((onCleanup) => {
    this.files();
    this.hasMore();
    this.loading();
    const handle = requestAnimationFrame(() => this.setupObserver());
    onCleanup(() => cancelAnimationFrame(handle));
  });

  private setupObserver(): void {
    this.observer?.disconnect();
    this.observer = null;
    const el = this.sentinel()?.nativeElement;
    if (!el) return;
    this.observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && this.hasMore() && !this.loading()) {
        this.loadMore.emit();
      }
    }, { rootMargin: '300px' });
    this.observer.observe(el);
  }

  readonly filterOpts: { val: FilterStatus; label: string }[] = [
    { val: 'all',       label: 'Все' },
    { val: 'watched',   label: 'Смотрел' },
    { val: 'unwatched', label: 'Не смотрел' },
  ];

  readonly sortOpts: { val: SortBy; label: string }[] = [
    { val: 'default',         label: 'По умолчанию' },
    { val: 'kp_rating',       label: 'Рейтинг КП' },
    { val: 'personal_rating', label: 'Мой рейтинг' },
  ];

  filteredFiles = computed(() => {
    const all    = this.files();
    const status = this.filterStatus();
    const sort   = this.sortBy();
    const local  = this.localMeta();

    let result = all.filter(f => {
      if (status === 'all') return true;
      const watched = local[f.id]?.watched ?? (f as any).custom_metadata?.watched ?? null;
      return status === 'watched' ? !!watched : !watched;
    });

    if (sort === 'kp_rating') {
      result = [...result].sort((a, b) =>
        ((b as any).custom_metadata?.rating_kp ?? 0) - ((a as any).custom_metadata?.rating_kp ?? 0)
      );
    } else if (sort === 'personal_rating') {
      result = [...result].sort((a, b) => {
        const ra = local[a.id]?.personal_rating ?? (a as any).custom_metadata?.personal_rating ?? null;
        const rb = local[b.id]?.personal_rating ?? (b as any).custom_metadata?.personal_rating ?? null;
        return (rb ?? -1) - (ra ?? -1);
      });
    }

    return result;
  });

  getMeta(file: SharedFolderFileItem): MovieMetadata | null {
    return (file as any).custom_metadata ?? null;
  }

  getWatched(file: SharedFolderFileItem): boolean {
    const local = this.localMeta();
    if (file.id in local && 'watched' in local[file.id]) return !!local[file.id].watched;
    return !!(this.getMeta(file) as any)?.watched;
  }

  getPersonalRating(file: SharedFolderFileItem): number | null {
    const local = this.localMeta();
    if (file.id in local && 'personal_rating' in local[file.id]) return local[file.id].personal_rating ?? null;
    return (this.getMeta(file) as any)?.personal_rating ?? null;
  }

  poster(file: SharedFolderFileItem): string | null {
    return this.getMeta(file)?.poster_url ?? file.link_image_url ?? null;
  }

  onDelete(event: MouseEvent, file: SharedFolderFileItem): void {
    event.stopPropagation();
    this.deleteClick.emit(file);
  }

  toggleWatched(event: MouseEvent, file: SharedFolderFileItem): void {
    event.stopPropagation();
    const current = this.getWatched(file);
    const newVal  = !current;
    this.localMeta.update(m => ({ ...m, [file.id]: { ...m[file.id], watched: newVal } }));
    this.http.patch(`/api/v1/files/${file.id}/movie-meta`, { watched: newVal }).subscribe({
      error: () => this.localMeta.update(m => ({ ...m, [file.id]: { ...m[file.id], watched: current } })),
    });
  }

  toggleRatingPicker(event: MouseEvent, fileId: string): void {
    event.stopPropagation();
    this.ratingPickerId.set(this.ratingPickerId() === fileId ? null : fileId);
  }

  pickRating(event: MouseEvent, file: SharedFolderFileItem, rating: number | null): void {
    event.stopPropagation();
    const old = this.getPersonalRating(file);
    this.localMeta.update(m => ({ ...m, [file.id]: { ...m[file.id], personal_rating: rating } }));
    this.ratingPickerId.set(null);
    this.http.patch(`/api/v1/files/${file.id}/movie-meta`, { personal_rating: rating }).subscribe({
      error: () => this.localMeta.update(m => ({ ...m, [file.id]: { ...m[file.id], personal_rating: old } })),
    });
  }
}
