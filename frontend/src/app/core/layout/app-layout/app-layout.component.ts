import {
  Component, inject, computed, signal,
  ChangeDetectionStrategy, OnInit, OnDestroy,
} from '@angular/core';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';

import { AuthStateService } from '../../auth/auth-state.service';
import { AuthApiService } from '../../api/auth-api.service';
import { UserSettingsApiService } from '../../api/user-settings-api.service';
import { FilesApiService } from '../../api/files-api.service';
import { NotificationService } from '../../notifications/notification.service';

const POLL_INTERVAL_MS = 60_000; // 60 seconds

@Component({
  selector: 'app-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, TranslateModule],
  templateUrl: './app-layout.component.html',
  styleUrl: './app-layout.component.scss',
})
export class AppLayoutComponent implements OnInit, OnDestroy {
  private readonly authState    = inject(AuthStateService);
  private readonly authApi      = inject(AuthApiService);
  private readonly router       = inject(Router);
  private readonly settingsApi  = inject(UserSettingsApiService);
  private readonly filesApi     = inject(FilesApiService);
  readonly notifService = inject(NotificationService);
  private readonly translate    = inject(TranslateService);

  readonly isAuth          = this.authState.isAuthenticated;
  readonly needsVerification = this.authState.needsEmailVerification;
  readonly emailVerified   = this.authState.isEmailVerified;
  readonly userEmail       = computed(() => this.authState.user()?.email ?? '');
  readonly userPlan        = this.authState.plan;
  readonly isSuperUser     = this.authState.isSuperUser;
  readonly sidebarOpen     = signal(false);
  readonly resending       = signal(false);
  readonly resent          = signal(false);

  readonly showNotifBanner = this.notifService.showBanner;

  /** True when the verify or notif banner is shown — for main-content offset */
  readonly hasVerifyBanner = computed(() =>
    (this.needsVerification() && !this.resent()) || this.resent()
  );

  readonly planLabel = computed(() => {
    const map: Record<string, string> = { free: 'Free', silver: 'Silver', gold: 'Gold' };
    return map[this.userPlan() ?? 'free'] ?? 'Free';
  });

  readonly deadline = computed(() => {
    const d = this.authState.verificationDeadline();
    if (!d) return null;
    return new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' });
  });

  private _pollTimer?: ReturnType<typeof setInterval>;
  private _routerSub?: Subscription;

  ngOnInit(): void {
    if (this.isAuth()) {
      this._startPolling();
    }

    // Clear relevant toasts when user navigates to the page that triggered them
    this._routerSub = this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e) => {
      const url = (e as NavigationEnd).urlAfterRedirects;
      // If user opens the received files page — clear file toasts
      if (url.includes('/files') && url.includes('received')) {
        this.notifService.dismissAll();
      }
      // If user opens security settings — clear contact request toasts
      if (url.includes('/settings/security')) {
        this.notifService.dismissAll();
      }
    });
  }

  ngOnDestroy(): void {
    if (this._pollTimer) clearInterval(this._pollTimer);
    this._routerSub?.unsubscribe();
  }

  private _startPolling(): void {
    this._checkNewEvents();
    this._pollTimer = setInterval(() => this._checkNewEvents(), POLL_INTERVAL_MS);
  }

  private _checkNewEvents(): void {
    const user = this.authState.user();
    if (!user?.notifications_enabled) return;

    if (user.notify_new_files) {
      this.filesApi.list('received', 1).subscribe({
        next: res => {
          for (const file of res.data.items) {
            if (this.notifService.hasNotifiedFile(file.id)) continue;
            this.notifService.markFileNotified(file.id);
            this.notifService.show(
              this.translate.instant('notifications.new_file_title'),
              file.original_name,
              `/files/${file.id}`,
            );
          }
        },
        error: () => { /* ignore poll errors */ },
      });
    }

    if (user.notify_contacts_added) {
      this.settingsApi.getContactRequests().subscribe({
        next: res => {
          for (const req of res.data.items) {
            if (this.notifService.hasNotifiedContact(req.id)) continue;
            this.notifService.markContactNotified(req.id);
            const name = req.requester.name ?? req.requester.email;
            const route = !user.allow_contacts_without_confirmation ? '/settings/security' : undefined;
            this.notifService.show(
              this.translate.instant('notifications.contact_request_title'),
              this.translate.instant('notifications.contact_request_body', { name }),
              route,
            );
          }
        },
        error: () => { /* ignore poll errors */ },
      });
    }
  }

  async enableNotifications(): Promise<void> {
    const permission = await this.notifService.requestPermission();
    if (permission === 'granted') {
      // Sync with backend if needed
      const user = this.authState.user();
      if (user && !user.notifications_enabled) {
        this.settingsApi.updateSettings({ notifications_enabled: true }).subscribe(res => {
          if (res.result === 'success') this.authState.updateUser(res.data.user);
        });
      }
    }
  }

  toggleSidebar(): void { this.sidebarOpen.update(v => !v); }
  closeSidebar(): void  { this.sidebarOpen.set(false); }

  resendVerification(): void {
    if (this.resending()) return;
    this.resending.set(true);
    this.authApi.resendVerification().subscribe({
      next: () => { this.resending.set(false); this.resent.set(true); },
      error: () => this.resending.set(false),
    });
  }

  logout(): void {
    this.authApi.logout().subscribe({
      complete: () => {
        this.authState.clearUser();
        this.router.navigate(['/login']);
      },
    });
  }
}
