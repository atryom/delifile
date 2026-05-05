import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { Observable, switchMap, tap, throwError } from 'rxjs';
import { FilesApiService } from '../../../core/api/files-api.service';
import { AuthStateService } from '../../../core/auth/auth-state.service';

const PLAN_FILE_LIMITS: Record<string, number> = {
  free:   50  * 1024 * 1024,
  silver: 100 * 1024 * 1024,
  gold:   150 * 1024 * 1024,
};

export interface UploadState {
  phase: 'idle' | 'init' | 'uploading' | 'completing' | 'done' | 'error';
  progress: number;          // 0-100
  fileId: string | null;
  error: string | null;
}

/**
 * FileUploadService
 *
 * Implements the 3-step upload flow:
 *   1. POST /files/init-upload         → get S3 presigned URL + file ID
 *   2. PUT <presigned-url>             → direct upload to S3 with progress
 *   3. POST /files/complete-upload     → confirm upload, set file available
 *
 * Exposes reactive upload state via signal.
 */
@Injectable({ providedIn: 'root' })
export class FileUploadService {
  private readonly filesApi = inject(FilesApiService);
  private readonly http = inject(HttpClient);
  private readonly authState = inject(AuthStateService);

  private readonly _state = signal<UploadState>({
    phase: 'idle',
    progress: 0,
    fileId: null,
    error: null,
  });

  readonly state = this._state.asReadonly();

  /**
   * Execute the full 3-step upload for a given File object.
   * Returns an Observable that emits the final fileId on success.
   */
  upload(file: File): Observable<string> {
    // Client-side size check before making any requests
    const plan = this.authState.plan() ?? 'free';
    const limitBytes = PLAN_FILE_LIMITS[plan] ?? PLAN_FILE_LIMITS['free'];
    if (file.size > limitBytes) {
      const limitMb = Math.round(limitBytes / 1024 / 1024);
      this._setState({
        phase: 'error',
        progress: 0,
        fileId: null,
        error: `Размер файла превышает допустимый лимит для вашего тарифа (${limitMb} МБ)`,
      });
      return throwError(() => new Error('FILE_SIZE_LIMIT_EXCEEDED'));
    }

    this._setState({ phase: 'init', progress: 0, fileId: null, error: null });

    // Step 1 — init upload
    return this.filesApi.initUpload({
      original_name: file.name,
      size: file.size,
      mime_type: file.type || 'application/octet-stream',
    }).pipe(
      switchMap((initRes) => {
        if (initRes.result !== 'success') {
          throw new Error(initRes.message);
        }
        const fileId   = initRes.data.file.id;
        const uploadUrl = initRes.data.upload.url;
        const headers  = initRes.data.upload.headers;

        this._setState({ phase: 'uploading', progress: 0, fileId });

        // Step 2 — direct upload to S3 with progress tracking
        return this.http.put(uploadUrl, file, {
          headers,
          reportProgress: true,
          observe: 'events',
          withCredentials: false,
        }).pipe(
          tap((event) => {
            if (event.type === HttpEventType.UploadProgress) {
              const progress = event.total
                ? Math.round((100 * event.loaded) / event.total)
                : 0;
              this._setState({ progress });
            }
          }),
          // Wait for response event (upload complete)
          switchMap((event) => {
            if (event.type !== HttpEventType.Response) {
              return []; // keep waiting
            }

            this._setState({ phase: 'completing', progress: 100 });

            // Step 3 — confirm upload
            return this.filesApi.completeUpload(fileId).pipe(
              tap((completeRes) => {
                if (completeRes.result !== 'success') {
                  throw new Error(completeRes.message);
                }
                this._setState({ phase: 'done', fileId });
              }),
              switchMap(() => [fileId]),
            );
          }),
        );
      }),
    );
  }

  /** Cancel an in-progress upload. */
  cancel(fileId: string): void {
    this.filesApi.cancelUpload(fileId).subscribe();
    this._setState({ phase: 'idle', progress: 0, fileId: null, error: null });
  }

  /** Reset state back to idle. */
  reset(): void {
    this._setState({ phase: 'idle', progress: 0, fileId: null, error: null });
  }

  private _setState(patch: Partial<UploadState>): void {
    this._state.update((s) => ({ ...s, ...patch }));
  }
}
