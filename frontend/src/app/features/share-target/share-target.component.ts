import {
  ChangeDetectionStrategy, Component, OnInit, inject, signal, computed,
} from '@angular/core';
import { Router } from '@angular/router';
import { switchMap, of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { AuthStateService } from '../../core/auth/auth-state.service';
import { FileUploadService } from '../files/services/file-upload.service';
import { UrlFilesApiService } from '../../core/api/url-files-api.service';
import { FilesApiService } from '../../core/api/files-api.service';

interface ShareMeta {
  title: string;
  text: string;
  url: string;
  fileCount: number;
}

type Phase = 'loading' | 'need-auth' | 'files' | 'url' | 'uploading' | 'saving' | 'done' | 'error' | 'empty';

const SHARE_CACHE = 'share-target-v1';

@Component({
  selector: 'app-share-target',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule],
  template: `
    <div class="st-page">
      <div class="st-card">

        @if (phase() === 'loading') {
          <div class="st-center">
            <div class="st-spinner"></div>
            <p class="st-hint">{{ 'share_target.loading' | translate }}</p>
          </div>
        }

        @if (phase() === 'need-auth') {
          <div class="st-center">
            <span class="st-auth-icon">🔒</span>
            <h2 class="st-title" style="text-align:center">{{ 'share_target.need_auth' | translate }}</h2>
            <p class="st-hint">{{ 'share_target.need_auth_hint' | translate }}</p>
            <button class="st-btn st-btn--primary" (click)="goLogin()">
              {{ 'share_target.login_btn' | translate }}
            </button>
          </div>
        }

        @if (phase() === 'files') {
          <h2 class="st-title">{{ 'share_target.title_files' | translate }}</h2>
          <ul class="st-file-list">
            @for (f of sharedFiles(); track f.name) {
              <li class="st-file-item">
                <span class="st-file-icon">📄</span>
                <span class="st-file-info">
                  <span class="st-file-name">{{ f.name }}</span>
                  <span class="st-file-size">{{ formatSize(f.size) }}</span>
                </span>
              </li>
            }
          </ul>
          <div class="st-actions">
            <button class="st-btn st-btn--primary" (click)="upload()">
              {{ 'share_target.upload_btn' | translate }}
            </button>
            <button class="st-btn st-btn--ghost" (click)="cancel()">
              {{ 'common.cancel' | translate }}
            </button>
          </div>
        }

        @if (phase() === 'url') {
          <h2 class="st-title">{{ 'share_target.title_url' | translate }}</h2>

          @if (sharedDescription()) {
            <div class="st-desc-preview">
              <span class="st-desc-label">{{ 'share_target.description_label' | translate }}</span>
              <p class="st-desc-text">{{ sharedDescription() }}</p>
            </div>
          }

          <div class="st-url-box">
            <span class="st-url-text">{{ sharedUrl() }}</span>
          </div>

          <div class="st-actions">
            <button class="st-btn st-btn--primary" (click)="saveUrl()">
              {{ 'share_target.save_url' | translate }}
            </button>
            @if (isDeliFileLink()) {
              <button class="st-btn st-btn--secondary" (click)="openDeliLink()">
                {{ 'share_target.open_link' | translate }}
              </button>
            } @else {
              <button class="st-btn st-btn--ghost" (click)="copyUrl()">
                {{ copied() ? ('share_target.copied' | translate) : ('share_target.copy_url' | translate) }}
              </button>
            }
            <button class="st-btn st-btn--ghost" (click)="cancel()">
              {{ 'common.cancel' | translate }}
            </button>
          </div>
        }

        @if (phase() === 'saving') {
          <div class="st-center">
            <div class="st-spinner"></div>
            <p class="st-hint">{{ 'share_target.saving_url' | translate }}</p>
          </div>
        }

        @if (phase() === 'uploading') {
          <h2 class="st-title">{{ 'share_target.uploading' | translate }}</h2>
          <div class="st-progress-wrap">
            <div class="st-progress-bar" [style.width.%]="uploadState().progress"></div>
          </div>
          <p class="st-hint">{{ uploadState().progress }}%
            @if (sharedFiles().length > 1) {
              &nbsp;·&nbsp; {{ 'share_target.file_n_of_m' | translate : { n: uploadIndex() + 1, m: sharedFiles().length } }}
            }
          </p>
        }

        @if (phase() === 'done') {
          <div class="st-center">
            <span class="st-done-icon">✅</span>
            <p class="st-done-text">{{ 'share_target.done' | translate }}</p>
            <button class="st-btn st-btn--primary" (click)="goToFiles()">
              {{ 'share_target.go_to_files' | translate }}
            </button>
          </div>
        }

        @if (phase() === 'error') {
          <div class="st-center">
            <span class="st-err-icon">⚠️</span>
            <p class="st-err-text">{{ 'share_target.error' | translate }}</p>
            <button class="st-btn st-btn--ghost" (click)="cancel()">
              {{ 'share_target.go_to_files' | translate }}
            </button>
          </div>
        }

        @if (phase() === 'empty') {
          <div class="st-center">
            <p class="st-hint">{{ 'share_target.empty' | translate }}</p>
            <button class="st-btn st-btn--ghost" (click)="cancel()">
              {{ 'share_target.go_to_files' | translate }}
            </button>
          </div>
        }

      </div>
    </div>
  `,
  styles: [`
    .st-page {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 40px 16px;
      min-height: 60vh;
    }
    .st-card {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 32px 28px;
      width: 100%;
      max-width: 480px;
      box-shadow: 0 2px 12px rgba(0,0,0,.06);
    }
    .st-title {
      font-size: 1.1rem;
      font-weight: 600;
      color: #1f2937;
      margin: 0 0 20px;
    }
    .st-center {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      text-align: center;
    }
    .st-auth-icon { font-size: 2.5rem; }
    .st-spinner {
      width: 36px; height: 36px;
      border: 3px solid #e5e7eb;
      border-top-color: #6366f1;
      border-radius: 50%;
      animation: spin .7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .st-hint { font-size: .85rem; color: #9ca3af; margin: 0; }

    .st-desc-preview {
      background: #f0f4ff; border: 1px solid #c7d2fe;
      border-radius: 8px; padding: 10px 14px; margin-bottom: 12px;
    }
    .st-desc-label { font-size: .72rem; font-weight: 600; color: #6366f1; text-transform: uppercase; letter-spacing: .04em; display: block; margin-bottom: 4px; }
    .st-desc-text  { font-size: .85rem; color: #374151; margin: 0; line-height: 1.4; }

    .st-file-list { list-style: none; margin: 0 0 24px; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .st-file-item {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 14px; border: 1px solid #e5e7eb; border-radius: 8px;
    }
    .st-file-icon { font-size: 1.4rem; flex-shrink: 0; }
    .st-file-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .st-file-name { font-size: .9rem; font-weight: 500; color: #1f2937; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .st-file-size { font-size: .78rem; color: #9ca3af; }

    .st-url-box {
      background: #f8f9fa; border: 1px solid #e5e7eb; border-radius: 8px;
      padding: 12px 14px; margin-bottom: 20px; word-break: break-all;
    }
    .st-url-text { font-size: .85rem; color: #374151; }

    .st-actions { display: flex; flex-direction: column; gap: 10px; }
    .st-btn {
      padding: 10px 20px; border-radius: 8px; font-size: .9rem; font-weight: 500;
      cursor: pointer; border: none; transition: opacity .15s; text-align: center;
    }
    .st-btn:hover { opacity: .85; }
    .st-btn--primary   { background: #6366f1; color: #fff; }
    .st-btn--secondary { background: #f0f0ff; color: #6366f1; border: 1px solid #6366f1; }
    .st-btn--ghost     { background: transparent; border: 1px solid #d1d5db; color: #6b7280; }

    .st-progress-wrap { height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden; margin-bottom: 8px; }
    .st-progress-bar  { height: 100%; background: #6366f1; transition: width .2s; }

    .st-done-icon, .st-err-icon { font-size: 2.5rem; }
    .st-done-text { font-size: 1rem; font-weight: 500; color: #1f2937; margin: 0; }
    .st-err-text  { font-size: .9rem; color: #ef4444; margin: 0; }
  `],
})
export class ShareTargetComponent implements OnInit {
  private readonly router       = inject(Router);
  private readonly authState    = inject(AuthStateService);
  private readonly uploadSvc    = inject(FileUploadService);
  private readonly urlFilesApi  = inject(UrlFilesApiService);
  private readonly filesApi     = inject(FilesApiService);

