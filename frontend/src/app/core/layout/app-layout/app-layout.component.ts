import {Component, inject, computed, signal, ChangeDetectionStrategy, OnInit} from '@angular/core';
import {RouterLink, RouterLinkActive, Router} from '@angular/router';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {AuthStateService} from '../../auth/auth-state.service';
import {AuthApiService} from '../../api/auth-api.service';
import {UserSettingsApiService} from '../../api/user-settings-api.service';
import {NotificationService} from '../../notifications/notification.service';

const LAST_CONTACTS_CHECK_KEY = 'fs_last_contacts_check';

@Component({
  selector: 'app-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, TranslateModule],
  templateUrl: './app-layout.component.html',
  styleUrl: './app-layout.component.scss',
})
export class AppLayoutComponent implements OnInit {
  private readonly authState      = inject(AuthStateService);
  private readonly authApi        = inject(AuthApiService);
  private readonly router         = inject(Router);
  private readonly settingsApi    = inject(UserSettingsApiService);
  private readonly notifService   = inject(NotificationService);
  private readonly translate      = inject(TranslateService);

  readonly isAuth = this.authState.isAuthenticated;
  readonly needsVerification = this.authState.needsEmailVerification;
  readonly emailVerified = this.authState.isEmailVerified;
  readonly userEmail = computed(() => this.authState.user()?.email ?? '');
  readonly userPlan = this.authState.plan;
  readonly isSuperUser = this.authState.isSuperUser;
  readonly sidebarOpen = signal(false);
  readonly resending = signal(false);
  readonly resent = signal(false);

  readonly planLabel = computed(() => {
    const map: Record<string, string> = { free: 'Free', silver: 'Silver', gold: 'Gold' };
    return map[this.userPlan() ?? 'free'] ?? 'Free';
  });

  readonly deadline = computed(() => {
    const d = this.authState.verificationDeadline();
    if (!d) return null;
    return new Date(d).toLocaleString('ru-RU', {day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit'});
  });

  ngOnInit(): void {
    if (this.authState.isAuthenticated()) {
      this._checkContactRequests();
    }
  }

  private _checkContactRequests(): void {
    const user = this.authState.user();
    if (!user?.notifications_enabled || !user?.notify_contacts_added) return;

    this.settingsApi.getContactRequests().subscribe({
      next: res => {
        const lastCheckStr = localStorage.getItem(LAST_CONTACTS_CHECK_KEY);
        const lastCheck = lastCheckStr ? new Date(lastCheckStr).getTime() : 0;
        const now = new Date().toISOString();

        const newRequests = res.data.items.filter(r => {
          if (!r.created_at) return false;
          return new Date(r.created_at).getTime() > lastCheck;
        });

        for (const req of newRequests.slice(0, 2)) {
          const name = req.requester.name ?? req.requester.email;
          const route = user.allow_contacts_without_confirmation ? undefined : '/settings/security';
          this.notifService.show(
            this.translate.instant('notifications.contact_request_title'),
            this.translate.instant('notifications.contact_request_body', { name }),
            route
          );
        }

        localStorage.setItem(LAST_CONTACTS_CHECK_KEY, now);
      },
      error: () => { /* ignore */ },
    });
  }

  toggleSidebar(): void {
    this.sidebarOpen.update(v => !v);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  resendVerification(): void {
    if (this.resending()) return;
    this.resending.set(true);
    this.authApi.resendVerification().subscribe({
      next: () => {
        this.resending.set(false);
        this.resent.set(true);
      },
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
