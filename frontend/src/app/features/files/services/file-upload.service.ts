import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpEventType, HttpEvent } from '@angular/common/http';
import { Observable, from, of, switchMap, tap, throwError } from 'rxjs';
import { FilesApiService } from '../../../core/api/files-api.service';
import { SharedFoldersApiService } from '../../../core/api/shared-folders-api.service';
import { AuthStateService } from '../../../core/auth/auth-state.service';
import { VideoThumbnailService, GeneratedThumbnail } from './video-thumbnail.service';
import { InitUploadRequest, InitUploadResponse } from '../../../shared/models/api.models';
import { PLAN_FILE_LIMITS } from '../../../shared/constants/limits';

export interface UploadOptions {
  sharedFolderId?: string;
}

export interface UploadState {
  phase: 'idle' | 'init' | 'uploading' | 'completing' | 'done' | 'error';
  progress: number;
  fileId: string | null;
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class FileUploadService {
  private readonly filesApi         = inject(FilesApiService);
  private readonly sfApi            = inject(SharedFoldersApiService);
  private readonly http             = inject(HttpClient);
  private readonly authState        = inject(AuthStateService);
  private readonly thumbnailService = inject(VideoThumbnailService);

  private readonly _state = signal<UploadState>({
    phase: 'idle', progress: 0, fileId: null, error: null,
  });

  readonly state = this._state.asReadonly();

  upload(file: File, options?: UploadOptions): Observable<string> {
    const plan = this.authState.plan() ?? 'free';
    const limitBytes = PLAN_FILE_LIMITS[plan] ?? PLAN_FILE_LIMITS['free'];
    if (file.size > limitBytes) {
      const limitMb = Math.round(limitBytes / 1024 / 1024);
      this._setState({ phase: 'error', progress: 0, fileId: null, error: `Размер файла превышает допустимый лимит для вашего тарифа (${limitMb} МБ)` });
      return throwError(() => new Error('FILE_SIZE_LIMIT_EXCEEDED'));
    }

    this._setState({ phase: 'init', progress: 0, fileId: null, error: null });

    const sfId = options?.sharedFolderId;
    const isVideo = file.type.startsWith('video/');
    const prep$: Observable<GeneratedThumbnail | null> = isVideo
      ? from(this.thumbnailService.generateFromFile(file).catch(() => null))
      : of(null);

    return prep$.pipe(
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

        const init$ = sfId
          ? this.sfApi.initUpload(sfId, initReq)
          : this.filesApi.initUpload(initReq);

        return init$.pipe(
          switchMap((initRes) => {
            if (initRes.result !== 'success') throw new Error(initRes.message);

            const fileId    = initRes.data.file.id;
            const thumbInfo: InitUploadResponse['thumbnail'] = initRes.data.thumbnail;
            this._setState({ phase: 'uploading', progress: 0, fileId });

            // Upload thumbnail synchronously before main file (ignore errors)
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
                  const progress = pe.total ? Math.round((100 * pe.loaded) / pe.total) : 0;
                  this._setState({ progress });
                }
              }),
              switchMap((event: HttpEvent<unknown>) => {
                if (event.type !== HttpEventType.Response) return of<string>();
                this._setState({ phase: 'completing', progress: 100 });
                const complete$ = sfId
                  ? this.sfApi.completeUpload(sfId, fileId, thumbInfo?.key)
                  : this.filesApi.completeUpload(fileId, thumbInfo?.key);
                return complete$.pipe(
                  tap((completeRes) => {
                    if (completeRes.result !== 'success') throw new Error(completeRes.message);
                    this._setState({ phase: 'done', fileId });
                    if (thumb?.objectUrl) URL.revokeObjectURL(thumb.objectUrl);
                  }),
                  switchMap(() => of(fileId)),
                );
              }),
            );
          }),
        );
      }),
    );
  }

  cancel(fileId: string): void {
    this.filesApi.cancelUpload(fileId).subscribe();
    this._setState({ phase: 'idle', progress: 0, fileId: null, error: null });
  }

  reset(): void {
    this._setState({ phase: 'idle', progress: 0, fileId: null, error: null });
  }

  private _setState(patch: Partial<UploadState>): void {
    this._state.update((s) => ({ ...s, ...patch }));
  }
}
