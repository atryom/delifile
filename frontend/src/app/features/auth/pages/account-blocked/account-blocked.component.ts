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
  templateUrl: './account-blocked.component.html',
  styleUrl: './account-blocked.component.scss',
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
