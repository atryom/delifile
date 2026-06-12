import {
  Component, inject, signal, input, OnInit, ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpEventType } from '@angular/common/http';
import { FileRequestsApiService } from '../../../../core/api/file-requests-api.service';
import { formatSize } from '../../../../shared/utils/format';

type PageState = 'loading' | 'active' | 'uploading' | 'success' | 'invalid';

@Component({
  selector: 'app-file-request-public',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './file-request-public.component.html',
  styleUrl: './file-request-public.component.scss',
})
export class FileRequestPublicComponent implements OnInit {
  readonly token = input.required<string>();

  private readonly api = inject(FileRequestsApiService);

  readonly state        = signal<PageState>('loading');
  readonly description  = signal('');
  readonly expiresAt    = signal<string | null>(null);
  readonly isDragOver   = signal(false);
  readonly selectedFile = signal<File | null>(null);
  readonly progress     = signal(0);
  readonly error        = signal<string | null>(null);
  readonly senderName   = signal('');
  readonly senderEmail  = signal('');

  readonly formatSize = formatSize;

  ngOnInit(): void {
    this.api.resolve(this.token()).subscribe({
      next: res => {
        if (res.data.status !== 'pending') {
          this.state.set('invalid');
          return;
        }
        this.description.set(res.data.description ?? '');
        this.expiresAt.set(res.data.expires_at ?? null);
        this.state.set('active');
      },
      error: () => this.state.set('invalid'),
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (file) {
      this.selectedFile.set(file);
      this.error.set(null);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(true);
  }

  onDragLeave(): void {
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) {
      this.selectedFile.set(file);
      this.error.set(null);
    }
  }

  send(): void {
    const file = this.selectedFile();
    if (!file || this.state() !== 'active') return;

    this.state.set('uploading');
    this.progress.set(0);
    this.error.set(null);

    const payload = {
      original_name: file.name,
      size:          file.size,
      mime_type:     file.type || 'application/octet-stream',
      sender_name:   this.senderName() || undefined,
      sender_email:  this.senderEmail() || undefined,
    };

    this.api.initUpload(this.token(), payload).subscribe({
      next: initRes => {
        if (initRes.result !== 'success') {
          this.error.set(initRes.message);
          this.state.set('active');
          return;
        }

        const { url, headers } = initRes.data.upload;

        this.api.putToS3(url, file, headers).subscribe({
          next: event => {
            if (event.type === HttpEventType.UploadProgress) {
              const pe = event as { type: typeof HttpEventType.UploadProgress; loaded: number; total?: number };
              this.progress.set(pe.total ? Math.round((100 * pe.loaded) / pe.total) : 0);
            } else if (event.type === HttpEventType.Response) {
              this.api.completeUpload(this.token(), initRes.data.thumbnail?.key).subscribe({
                next: () => this.state.set('success'),
                error: () => {
                  this.error.set('Ошибка при завершении загрузки. Попробуйте снова.');
                  this.state.set('active');
                },
              });
            }
          },
          error: () => {
            this.error.set('Ошибка при загрузке файла. Попробуйте снова.');
            this.state.set('active');
          },
        });
      },
      error: err => {
        this.error.set(err?.error?.message ?? 'Не удалось инициализировать загрузку.');
        this.state.set('active');
      },
    });
  }

  formatExpiry(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }
}