  readonly phase              = signal<Phase>('loading');
  readonly sharedFiles        = signal<File[]>([]);
  readonly sharedUrl          = signal<string>('');
  readonly sharedDescription  = signal<string>('');
  readonly uploadIndex        = signal(0);
  readonly copied             = signal(false);
  readonly uploadState        = this.uploadSvc.state;

  readonly isDeliFileLink = computed(() =>
    /delifile\.ru\/link\/|\/link\/[a-zA-Z0-9]/.test(this.sharedUrl())
  );

  async ngOnInit(): Promise<void> {
    if (!this.authState.isAuthenticated()) {
      this.phase.set('need-auth');
      return;
    }
    await this.loadFromCache();
  }

  private async loadFromCache(): Promise<void> {
    if (!('caches' in window)) { this.phase.set('empty'); return; }

    try {
      const cache    = await caches.open(SHARE_CACHE);
      const metaResp = await cache.match('/_share/meta');
      if (!metaResp) { this.phase.set('empty'); return; }

      const meta: ShareMeta = await metaResp.json();

      if (meta.fileCount > 0) {
        const files: File[] = [];
        for (let i = 0; i < meta.fileCount; i++) {
          const resp = await cache.match(`/_share/file/${i}`);
          if (!resp) continue;
          const blob = await resp.blob();
          const name = decodeURIComponent(resp.headers.get('X-File-Name') || `file-${i}`);
          const type = resp.headers.get('Content-Type') || blob.type || 'application/octet-stream';
          files.push(new File([blob], name, { type }));
        }
        this.sharedFiles.set(files);
        this.phase.set(files.length ? 'files' : 'empty');
        return;
      }

      // ── URL / text parsing ──────────────────────────────────────────────
      const rawUrl  = (meta.url  || '').trim();
      const rawText = (meta.text || '').trim();

      if (rawUrl && this.isValidUrl(rawUrl)) {
        // Clean URL in url field; text might be a description
        this.sharedUrl.set(rawUrl);
        this.sharedDescription.set(rawText);
        this.phase.set('url');
        return;
      }

      // URL is missing or not valid — try to extract from combined text
      const combined = rawUrl || rawText;
      if (combined) {
        const { url, description } = this.extractUrlFromText(combined);
        if (url) {
          this.sharedUrl.set(url);
          this.sharedDescription.set(description);
          this.phase.set('url');
          return;
        }
      }

      this.phase.set('empty');
    } catch {
      this.phase.set('error');
    }
  }

