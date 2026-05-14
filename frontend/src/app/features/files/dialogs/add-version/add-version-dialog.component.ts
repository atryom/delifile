import { Component, ChangeDetectionStrategy, input, output, inject, signal } from '@angular/core';
import { HttpClient, HttpEventType, HttpEvent } from '@angular/common/http';
import { from, of, switchMap, tap } from 'rxjs';
import { Observable } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { FilesApiService, VersionInitResponse } from '../../../../core/api/files-api.service';
import { VideoThumbnailService, GeneratedThumbnail } from '../../services/video-thumbnail.service';
import { InitUploadRequest } from '../../../../shared/models/api.models';

type UploadPhase = 'idle' | 'init' | 'uploading' | 'completing' | 'done' | 'error';

@Component({
  selector: 'app-add-version-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule],
  template: `
    <div class="dialog-overlay" (click)="onOverlayClick()">
      <div class="dialog" (click)="$event.stopPropagation()" role="dialog" [attr.aria-label]="'files.versions.dialog_title' | translate">
        <div class="dialog-header">
          <h2>{{ 'files.versions.dialog_title' | translate }}</h2>
          <button class="dialog-close" (click)="onClose()" [disabled]="isUploading()" aria-label="Закрыть">✕</button>
        </div>

        <div class="dialog-body">
          @if (phase() === 'idle' || phase() === 'error') {
            <p class="hint">{{ 'files.versions.dialog_hint' | translate }}</p>

            <div
              class="drop-zone"
              [class.drag-over]="isDragOver()"
              (dragover)="onDragOver($event)"
              (dragleave)="isDragOver.set(false)"
              (drop)="onDrop($event)"
              (click)="fileInput.click()"
              role="button"
              tabindex="0"
              (keydown.enter)="fileInput.click()"
              (keydown.space)="fileInput.click()"
            >
              <svg width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span>{{ 'files.versions.drop_hint' | translate }}</span>
              <input
                #fileInput
                type="file"
                [accept]="acceptAttr()"
                class="hidden-input"
                (change)="onFileSelected($event)"
              />
            </div>

            @if (phase() === 'error') {
              <p class="error-msg" role="alert">{{ error() }}</p>
            }
          }

          @if (isUploading()) {
            <div class="progress-block">
              <p class="progress-label">{{ phaseLabel() }}</p>
              <div class="progress-bar-wrap" role="progressbar" [attr.aria-valuenow]="progress()" aria-valuemin="0" aria-valuemax="100">
                <div class="progress-bar" [style.width.%]="progress()"></div>
              </div>
              <span class="progress-pct">{{ progress() }}%</span>
            </div>
          }

          @if (phase() === 'done') {
            <p class="success-msg">{{ 'files.versions.upload_done' | translate }}</p>
          }
        </div>

        <div class="dialog-footer">
          @if (!isUploading() && phase() !== 'done') {
            <button class="btn-secondary" (click)="onClose()">{{ 'common.cancel' | translate }}</button>
          }
          @if (phase() === 'done') {
            <button class="btn-primary" (click)="closed.emit()">{{ 'common.close' | translate }}</button>
          }
        </div>
      </div>
    </div>
  `,
  styleUrl: './add-version-dialog.component.scss',
})
export class AddVersionDialogComponent {
  readonly fileId   = input.required<string>();
  readonly mimeType = input.required<string>();
  readonly closed   = output<void>();
  readonly uploaded = output<void>();

  private readonly filesApi = inject(FilesApiService);
  private readonly http     = inject(HttpClient);
  private readonly thumbSvc = inject(VideoThumbnailService);

  readonly phase     = signal<UploadPhase>('idle');
  readonly progress  = signal(0);
  readonly error     = signal<string | null>(null);
  readonly isDragOver = signal(false);

  isUploading(): boolean {
    const p = this.phase();
    return p === 'init' || p === 'uploading' || p === 'completing';
  }

  phaseLabel(): string {
    const p = this.phase();
    if (p === 'init')       return 'Подготовка...';
    if (p === 'uploading')  return 'Загрузка...';
    if (p === 'completing') return 'Завершение...';
    return '';
  }

  acceptAttr(): string {
    const m = this.mimeType();
    if (m.startsWith('image/')) return 'image/*';
    if (m.startsWith('video/')) return 'video/*';
    if (m.startsWith('audio/')) return 'audio/*';
    return '';
  }

  onOverlayClick(): void {
    if (!this.isUploading()) this.closed.emit();
  }

  onClose(): void {
    if (!this.isUploading()) this.closed.emit();
  }

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.isDragOver.set(true);
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.isDragOver.set(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) this.startUpload(file);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) this.startUpload(input.files[0]);
    input.value = '';
  }

  private startUpload(file: File): void {
    this.phase.set('init');
    this.progress.set(0);
    this.error.set(null);

    const isVideo = file.type.startsWith('video/');
    const prep$: Observable<GeneratedThumbnail | null> = isVideo
      ? from(this.thumbSvc.generateFromFile(file).catch(() => null))
      : of(null);

    prep$.pipe(
      switchMap((thumb: GeneratedThumbnail | null) => {
        const initReq: InitUploadRequest = {
          original_name: file.name,
          size: file.size,
          mime_type: file.type || 'application/octet-stream',
        };
        if (thumb) {
          initReq.thumbnail_name = thumb.file.name;
          initReq.thumbnail_size = thumb.blob.size;
          initReq.thumbnail_mime = 'image/jpeg';
        }

        return this.filesApi.initVersionUpload(this.fileId(), initReq).pipe(
          switchMap((initRes) => {
            if (initRes.result !== 'success') throw new Error(initRes.message);
            const versionId = initRes.data.version.id;
            const thumbInfo: VersionInitResponse['thumbnail'] = initRes.data.thumbnail;
            this.phase.set('uploading');

            const thumbUpload$: Observable<unknown> = thumb && thumbInfo
              ? this.http.put(thumbInfo.url, thumb.blob, { headers: thumbInfo.headers, withCredentials: false })
              : of(null);

            return thumbUpload$.pipe(
              switchMap(() => this.http.put(initRes.data.upload.url, file, {
                headers: initRes.data.upload.headers,
                reportProgress: true,
                observe: 'events',
                withCredentials: false,
              }) as Observable<HttpEvent<unknown>>),
              tap((event: HttpEvent<unknown>) => {
                if (event.type === HttpEventType.UploadProgress) {
                  const pe = event as { type: HttpEventType.UploadProgress; loaded: number; total?: number };
                  this.progress.set(pe.total ? Math.round(100 * pe.loaded / pe.total) : 0);
                }
              }),
              switchMap((event: HttpEvent<unknown>) => {
                if (event.type !== HttpEventType.Response) return of(null);
                this.phase.set('completing');
                return this.filesApi.completeVersionUpload(this.fileId(), versionId, thumbInfo?.key);
              }),
            );
          }),
        );
      }),
    ).subscribe({
      next: (res) => {
        if (res) {
          this.phase.set('done');
          this.uploaded.emit();
        }
      },
      error: (err: { error?: { message?: string }; message?: string }) => {
        this.phase.set('error');
        this.error.set(err?.error?.message ?? err?.message ?? 'Ошибка загрузки');
      },
    });
  }
}
