import { Injectable, signal, computed, inject } from '@angular/core';
import { AuthStateService } from '../auth/auth-state.service';

export type BrowserNotifPermission = 'default' | 'granted' | 'denied';

export interface InAppNotification {
  id: string;
  title: string;
  body: string;
  route?: string;
  timestamp: number;
}

const NOTIF_FILES_KEY     = 'fs_notif_file_ids';
const NOTIF_CONTACTS_KEY  = 'fs_notif_contact_ids';
const BANNER_DISMISSED    = 'fs_notif_banner_dismissed';
const MAX_TRACKED_IDS     = 300;

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly authState = inject(AuthStateService);

  private readonly _permission = signal<BrowserNotifPermission>(this._readPermission());
  private readonly _bannerDismissed = signal(sessionStorage.getItem(BANNER_DISMISSED) === '1');
  private readonly _queue = signal<InAppNotification[]>([]);

  // Sets of already-notified IDs so we never repeat
  private _notifiedFileIds     = new Set<string>(this._loadIds(NOTIF_FILES_KEY));
  private _notifiedContactIds  = new Set<string>(this._loadIds(NOTIF_CONTACTS_KEY));

  readonly permission     = this._permission.asReadonly();
  readonly queue          = this._queue.asReadonly();

  /**
   * Show the "Enable notifications" bar when:
   * - user is logged in and wants notifications (backend setting)
   * - browser hasn't been asked yet (permission === 'default')
   * - user hasn't dismissed the bar this session
   */
  readonly showBanner = computed(() => {
    const user = this.authState.user();
    if (!user) return false;
    if (!(user.notifications_enabled ?? true)) return false;
    if (this._bannerDismissed()) return false;
    return this._permission() === 'default';
  });

  readonly isGranted = computed(() => this._permission() === 'granted');

  async requestPermission(): Promise<BrowserNotifPermission> {
    if (!('Notification' in window)) return 'denied';
    const result = await Notification.requestPermission();
    this._permission.set(result as BrowserNotifPermission);
    return result as BrowserNotifPermission;
  }

  dismissBanner(): void {
    this._bannerDismissed.set(true);
    try { sessionStorage.setItem(BANNER_DISMISSED, '1'); } catch { /* ignore */ }
  }

  // ─── ID tracking ─────────────────────────────────────────────────────────

  hasNotifiedFile(id: string): boolean {
    return this._notifiedFileIds.has(id);
  }

  markFileNotified(id: string): void {
    this._notifiedFileIds.add(id);
    this._saveIds(NOTIF_FILES_KEY, this._notifiedFileIds);
  }

  hasNotifiedContact(id: string): boolean {
    return this._notifiedContactIds.has(id);
  }

  markContactNotified(id: string): void {
    this._notifiedContactIds.add(id);
    this._saveIds(NOTIF_CONTACTS_KEY, this._notifiedContactIds);
  }

  // ─── In-app toasts ────────────────────────────────────────────────────────

  show(title: string, body: string, route?: string): void {
    const user = this.authState.user();
    if (!user?.notifications_enabled) return;

    const note: InAppNotification = {
      id: crypto.randomUUID(),
      title,
      body,
      route,
      timestamp: Date.now(),
    };

    this._queue.update(q => [note, ...q].slice(0, 5)); // max 5 toasts

    if (this._permission() === 'granted' && 'Notification' in window) {
      try {
        new Notification(title, { body, icon: '/favicon.ico' });
      } catch { /* ignore */ }
    }
  }

  dismiss(id: string): void {
    this._queue.update(q => q.filter(n => n.id !== id));
  }

  dismissAll(): void {
    this._queue.set([]);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private _readPermission(): BrowserNotifPermission {
    if (!('Notification' in window)) return 'denied';
    return Notification.permission as BrowserNotifPermission;
  }

  private _loadIds(key: string): string[] {
    try {
      return JSON.parse(localStorage.getItem(key) ?? '[]');
    } catch {
      return [];
    }
  }

  private _saveIds(key: string, set: Set<string>): void {
    try {
      const arr = Array.from(set).slice(-MAX_TRACKED_IDS);
      localStorage.setItem(key, JSON.stringify(arr));
    } catch { /* ignore */ }
  }
}
