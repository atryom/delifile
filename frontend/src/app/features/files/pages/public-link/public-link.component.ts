import { Component, inject, signal, computed, OnInit, input, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FilesApiService } from '../../../../core/api/files-api.service';
import { formatSize } from '../../../../shared/utils/format';
import { classifyMimeType } from '../../../../shared/utils/file';
import { AuthStateService } from '../../../../core/auth/auth-state.service';

@Component({
  selector: 'app-public-link',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule, RouterLink],
  templateUrl: './public-link.component.html',
  styleUrl: './public-link.component.scss',
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
    view_url?: string | null;
    link_url?: string | null;
    link_title?: string | null;
    link_description?: string | null;
    link_image_url?: string | null;
    link_site_name?: string | null;
  } | null>(null);

  readonly isVideo = computed(() => (this.fileInfo()?.mime_type ?? '').startsWith('video/'));
  readonly isAudio = computed(() => (this.fileInfo()?.mime_type ?? '').startsWith('audio/'));
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
    const info = this.fileInfo();
    const type = classifyMimeType(info?.content_kind, info?.mime_type);
    const ICONS: Record<string, string> = { image: '🖼️', video: '🎬', audio: '🎵', pdf: '📄' };
    return ICONS[type] ?? '📎';
  }

  formatSize(bytes: number): string { return formatSize(bytes, 'en'); }
}
