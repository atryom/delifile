import { Component, inject, signal, OnInit, input, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { SharedFoldersApiService } from '../../../../core/api/shared-folders-api.service';
import { SharedFolder, SharedFolderAccessType, SharedFolderFileItem } from '../../../../shared/models/api.models';
import { AuthStateService } from '../../../../core/auth/auth-state.service';

@Component({
  selector: 'app-public-shared-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule, RouterLink, DatePipe],
  template: `
    <div class="page">
      @if (resolving()) {
        <div class="state-center">{{ 'shared_folders.public_link_resolving' | translate }}</div>
      }

      @if (!resolving() && invalid()) {
        <div class="state-center error">
          <p>{{ 'shared_folders.public_link_invalid' | translate }}</p>
        </div>
      }

      @if (!resolving() && folder()) {
        <div class="folder-view">
          @if (linkAllowSave() && !isAuthenticated()) {
            <div class="save-banner">
              <span>{{ 'shared_folders.public_link_save_banner' | translate }}</span>
              <a [routerLink]="['/login']" [queryParams]="{returnUrl: '/shared-link/' + token()}" class="btn-auth">{{ 'shared_folders.public_link_login' | translate }}</a>
              <a [routerLink]="['/register']" [queryParams]="{returnUrl: '/shared-link/' + token()}" class="btn-auth">{{ 'shared_folders.public_link_register' | translate }}</a>
            </div>
          }

          <h1>{{ folder()!.name }}</h1>
          <p class="access-info">
            Доступ: <strong>{{ linkAccessType() === 'view' ? 'Просмотр' : 'Редактирование' }}</strong>
          </p>

          @if (isAuthenticated()) {
            <a [routerLink]="['/shared-folders']" [queryParams]="{folder_id: folder()!.id}" class="btn-open">
              Открыть папку
            </a>
          }

          <!-- File list -->
          @if (filesLoading()) {
            <p class="files-loading">Загрузка файлов...</p>
          } @else if (files().length === 0) {
            <p class="files-empty">В папке нет файлов</p>
          } @else {
            <ul class="file-list" role="list">
              @for (file of files(); track file.id) {
                <li class="file-item">
                  @if (file.preview_url) {
                    <img [src]="file.preview_url" alt="" class="file-thumb" loading="lazy" />
                  } @else if (file.link_image_url) {
                    <img [src]="file.link_image_url" alt="" class="file-thumb" loading="lazy" />
                  } @else {
                    <div class="file-icon">{{ mimeIcon(file.mime_type) }}</div>
                  }
                  <div class="file-info">
                    <span class="file-name">{{ file.original_name }}</span>
                    <span class="file-meta">
                      @if (file.content_kind !== 'url_file') { {{ formatSize(file.size) }} · }
                      {{ file.uploaded_at | date:'d MMM y' }}
                    </span>
                  </div>
                  <div class="file-btns">
                    @if (file.content_kind === 'url_file' && file.link_url) {
                      <a [href]="file.link_url" target="_blank" rel="noopener noreferrer" class="btn-view" aria-label="Перейти по ссылке" title="Перейти по ссылке">🔗</a>
                    }
                    @if (file.content_kind !== 'url_file' && file.view_url) {
                      <a [href]="file.view_url" target="_blank" rel="noopener noreferrer" class="btn-view" aria-label="Просмотр" title="Просмотр">👁</a>
                      <a [href]="file.view_url" target="_blank" rel="noopener noreferrer" class="btn-view" [attr.download]="file.original_name" aria-label="Скачать" title="Скачать">⬇</a>
                    }
                  </div>
                </li>
              }
            </ul>
            @if (totalPages() > 1) {
              <div class="pagination">
                <button [disabled]="page() === 1" (click)="prevPage()" class="btn-page">←</button>
                <span>{{ page() }} / {{ totalPages() }}</span>
                <button [disabled]="page() === totalPages()" (click)="nextPage()" class="btn-page">→</button>
              </div>
            }
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page { max-width: 720px; margin: 60px auto; padding: 0 24px; }
    .state-center { color: #9ca3af; font-size: 1rem; padding: 60px 0; text-align: center; }
    .state-center.error { color: #dc2626; }
    .folder-view { }
    .save-banner {
      display: flex; align-items: center; gap: 12px; flex-wrap: wrap; justify-content: center;
      background: #ede9fe; border: 1px solid #c4b5fd; border-radius: 10px; padding: 14px 20px; margin-bottom: 24px;
      color: #5b21b6; font-size: 0.9rem;
    }
    .btn-auth { padding: 7px 16px; background: #6366f1; color: #fff; border-radius: 7px; text-decoration: none; font-size: 0.85rem; font-weight: 600; }
    .btn-auth:hover { background: #4f46e5; }
    h1 { font-size: 1.6rem; font-weight: 700; margin: 0 0 6px; }
    .access-info { color: #6b7280; font-size: 0.9rem; margin-bottom: 20px; }
    .btn-open { display: inline-block; padding: 9px 22px; background: #6366f1; color: #fff; border-radius: 9px; text-decoration: none; font-size: 0.92rem; font-weight: 600; margin-bottom: 24px; }
    .btn-open:hover { background: #4f46e5; }
    .files-loading, .files-empty { color: #9ca3af; text-align: center; padding: 30px 0; }
    .file-list { list-style: none; padding: 0; margin: 20px 0 0; display: flex; flex-direction: column; gap: 6px; }
    .file-item { display: flex; align-items: center; gap: 12px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 14px; }
    .file-thumb { width: 44px; height: 44px; object-fit: cover; border-radius: 6px; flex-shrink: 0; }
    .file-icon { width: 44px; height: 44px; background: #f3f4f6; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; flex-shrink: 0; }
    .file-info { flex: 1; min-width: 0; }
    .file-name { display: block; font-weight: 600; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .file-meta { display: block; font-size: 0.76rem; color: #9ca3af; margin-top: 2px; }
    .file-btns { display: flex; gap: 4px; flex-shrink: 0; }
    .btn-view { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 6px; background: #f3f4f6; text-decoration: none; font-size: 0.9rem; }
    .btn-view:hover { background: #e5e7eb; }
    .pagination { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 16px 0; font-size: 0.88rem; color: #6b7280; }
    .btn-page { padding: 5px 12px; border: 1px solid #e5e7eb; border-radius: 7px; background: #fff; cursor: pointer; }
    .btn-page:disabled { opacity: .4; cursor: not-allowed; }
  `],
})
export class PublicSharedLinkComponent implements OnInit {
  readonly token = input.required<string>();

