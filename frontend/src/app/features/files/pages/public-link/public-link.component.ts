import { Component, inject, signal, OnInit, input } from '@angular/core';
import { NgIf } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { FilesApiService } from '../../../../core/api/files-api.service';

@Component({
  selector: 'app-public-link',
  standalone: true,
  imports: [NgIf, TranslateModule],
  template: `
    <div class="link-page">
      <div class="link-card">
        <div class="brand">
          <span>🗂</span>
          <span class="brand-name">DeliFile</span>
        </div>

        <!-- Loading -->
        <div class="state loading" *ngIf="status() === 'loading'">
          {{ 'files.public_link.resolving' | translate }}
        </div>

        <!-- Invalid -->
        <div class="state error" *ngIf="status() === 'invalid'">
          <span class="state-icon">🚫</span>
          <h2>{{ 'files.public_link.invalid' | translate }}</h2>
          <p>{{ 'files.public_link.invalid_desc' | translate }}</p>
        </div>

        <!-- Valid -->
        <div class="state ready" *ngIf="status() === 'ready'">
          <div class="file-icon">{{ fileIcon() }}</div>
          <h2 class="file-name">{{ fileInfo()?.original_name }}</h2>
          <p class="file-meta">
            {{ formatSize(fileInfo()?.size ?? 0) }}
            · {{ fileInfo()?.mime_type }}
          </p>
          <p class="link-expiry" *ngIf="expiresAt()">
            {{ 'files.public_link.expires' | translate:{ date: expiresAt() } }}
          </p>
          <button
            class="btn-download"
            (click)="download()"
            [disabled]="downloading()"
          >
            {{ downloading() ? ('files.public_link.downloading' | translate) : ('files.public_link.download' | translate) }}
          </button>
        </div>

        <!-- Download ready -->
        <div class="state ready" *ngIf="status() === 'downloaded'">
          <span class="state-icon">✅</span>
          <h2>{{ 'files.public_link.success' | translate }}</h2>
          <p>{{ 'files.public_link.manual' | translate }} <a [href]="downloadUrl()" target="_blank">{{ 'files.public_link.manual' | translate }}</a>.</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .link-page {
      min-height: 100vh;
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
    }
    .btn-download:hover:not(:disabled) { background: #4f46e5; }
    .btn-download:disabled { opacity: 0.6; cursor: not-allowed; }
  `],
})
export class PublicLinkComponent implements OnInit {
  readonly token = input.required<string>();

  private readonly filesApi = inject(FilesApiService);

  readonly status      = signal<'loading' | 'ready' | 'invalid' | 'downloaded'>('loading');
  readonly fileInfo    = signal<{ original_name: string; size: number; mime_type: string } | null>(null);
  readonly expiresAt   = signal<string | null>(null);
  readonly downloading = signal(false);
  readonly downloadUrl = signal<string | null>(null);

  ngOnInit(): void {
    this.filesApi.resolveLink(this.token()).subscribe({
      next: (res) => {
        this.fileInfo.set(res.data.file as any);
        this.expiresAt.set(
          res.data.link?.expires_at
            ? new Date(res.data.link.expires_at).toLocaleString()
            : null
        );
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
