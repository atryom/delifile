import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse, InboxFile, InboxSharedFolder, InboxCount } from '../../shared/models/api.models';

@Injectable({ providedIn: 'root' })
export class InboxApiService {
  private readonly api = inject(ApiService);
  private static readonly DISMISSED_KEY = 'inbox_dismissed';

  readonly pendingCount = signal(0);
  private readonly dismissed = signal(+(globalThis.localStorage?.getItem(InboxApiService.DISMISSED_KEY) ?? '0'));
  readonly badgeCount = computed(() => Math.max(0, this.pendingCount() - this.dismissed()));

  getCount(): Observable<ApiResponse<InboxCount>> {
    return this.api.get('/inbox/count');
  }

  refreshPendingCount(): void {
    this.getCount().subscribe({
      next: res => {
        const total = (res.data as InboxCount).total ?? 0;
        this.pendingCount.set(total);
        if (this.dismissed() > total) {
          this.setDismissed(total);
        }
      },
      error: () => {},
    });
  }

  dismissBadge(): void {
    this.setDismissed(this.pendingCount());
  }

  private setDismissed(val: number): void {
    this.dismissed.set(val);
    try { localStorage.setItem(InboxApiService.DISMISSED_KEY, String(val)); } catch {}
  }

  getFiles(): Observable<ApiResponse<{ items: InboxFile[] }>> {
    return this.api.get('/inbox/files');
  }

  acceptFiles(ids: string[]): Observable<ApiResponse> {
    return this.api.post('/inbox/files/accept', { ids });
  }

  rejectFiles(ids: string[]): Observable<ApiResponse> {
    return this.api.post('/inbox/files/reject', { ids });
  }

  getSharedFolders(): Observable<ApiResponse<{ items: InboxSharedFolder[] }>> {
    return this.api.get('/inbox/shared-folders');
  }

  acceptSharedFolders(ids: string[]): Observable<ApiResponse> {
    return this.api.post('/inbox/shared-folders/accept', { ids });
  }

  rejectSharedFolders(ids: string[]): Observable<ApiResponse> {
    return this.api.post('/inbox/shared-folders/reject', { ids });
  }
}
