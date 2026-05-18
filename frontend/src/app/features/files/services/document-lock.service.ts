import { Injectable, inject, signal, computed } from '@angular/core';
import { interval, Subscription, EMPTY } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { DocumentsApiService } from '../../../core/api/documents-api.service';
import { LockLostReason } from '../../../shared/models/api.models';

export type LockState = 'idle' | 'acquiring' | 'held' | 'lost_expired' | 'lost_takeover' | 'readonly';

const HEARTBEAT_INTERVAL_MS = 60_000;

@Injectable({ providedIn: 'root' })
export class DocumentLockService {
  private readonly docsApi = inject(DocumentsApiService);

  private heartbeatSub: Subscription | null = null;
  private currentFileId: string | null = null;

  readonly lockState = signal<LockState>('idle');
  readonly takenOverBy = signal<string | null>(null);

  readonly isEditing = computed(
    () => this.lockState() === 'held'
  );

  async acquire(fileId: string): Promise<boolean> {
    this.currentFileId = fileId;
    this.lockState.set('acquiring');

    return new Promise(resolve => {
      this.docsApi.acquireLock(fileId).subscribe({
        next: () => {
          this.lockState.set('held');
          this.startHeartbeat(fileId);
          resolve(true);
        },
        error: () => {
          this.lockState.set('readonly');
          resolve(false);
        },
      });
    });
  }

  release(fileId: string): void {
    this.stopHeartbeat();
    this.docsApi.releaseLock(fileId).subscribe({ error: () => {} });
    this.lockState.set('idle');
    this.currentFileId = null;
  }

  takeover(fileId: string): Promise<boolean> {
    return new Promise(resolve => {
      this.docsApi.takeover(fileId).subscribe({
        next: () => {
          this.lockState.set('held');
          this.startHeartbeat(fileId);
          resolve(true);
        },
        error: () => resolve(false),
      });
    });
  }

  reacquire(fileId: string): Promise<boolean> {
    this.stopHeartbeat();
    return this.acquire(fileId);
  }

  reset(): void {
    this.stopHeartbeat();
    this.lockState.set('idle');
    this.takenOverBy.set(null);
    this.currentFileId = null;
  }

  private startHeartbeat(fileId: string): void {
    this.stopHeartbeat();

    this.heartbeatSub = interval(HEARTBEAT_INTERVAL_MS)
      .pipe(
        switchMap(() =>
          this.docsApi.heartbeat(fileId).pipe(
            catchError(err => {
              this.handleLockLost(err);
              return EMPTY;
            })
          )
        )
      )
      .subscribe();
  }

  private stopHeartbeat(): void {
    this.heartbeatSub?.unsubscribe();
    this.heartbeatSub = null;
  }

  private handleLockLost(err: unknown): void {
    this.stopHeartbeat();

    const body = (err as { error?: { data?: { reason?: LockLostReason; lockedBy?: { name?: string } } } })
      ?.error?.data;

    const reason = body?.reason;

    if (reason === 'LOCK_TAKEN_OVER') {
      this.takenOverBy.set(body?.lockedBy?.name ?? 'другой пользователь');
      this.lockState.set('lost_takeover');
    } else {
      this.lockState.set('lost_expired');
    }
  }
}
