import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthApiService } from '../../../../core/api/auth-api.service';
import { AuthStateService } from '../../../../core/auth/auth-state.service';

@Component({
  selector: 'app-account-blocked',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-header">
          <span class="auth-logo"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
                                       fill="none" stroke="#a89d1f" stroke-width="2" stroke-linecap="round"
                                       stroke-linejoin="round"
                                       class="lucide lucide-lock-keyhole-icon lucide-lock-keyhole"><circle cx="12"
                                                                                                           cy="16"
                                                                                                           r="1"/><rect
            x="3" y="10" width="18" height="12" rx="2"/><path d="M7 10V7a5 5 0 0 1 10 0v3"/></svg></span>
          <h1>{{ 'auth.blocked.title' | translate }}</h1>
          <p>{{ 'auth.blocked.description' | translate }}</p>
        </div>

        @if (successMsg()) {
          <div class="alert-success">{{ successMsg() }}</div>
        }
        @if (errorMsg()) {
          <div class="alert-error">{{ errorMsg() }}</div>
        }

        <div class="blocked-actions">
          <button
            class="btn-primary btn-full"
            (click)="resend()"
            [disabled]="resending()"
          >
            {{ resending() ? ('auth.blocked.resending' | translate) : ('auth.blocked.resend_btn' | translate) }}
          </button>

          <button class="btn-secondary btn-full" (click)="logout()">
            {{ 'auth.blocked.logout_btn' | translate }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    @import url('../../../../../styles/auth.shared.css');
    .blocked-actions { display: flex; flex-direction: column; gap: 12px; margin-top: 24px; }
    .btn-secondary {
      background: #f3f4f6; color: #374151; border: 1px solid #d1d5db;
      padding: 12px 20px; border-radius: 8px; font-size: 0.97rem; font-weight: 500; cursor: pointer;
    }
    .btn-secondary:hover { background: #e5e7eb; }
  `],
})
export class AccountBlockedComponent {
  private readonly authApi   = inject(AuthApiService);
  private readonly authState = inject(AuthStateService);
  private readonly router    = inject(Router);

  readonly resending  = signal(false);
  readonly successMsg = signal<string | null>(null);
  readonly errorMsg   = signal<string | null>(null);

  resend(): void {
    this.resending.set(true);
    this.successMsg.set(null);
    this.errorMsg.set(null);

    this.authApi.resendVerification().subscribe({
      next: (res) => {
        this.resending.set(false);
        this.successMsg.set(res.message);
      },
      error: (err) => {
        this.resending.set(false);
        this.errorMsg.set(err.message ?? 'Ошибка отправки');
      },
    });
  }

  logout(): void {
    this.authApi.logout().subscribe();
    this.authState.clearUser();
    this.router.navigate(['/login']);
  }
}