  private readonly sfApi     = inject(SharedFoldersApiService);
  private readonly authState = inject(AuthStateService);
  private readonly router    = inject(Router);

  readonly resolving      = signal(true);
  readonly invalid        = signal(false);
  readonly folder         = signal<SharedFolder | null>(null);
  readonly linkAccessType = signal<SharedFolderAccessType>('view');
  readonly linkAllowSave  = signal(false);

  readonly files        = signal<SharedFolderFileItem[]>([]);
  readonly filesLoading = signal(false);
  readonly page         = signal(1);
  readonly totalPages   = signal(1);

  readonly isAuthenticated = this.authState.isAuthenticated;

  ngOnInit(): void {
    this.sfApi.resolveSharedLink(this.token()).subscribe({
      next: (res) => {
        this.resolving.set(false);
        this.folder.set(res.data.folder);
        this.linkAccessType.set(res.data.link.access_type);
        this.linkAllowSave.set(res.data.link.allow_save);

        if (this.isAuthenticated()) {
          this.router.navigate(['/folders'], { queryParams: { tab: 'shared', shared_folder_id: res.data.folder.id } });
          return;
        }

        this.loadFiles(1);
      },
      error: () => { this.resolving.set(false); this.invalid.set(true); },
    });
  }

  private loadFiles(pg: number): void {
    this.filesLoading.set(true);
    this.page.set(pg);
    this.sfApi.publicFiles(this.token(), pg).subscribe({
      next: (res) => {
        this.files.set(res.data.items);
        const p = res.data.pagination;
        this.totalPages.set(Math.ceil(p.total / p.per_page) || 1);
        this.filesLoading.set(false);
      },
      error: () => this.filesLoading.set(false),
    });
  }

  prevPage(): void { if (this.page() > 1) this.loadFiles(this.page() - 1); }
  nextPage(): void { if (this.page() < this.totalPages()) this.loadFiles(this.page() + 1); }

  mimeIcon(mime: string | null): string {
    if (!mime) return '📎';
    if (mime.startsWith('image/')) return '🖼️';
    if (mime.startsWith('video/')) return '🎬';
    if (mime.startsWith('audio/')) return '🎵';
    if (mime.includes('pdf')) return '📄';
    return '📎';
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
}
