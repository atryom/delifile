import {
  Component, inject, signal, computed, input, OnInit, ChangeDetectionStrategy,
} from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpEventType } from '@angular/common/http';
import { Observable, switchMap, filter, map, first } from 'rxjs';
import { FileRequestsApiService } from '../../../../core/api/file-requests-api.service';
import { formatSize } from '../../../../shared/utils/format';

type PageState = 'loading' | 'active' | 'uploading' | 'success' | 'invalid';

interface QueueItem {
  file: File;
  status: 'queued' | 'uploading' | 'done' | 'error';
  errorMsg?: string;
}

@Component({
  selector: 'app-file-request-public',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage, FormsModule],
  templateUrl: './file-request-public.component.html',
  styleUrl: './file-request-public.component.scss',
})
export class FileRequestPublicComponent implements OnInit {
  readonly token = input.required<string>();

  private readonly api = inject(FileRequestsApiService);

  readonly state            = signal<PageState>('loading');
  readonly description      = signal('');
  readonly expiresAt        = signal<string | null>(null);
  readonly allowMultiple    = signal(false);
  readonly maxFileSizeBytes = signal<number | null>(null);
  readonly isDragOver       = signal(false);
  readonly selectedFile     = signal<File | null>(null);
  readonly fileQueue        = signal<QueueItem[]>([]);
  readonly progress         = signal(0);
  readonly error            = signal<string | null>(null);
  readonly senderName       = signal('');
  readonly senderEmail      = signal('');

  readonly hasQueuedItems = computed(() => this.fileQueue().some(i => i.status === 'queued'));
  readonly allDone        = computed(() => this.fileQueue().length > 0 && this.fileQueue().every(i => i.status === 'done' || i.status === 'error'));
  readonly doneCount      = computed(() => this.fileQueue().filter(i => i.status === 'done').length);

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
        this.allowMultiple.set(res.data.allow_multiple ?? false);
        this.maxFileSizeBytes.set(res.data.limits?.max_file_size_bytes ?? null);
        this.state.set('active');
      },
      error: () => this.state.set('invalid'),
    });
  }

  private sizeError(file: File): string | null {
    const max = this.maxFileSizeBytes();
    if (max !== null && file.size > max) {
      return `Файл слишком большой. Максимальный размер: ${formatSize(max)}.`;
    }
    return null;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!files.length) return;

    if (this.allowMultiple()) {
      this.enqueue(files);
    } else {
      const err = this.sizeError(files[0]);
      if (err) { this.error.set(err); return; }
      this.selectedFile.set(files[0]);
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
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (!files.length) return;

    if (this.allowMultiple()) {
      this.enqueue(files);
    } else {
      const err = this.sizeError(files[0]);
      if (err) { this.error.set(err); return; }
      this.selectedFile.set(files[0]);
      this.error.set(null);
    }
  }

  private enqueue(files: File[]): void {
    this.error.set(null);
    const valid: File[] = [];
    let oversized = 0;

    for (const f of files) {
      if (this.sizeError(f)) {
        oversized++;
      } else {
        valid.push(f);
      }
    }

    if (oversized > 0) {
      const max = this.maxFileSizeBytes()!;
      this.error.set(`${oversized} файл(ов) пропущено — превышает допустимый размер (макс. ${formatSize(max)}).`);
    }

    if (valid.length) {
      this.fileQueue.update(q => [...q, ...valid.map(f => ({ file: f, status: 'queued' as const }))]);
    }
  }

  removeFromQueue(index: number): void {
    this.fileQueue.update(q => q.filter((_, i) => i !== index));
  }

  send(): void {
    if (this.allowMultiple()) {
      this.sendQueue();
    } else {
      this.sendSingle();
    }
  }

  private sendSingle(): void {
    const file = this.selectedFile();
    if (!file || this.state() !== 'active') return;

    const err = this.sizeError(file);
    if (err) { this.error.set(err); return; }

    this.state.set('uploading');
    this.progress.set(0);
    this.error.set(null);

    this.doUpload(file).subscribe({
      next: () => this.state.set('success'),
      error: (msg: string) => { this.error.set(msg); this.state.set('active'); },
    });
  }

  private sendQueue(): void {
    if (!this.hasQueuedItems() || this.state() !== 'active') return;
    this.state.set('uploading');
    this.error.set(null);
    this.uploadNext();
  }

  private uploadNext(): void {
    const idx = this.fileQueue().findIndex(i => i.status === 'queued');
    if (idx === -1) {
      this.state.set('active');
      return;
    }

    this.progress.set(0);
    this.fileQueue.update(q => q.map((item, i) => i === idx ? { ...item, status: 'uploading' as const } : item));

    this.doUpload(this.fileQueue()[idx].file).subscribe({
      next: () => {
        this.fileQueue.update(q => q.map((item, i) => i === idx ? { ...item, status: 'done' as const } : item));
        this.uploadNext();
      },
      error: (msg: string) => {
        this.fileQueue.update(q => q.map((item, i) =>
          i === idx ? { ...item, status: 'error' as const, errorMsg: msg } : item,
        ));
        this.uploadNext();
      },
    });
  }

  private doUpload(file: File): Observable<void> {
    const payload = {
      original_name: file.name,
      size:          file.size,
      mime_type:     file.type || 'application/octet-stream',
      sender_name:   this.senderName() || undefined,
      sender_email:  this.senderEmail() || undefined,
    };

    return this.api.initUpload(this.token(), payload).pipe(
      switchMap(initRes => {
        if (initRes.result !== 'success') {
          throw new Error(initRes.message);
        }

        const uploadedFileId: string = initRes.data.file.id;
        const { url, headers } = initRes.data.upload;
        const thumbnailKey     = initRes.data.thumbnail?.key;

        return this.api.putToS3(url, file, headers).pipe(
          filter(event => {
            if (event.type === HttpEventType.UploadProgress) {
              const pe = event as { type: typeof HttpEventType.UploadProgress; loaded: number; total?: number };
              this.progress.set(pe.total ? Math.round((100 * pe.loaded) / pe.total) : 0);
            }
            return event.type === HttpEventType.Response;
          }),
          first(),
          switchMap(() => this.api.completeUpload(
            this.token(),
            this.allowMultiple() ? uploadedFileId : null,
            thumbnailKey,
          )),
          map(() => undefined as void),
        );
      }),
    );
  }

  clearDone(): void {
    this.fileQueue.update(q => q.filter(i => i.status !== 'done'));
  }

  formatExpiry(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }
}