  // ── Files upload ─────────────────────────────────────────────────────────

  upload(): void {
    const files = this.sharedFiles();
    if (!files.length) return;
    this.phase.set('uploading');
    this.uploadIndex.set(0);
    this.uploadSvc.reset();
    this.uploadNext(files, 0);
  }

  private uploadNext(files: File[], index: number): void {
    if (index >= files.length) {
      this.clearCache();
      this.phase.set('done');
      return;
    }
    this.uploadIndex.set(index);
    this.uploadSvc.upload(files[index]).subscribe({
      next:  () => this.uploadNext(files, index + 1),
      error: () => this.phase.set('error'),
    });
  }

  // ── URL saving ───────────────────────────────────────────────────────────

  saveUrl(): void {
    this.phase.set('saving');
    const description = this.sharedDescription();

    this.urlFilesApi.create(this.sharedUrl()).pipe(
      switchMap(res => {
        const fileId = res.data?.file?.id;
        if (fileId && description) {
          return this.filesApi.updateDescription(fileId, description);
        }
        return of(null);
      }),
    ).subscribe({
      next:  () => { this.clearCache(); this.phase.set('done'); },
      error: (err) => {
        console.error('[ShareTarget] save URL error:', err);
        this.phase.set('error');
      },
    });
  }

  openDeliLink(): void {
    try {
      const path = new URL(this.sharedUrl()).pathname;
      this.clearCache();
      this.router.navigateByUrl(path);
    } catch {
      window.open(this.sharedUrl(), '_blank');
    }
  }

  copyUrl(): void {
    navigator.clipboard.writeText(this.sharedUrl()).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    }).catch(() => {});
  }

  // ── Navigation ───────────────────────────────────────────────────────────

  goLogin(): void {
    this.router.navigate(['/login'], { queryParams: { returnUrl: '/share-target' } });
  }

  cancel():    void { this.clearCache(); this.router.navigate(['/files']); }
  goToFiles(): void { this.router.navigate(['/files']); }

  // ── Utilities ────────────────────────────────────────────────────────────

  formatSize(bytes: number): string {
    if (bytes < 1024)       return `${bytes} Б`;
    if (bytes < 1_048_576)  return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / 1_048_576).toFixed(1)} МБ`;
  }

  private isValidUrl(s: string): boolean {
    try { return /^https?:\/\//.test(new URL(s).href); } catch { return false; }
  }

  /**
   * Extracts the last http(s) URL from a mixed text string.
   * Text before the URL becomes the description.
   * Handles cases like: "Заголовок страницы https://example.com/path"
   */
  private extractUrlFromText(text: string): { url: string; description: string } {
    const matches = [...text.matchAll(/https?:\/\/[^\s]+/g)];
    if (!matches.length) return { url: '', description: text };

    const last        = matches[matches.length - 1];
    const url         = last[0].replace(/[.,;!?'"»]+$/, ''); // strip trailing punctuation
    const description = text.slice(0, last.index).trim();
    return { url, description };
  }

  private clearCache(): void {
    if (!('caches' in window)) return;
    caches.open(SHARE_CACHE)
      .then(c => c.keys().then(ks => ks.forEach(k => c.delete(k))))
      .catch(() => {});
  }
}
