import {Component, inject, computed, signal, ChangeDetectionStrategy} from '@angular/core';
import {RouterLink, RouterLinkActive, Router} from '@angular/router';
import {TranslateModule} from '@ngx-translate/core';
import {AuthStateService} from '../../auth/auth-state.service';
import {AuthApiService} from '../../api/auth-api.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, TranslateModule],
  templateUrl: './app-layout.component.html',
  styleUrl: './app-layout.component.scss',
})
export class AppLayoutComponent {
  private readonly authState = inject(AuthStateService);
  private readonly authApi = inject(AuthApiService);
  private readonly router = inject(Router);

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
