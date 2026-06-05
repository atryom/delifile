import {
  Component, input, output, signal, computed, inject, ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SharedFoldersApiService } from '../../../../core/api/shared-folders-api.service';
import { MovieMetadata } from '../../../../shared/models/api.models';

@Component({
  selector: 'app-add-movie-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div class="dialog-backdrop" (click)="cancel.emit()" role="dialog" aria-modal="true" aria-label="Добавить фильм">
      <div class="dialog" (click)="$event.stopPropagation()">
        <div class="dialog-header">
          <h2 class="dialog-title">Добавить фильм</h2>
          <button type="button" class="dialog-close" (click)="cancel.emit()" aria-label="Закрыть">✕</button>
        </div>

        <div class="dialog-body">
          <div class="search-row">
            <input
              type="text"
              class="search-input"
              [(ngModel)]="query"
              placeholder="Название или ссылка kinopoisk.ru"
              (keydown.enter)="search()"
              aria-label="Название или ссылка на Кинопоиск"
            />
            <button type="button" class="btn-search" (click)="search()" [disabled]="!query.trim() || loading()">
              {{ loading() ? '…' : (isUrl() ? 'Добавить' : 'Найти') }}
            </button>
          </div>
          <p class="search-hint">{{ isUrl() ? 'Фильм будет добавлен автоматически' : 'Или вставьте ссылку на kinopoisk.ru' }}</p>

          @if (error()) {
            <p class="search-error" role="alert">{{ error() }}</p>
          }

          @if (results().length > 0) {
            <ul class="results-list" role="list">
              @for (movie of results(); track movie.kinopoisk_id) {
                <li class="result-item" role="listitem">
                  <div class="result-poster-wrap">
                    @if (movie.poster_url) {
                      <img [src]="movie.poster_url" [alt]="movie.title ?? ''" class="result-poster" loading="lazy" />
                    } @else {
                      <div class="result-poster-placeholder" aria-hidden="true">🎬</div>
                    }
                  </div>
                  <div class="result-info">
                    <div class="result-title">{{ movie.title }}</div>
                    <div class="result-meta">
                      @if (movie.year) { <span>{{ movie.year }}</span> }
                      @if (movie.rating_kp) { <span class="result-rating">★ {{ movie.rating_kp }}</span> }
                    </div>
                    @if (movie.genres && movie.genres.length) {
                      <div class="result-genres">{{ movie.genres.slice(0, 3).join(', ') }}</div>
                    }
                  </div>
                  <button
                    type="button"
                    class="btn-add"
                    (click)="add(movie)"
                    [disabled]="adding() === movie.kinopoisk_id"
                    [attr.aria-label]="'Добавить ' + movie.title"
                  >
                    {{ adding() === movie.kinopoisk_id ? '…' : '＋' }}
                  </button>
                </li>
              }
            </ul>
          }

          @if (searched() && results().length === 0 && !loading()) {
            <p class="search-empty">Ничего не найдено. Попробуйте другой запрос.</p>
          }
        </div>
      </div>
    </div>
  `,
  styleUrl: './add-movie-dialog.component.scss',
})
export class AddMovieDialogComponent {
  private readonly sfApi = inject(SharedFoldersApiService);

  readonly folderId = input.required<string>();
  readonly added    = output<void>();
  readonly cancel   = output<void>();

  query   = '';
  readonly loading  = signal(false);
  readonly adding   = signal<number | null>(null);
  readonly results  = signal<MovieMetadata[]>([]);
  readonly error    = signal<string | null>(null);
  readonly searched = signal(false);

  readonly isUrl = computed(() => this.query.includes('kinopoisk.ru'));

  search(): void {
    const q = this.query.trim();
    if (!q) return;
    this.loading.set(true);
    this.error.set(null);
    this.results.set([]);

    this.sfApi.searchMovies(this.folderId(), q).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.searched.set(true);
        const data = res.data;
        if (data.auto_confirm && data.movie) {
          this.addById(data.movie.kinopoisk_id!);
          return;
        }
        this.results.set(data.results ?? []);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Не удалось выполнить поиск. Проверьте запрос.');
      },
    });
  }

  add(movie: MovieMetadata): void {
    if (!movie.kinopoisk_id) return;
    this.addById(movie.kinopoisk_id);
  }

  private addById(id: number): void {
    this.adding.set(id);
    this.sfApi.addMovie(this.folderId(), id).subscribe({
      next: () => { this.adding.set(null); this.added.emit(); },
      error: () => { this.adding.set(null); this.error.set('Не удалось добавить фильм. Попробуйте снова.'); },
    });
  }
}
