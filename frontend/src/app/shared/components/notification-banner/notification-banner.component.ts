import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { NotificationService, InAppNotification } from '../../../core/notifications/notification.service';
import { AuthStateService } from '../../../core/auth/auth-state.service';
import { UserSettingsApiService } from '../../../core/api/user-settings-api.service';

@Component({
  selector: 'app-notification-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule],
  template: `
    @if (notifService.showBanner()) {
      <div class="notif-banner" role="status" aria-live="polite">
        <span class="notif-text">{{ 'notifications.banner_text' | translate }}</span>
        <button class="notif-btn" (click)="enable()">
          {{ 'notifications.banner_btn' | translate }}
        </button>
        <button class="notif-close" (click)="dismiss()" aria-label="Закрыть">×</button>
      </div>
    }

    @for (note of notifService.queue(); track note.id) {
      <div class="notif-toast" role="alert">
        <div class="notif-toast-body">
          <strong>{{ note.title }}</strong>
          <p>{{ note.body }}</p>
        </div>
        <div class="notif-toast-actions">
          @if (note.route) {
            <button class="notif-toast-open" (click)="openNote(note.id, note.route)">
              {{ 'notifications.open' | translate }}
            </button>
          }
          <button class="notif-toast-close" (click)="notifService.dismiss(note.id)" aria-label="Закрыть">×</button>
        </div>
      </div>
    }
  `,
  styles: [`
    .notif-banner {
      position: fixed;
      bottom: 24px;
      left: 24px;
      z-index: 2000;
      display: flex;
      align-items: center;
      gap: 12px;
      background: #dc2626;
      color: #fff;
      padding: 12px 16px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.25);
      max-width: 360px;
      animation: slideUp 0.3s ease;
    }
    .notif-text { flex: 1; font-size: 0.9rem; font-weight: 500; }
    .notif-btn {
      background: #fff;
      color: #dc2626;
      border: none;
      padding: 6px 14px;
      border-radius: 8px;
      font-weight: 700;
      cursor: pointer;
      font-size: 0.85rem;
      white-space: nowrap;
    }
    .notif-btn:hover { background: #fee2e2; }
    .notif-close {
      background: none;
      border: none;
      color: rgba(255,255,255,0.8);
      font-size: 1.2rem;
      cursor: pointer;
      padding: 0 4px;
      line-height: 1;
    }
    .notif-close:hover { color: #fff; }

    .notif-toast {
      position: fixed;
      bottom: 24px;
      left: 24px;
      z-index: 1999;
      background: #1e293b;
      color: #f1f5f9;
      padding: 14px 16px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      max-width: 340px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      animation: slideUp 0.3s ease;
      margin-bottom: calc(var(--toast-offset, 0) * 80px);
    }
    .notif-toast-body { flex: 1; }
    .notif-toast-body strong { font-size: 0.9rem; }
    .notif-toast-body p { margin: 4px 0 0; font-size: 0.82rem; color: #94a3b8; }
    .notif-toast-actions { display: flex; gap: 6px; align-items: flex-start; }
    .notif-toast-open {
      background: #6366f1;
      color: #fff;
      border: none;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.78rem;
      cursor: pointer;
      font-weight: 600;
    }
    .notif-toast-open:hover { background: #4f46e5; }
    .notif-toast-close {
      background: none;
      border: none;
      color: #94a3b8;
      font-size: 1.1rem;
      cursor: pointer;
      padding: 0;
      line-height: 1;
    }
    .notif-toast-close:hover { color: #f1f5f9; }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `],
})
export class NotificationBannerComponent {
  readonly notifService = inject(NotificationService);
  private readonly authState = inject(AuthStateService);
  private readonly settingsApi = inject(UserSettingsApiService);
  private readonly router = inject(Router);

  async enable(): Promise<void> {
    const permission = await this.notifService.requestPermission();
    if (permission === 'granted') {
      // Sync with backend settings
      this.settingsApi.updateSettings({ notifications_enabled: true }).subscribe(res => {
        if (res.result === 'success') {
          this.authState.updateUser(res.data.user);
        }
      });
    }
  }

  dismiss(): void {
    this.notifService.dismissBanner();
  }

  openNote(id: string, route: string): void {
    this.notifService.dismiss(id);
    this.router.navigateByUrl(route);
  }
}
