import {
  Component, input, output, ChangeDetectionStrategy,
} from '@angular/core';
import { SharedFolderFileItem, MovieMetadata } from '../../../../shared/models/api.models';
// @ts-ignore — AnyFile union is imported in parent; here we use SharedFolderFileItem directly

@Component({
  selector: 'app-movie-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="movies-grid" role="list">
      @for (file of files(); track file.id) {
        <div class="movie-card" role="listitem"
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
            @if (meta(file); as m) {
              <div class="movie-meta">
                @if (m.year) { <span>{{ m.year }}</span> }
                @if (m.rating_kp) { <span class="movie-rating">★ {{ m.rating_kp }}</span> }
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
          </div>
        </div>
      }
      @if (files().length === 0) {
        <div class="movies-empty">
          <span aria-hidden="true">🎬</span>
          <p>В папке нет фильмов</p>
          <button type="button" class="btn-add-first" (click)="addClick.emit()">+ Добавить фильм</button>
        </div>
      }
    </div>
  `,
  styleUrl: './movie-view.component.scss',
})
export class MovieViewComponent {
  readonly files      = input.required<SharedFolderFileItem[]>();
  readonly addClick   = output<void>();
  readonly fileClick  = output<SharedFolderFileItem>();

  meta(file: SharedFolderFileItem): MovieMetadata | null {
    return (file as any).custom_metadata ?? null;
  }

  poster(file: SharedFolderFileItem): string | null {
    return this.meta(file)?.poster_url ?? file.link_image_url ?? null;
  }
}
