import { Component, inject, signal, OnInit, input, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FilesApiService } from '../../../../core/api/files-api.service';
import { AuthStateService } from '../../../../core/auth/auth-state.service';

@Component({
  selector: 'app-public-link',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule, RouterLink],
  template: `
    <div class="link-page">
      <div class="link-card">
        <div class="brand">
          <span><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                     class="lucide lucide-file-symlink-icon lucide-file-symlink"><path
            d="M4 11V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h7"/><path
            d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="m10 18 3-3-3-3"/></svg></span>
          <span class="brand-name">DeliFile</span>
        </div>

        @if (status() === 'loading') {
          <div class="state loading">{{ 'files.public_link.resolving' | translate }}</div>
        }

        @if (status() === 'invalid') {
          <div class="state error">
            <span class="state-icon">🚫</span>
            <h2>{{ 'files.public_link.invalid' | translate }}</h2>
            <p>{{ 'files.public_link.invalid_desc' | translate }}</p>
          </div>
        }

        @if (status() === 'ready') {
          <div class="state ready">
            @if (fileInfo()?.content_kind === 'url_file') {
              <!-- URL-ссылка -->
              <div class="url-card">
                @if (fileInfo()!.link_image_url) {
                  <img [src]="fileInfo()!.link_image_url!" alt="" class="url-card-img" loading="lazy" />
                }
                <div class="url-card-body">
                  @if (fileInfo()!.link_site_name) {
                    <p class="url-site">{{ fileInfo()!.link_site_name }}</p>
                  }
                  <h2 class="url-card-title">{{ fileInfo()!.original_name }}</h2>
                  @if (fileInfo()!.link_description) {
                    <p class="url-card-desc">{{ fileInfo()!.link_description }}</p>
                  }
                  @if (fileInfo()!.link_url) {
                    <a [href]="fileInfo()!.link_url!" target="_blank" rel="noopener noreferrer" class="url-open-btn">
                      {{ 'files.detail.open_link' | translate }}
                    </a>
                  }
                </div>
              </div>
            } @else {
              <!-- Обычный файл -->
              @if (fileInfo()?.preview_url) {
                <img [src]="fileInfo()!.preview_url!" alt="" class="file-preview-img" loading="lazy" />
              } @else {
                <div class="file-icon">{{ fileIcon() }}</div>
              }
              <h2 class="file-name">{{ fileInfo()?.original_name }}</h2>
              <p class="file-meta">
                {{ formatSize(fileInfo()?.size ?? 0) }}
                · {{ fileInfo()?.mime_type }}
              </p>
            }

            @if (expiresAt()) {
              <p class="link-expiry">{{ 'files.public_link.expires' | translate:{date: expiresAt()} }}</p>
            }

            @if (fileInfo()?.content_kind !== 'url_file') {
              <button class="btn-download" (click)="download()" [disabled]="downloading()">
                {{ downloading() ? ('files.public_link.downloading' | translate) : ('files.public_link.download' | translate) }}
              </button>
            }

            @if (allowSave() && isLoggedIn()) {
              <button class="btn-save" (click)="saveToAccount()" [disabled]="saving() || saved()">
                @if (saved()) {
                  ✅ {{ 'files.public_link.saved' | translate }}
                } @else if (saving()) {
                  {{ 'files.public_link.saving' | translate }}
                } @else {
                  💾 {{ 'files.public_link.save_to_account' | translate }}
                }
              </button>
              @if (saveError()) {
                <p class="save-error">{{ saveError() }}</p>
              }
            }

            @if (allowSave() && !isLoggedIn()) {
              <p class="save-hint">
                {{ 'files.public_link.save_login_hint' | translate }}
                <a routerLink="/login" class="login-link">{{ 'files.public_link.login_to_save' | translate }}</a>
              </p>
            }
          </div>
        }

        @if (status() === 'downloaded') {
          <div class="state ready">
            <span class="state-icon">✅</span>
            <h2>{{ 'files.public_link.success' | translate }}</h2>
            <p>{{ 'files.public_link.manual' | translate }} <a [href]="downloadUrl()" target="_blank">{{ 'files.public_link.manual' | translate }}</a>.</p>
            @if (allowSave() && isLoggedIn() && !saved()) {
              <button class="btn-save" (click)="saveToAccount()" [disabled]="saving()">
                {{ saving() ? ('files.public_link.saving' | translate) : ('💾 ' + ('files.public_link.save_to_account' | translate)) }}
              </button>
              @if (saveError()) {
                <p class="save-error">{{ saveError() }}</p>
              }
            }
            @if (saved()) {
              <p class="save-success">✅ {{ 'files.public_link.saved' | translate }}</p>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .link-page {
      min-height: 100vh;
      min-height: 100svh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #f0f4ff 0%, #faf5ff 100%);
      padding: 20px;
    }
    .link-card {
      background: #fff;
      border-radius: 18px;
      padding: 36px 40px;
      width: 440px;
      max-width: 100%;
      text-align: center;
      box-shadow: 0 8px 40px rgba(99,102,241,0.12);
    }
    .brand { display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 700; font-size: 1.1rem; margin-bottom: 28px; color: #1a1a2e; }
    .brand span:first-child { font-size: 1.5rem; }
    .brand-name { letter-spacing: -0.02em; }

    .state { display: flex; flex-direction: column; align-items: center; }
    .state-icon { font-size: 3rem; margin-bottom: 12px; display: block; }
    .loading { color: #9ca3af; font-size: 0.95rem; }
    .error h2 { color: #dc2626; margin: 0 0 8px; }
    .error p  { color: #6b7280; font-size: 0.9rem; }

    .url-card { width: 100%; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; margin-bottom: 12px; text-align: left; }
    .url-card-img { width: 100%; max-height: 180px; object-fit: cover; display: block; }
    .url-card-body { padding: 14px 16px; }
    .url-site { font-size: 0.72rem; color: #9ca3af; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.04em; }
    .url-card-title { font-size: 1rem; font-weight: 700; margin: 0 0 6px; color: #1f2937; word-break: break-word; }
    .url-card-desc { font-size: 0.83rem; color: #6b7280; margin: 0 0 10px; line-height: 1.5; }
    .url-open-btn { display: inline-block; padding: 7px 16px; background: #6366f1; color: #fff; border-radius: 7px; text-decoration: none; font-size: 0.84rem; font-weight: 600; }
    .url-open-btn:hover { background: #4f46e5; }

    .file-preview-img { width: 120px; height: 120px; object-fit: cover; border-radius: 14px; margin-bottom: 14px; }
    .file-icon { font-size: 3.5rem; margin-bottom: 14px; }
    .file-name { font-size: 1.1rem; font-weight: 700; margin: 0 0 8px; word-break: break-all; }
    .file-meta { font-size: 0.85rem; color: #9ca3af; margin: 0 0 12px; }
    .link-expiry { font-size: 0.8rem; color: #f59e0b; background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 4px 12px; margin-bottom: 20px; }

    .btn-download {
      width: 100%;
      padding: 14px;
      background: #6366f1;
      color: #fff;
      border: none;
      border-radius: 10px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
      margin-bottom: 10px;
    }
    .btn-download:hover:not(:disabled) { background: #4f46e5; }
    .btn-download:disabled { opacity: 0.6; cursor: not-allowed; }

    .btn-save {
      width: 100%;
      padding: 12px;
      background: #f0fdf4;
      color: #15803d;
      border: 1px solid #86efac;
      border-radius: 10px;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }
    .btn-save:hover:not(:disabled) { background: #dcfce7; }
    .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }

    .save-hint { font-size: 0.82rem; color: #9ca3af; margin-top: 10px; }
    .login-link { color: #6366f1; text-decoration: none; }
    .login-link:hover { text-decoration: underline; }
    .save-success { font-size: 0.88rem; color: #15803d; margin-top: 8px; }
    .save-error { font-size: 0.85rem; color: #dc2626; margin-top: 8px; }
  `],
})
export class PublicLinkComponent implements OnInit {
  readonly token = input.required<string>();

