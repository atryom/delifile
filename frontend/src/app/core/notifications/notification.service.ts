import { Injectable, signal, computed, inject } from '@angular/core';
import { AuthStateService } from '../auth/auth-state.service';

export type NotificationPermission = 'default' | 'granted' | 'denied';

export interface InAppNotification {
  id: string;
  title: string;
  body: string;
  /** Route to navigate when clicked */
  route?: string;
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly authState = inject(AuthStateService);

  private readonly _permission = signal<NotificationPermission>(
    this._readPermission()
  );

  private readonly _bannerDismissed = signal(
    sessionStorage.getItem('notif_banner_dismissed') === '1'
  );

  /** Pending in-app notifications shown as toasts */
  private readonly _queue = signal<InAppNotification[]>([]);

  readonly permission = this._permission.asReadonly();
  readonly queue = this._queue.asReadonly();

  /**
   * True when we should show the "enable notifications" banner:
   * - permission is 'default' (not yet asked)
   * - global notifications are enabled by the user setting
   */
  readonly showBanner = computed(() => {
    const user = this.authState.user();
    if (!user) return false;
    if (!(user.notifications_enabled ?? true)) return false;
    if (this._bannerDismissed()) return false;
    return this._permission() === 'default';
  });

  dismissBanner(): void {
    this._bannerDismissed.set(true);
    try { sessionStorage.setItem('notif_banner_dismissed', '1'); } catch { /* ignore */ }
  }

  readonly isGranted = computed(() => this._permission() === 'granted');

  /**
   * Request browser notification permission.
   * Returns the resulting permission status.
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      return 'denied';
    }
    const result = await Notification.requestPermission();
    this._permission.set(result as NotificationPermission);
    return result as NotificationPermission;
  }

  /**
   * Show a browser notification (if permission granted) and enqueue
   * an in-app notification for display in the UI.
   */
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

    this._queue.update(q => [note, ...q]);

    if (this._permission() === 'granted' && 'Notification' in window) {
      new Notification(title, { body, icon: '/favicon.ico' });
    }
  }

  dismiss(id: string): void {
    this._queue.update(q => q.filter(n => n.id !== id));
  }

  dismissAll(): void {
    this._queue.set([]);
  }

  private _readPermission(): NotificationPermission {
    if (!('Notification' in window)) return 'denied';
    return Notification.permission as NotificationPermission;
  }
}
