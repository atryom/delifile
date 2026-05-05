import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { NotificationService } from '../../../core/notifications/notification.service';

@Component({
  selector: 'app-notification-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule],
  template: `
    <div class="toasts-container" aria-live="polite" aria-label="Уведомления">
      @for (note of notifService.queue(); track note.id) {
        <div class="toast" role="alert">
          <div class="toast-body">
            <strong class="toast-title">{{ note.title }}</strong>
            <p class="toast-text">{{ note.body }}</p>
          </div>
          <div class="toast-actions">
            @if (note.route) {
              <button class="toast-btn-open" (click)="open(note.id, note.route!)">
                {{ 'notifications.open' | translate }}
              </button>
            }
            <button class="toast-btn-close" (click)="notifService.dismiss(note.id)" aria-label="Закрыть">×</button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .toasts-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2000;
      display: flex;
      flex-direction: column-reverse;
      gap: 10px;
      max-width: 360px;
      pointer-events: none;
    }

    .toast {
      background: #1e293b;
      color: #f1f5f9;
      border-radius: 12px;
      padding: 14px 16px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      display: flex;
      align-items: flex-start;
      gap: 12px;
      pointer-events: all;
      animation: slideIn 0.25s ease;
    }

    .toast-body { flex: 1; min-width: 0; }
    .toast-title { display: block; font-size: 0.88rem; font-weight: 700; margin-bottom: 2px; }
    .toast-text  {
      margin: 0;
      font-size: 0.82rem;
      color: #94a3b8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .toast-actions { display: flex; gap: 6px; align-items: flex-start; flex-shrink: 0; }

    .toast-btn-open {
      background: #6366f1;
      color: #fff;
      border: none;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }
    .toast-btn-open:hover { background: #4f46e5; }

    .toast-btn-close {
      background: none;
      border: none;
      color: #64748b;
      font-size: 1.1rem;
      cursor: pointer;
      padding: 0;
      line-height: 1;
    }
    .toast-btn-close:hover { color: #f1f5f9; }

    @keyframes slideIn {
      from { opacity: 0; transform: translateX(16px); }
      to   { opacity: 1; transform: translateX(0); }
    }
  `],
})
export class NotificationBannerComponent {
  readonly notifService = inject(NotificationService);
  private readonly router = inject(Router);

  open(id: string, route: string): void {
    this.notifService.dismiss(id);
    this.router.navigateByUrl(route);
  }
}