  private readonly filesApi  = inject(FilesApiService);
  private readonly authState = inject(AuthStateService);
  private readonly translate = inject(TranslateService);

  readonly status      = signal<'loading' | 'ready' | 'invalid' | 'downloaded'>('loading');
  readonly fileInfo    = signal<{
    content_kind?: string;
    original_name: string;
    size: number;
    mime_type: string;
    preview_url?: string | null;
    link_url?: string | null;
    link_title?: string | null;
    link_description?: string | null;
    link_image_url?: string | null;
    link_site_name?: string | null;
  } | null>(null);
  readonly expiresAt   = signal<string | null>(null);
  readonly allowSave   = signal(false);
  readonly downloading = signal(false);
  readonly downloadUrl = signal<string | null>(null);
  readonly saving      = signal(false);
  readonly saved       = signal(false);
  readonly saveError   = signal<string | null>(null);

  readonly isLoggedIn = this.authState.isAuthenticated;

  ngOnInit(): void {
    this.filesApi.resolveLink(this.token()).subscribe({
      next: (res) => {
        this.fileInfo.set(res.data.file as any);
        this.expiresAt.set(
          res.data.link?.expires_at
            ? new Date(res.data.link.expires_at).toLocaleString()
            : null
        );
        this.allowSave.set(res.data.link?.allow_save ?? false);
        this.status.set('ready');
      },
      error: () => this.status.set('invalid'),
    });
  }

  download(): void {
    this.downloading.set(true);
    this.filesApi.downloadViaLink(this.token()).subscribe({
      next: (res) => {
        const url = res.data.url;
        this.downloadUrl.set(url);
        window.open(url, '_blank');
        this.status.set('downloaded');
        this.downloading.set(false);
      },
      error: () => {
        this.downloading.set(false);
        this.status.set('invalid');
      },
    });
  }

  saveToAccount(): void {
    if (this.saving() || this.saved()) return;
    this.saving.set(true);
    this.saveError.set(null);
    this.filesApi.saveViaLink(this.token()).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.set(true);
      },
      error: (err: any) => {
        this.saving.set(false);
        const code = err?.data?.code;
        if (code === 'ALREADY_SAVED') {
          this.saved.set(true);
        } else {
          this.saveError.set(err?.message ?? this.translate.instant('files.public_link.save_error'));
        }
      },
    });
  }

  fileIcon(): string {
    const mime = this.fileInfo()?.mime_type ?? '';
    if (mime.startsWith('image/')) return '🖼️';
    if (mime.startsWith('video/')) return '🎬';
    if (mime.startsWith('audio/')) return '🎵';
    if (mime.includes('pdf'))      return '📄';
    return '📎';
  }

  formatSize(bytes: number): string {
    if (bytes < 1024)       return `${bytes} B`;
    if (bytes < 1024 ** 2)  return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3)  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  }
}
