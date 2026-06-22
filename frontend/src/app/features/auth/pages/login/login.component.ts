import { Component, inject, signal, ChangeDetectionStrategy, OnDestroy } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription, interval } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';
import { AuthApiService } from '../../../../core/api/auth-api.service';
import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { DeviceService } from '../../../../core/services/device.service';
import { LockPassApiService, TwoFaSession, TwoFaPollResult } from '../../../../core/api/lockpass-api.service';
import { ApiError, CurrentUser } from '../../../../shared/models/api.models';

type LoginStep = 'credentials' | '2fa';

@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslateModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnDestroy {
  private readonly fb          = inject(FormBuilder);
  private readonly authApi     = inject(AuthApiService);
  private readonly authState   = inject(AuthStateService);
  private readonly device      = inject(DeviceService);
  private readonly lockPass    = inject(LockPassApiService);
  private readonly router      = inject(Router);
  private readonly route       = inject(ActivatedRoute);
  private readonly translate   = inject(TranslateService);

  readonly step        = signal<LoginStep>('credentials');
  readonly pending     = signal(false);
  readonly serverError = signal<string | null>(null);
  private  fieldErrors = signal<Record<string, string[]>>({});

  // 2FA state
  readonly twoFaSession  = signal<TwoFaSession | null>(null);
  readonly twoFaStatus   = signal<'pending' | 'approved' | 'rejected' | 'expired'>('pending');
  readonly twoFaMode     = signal<'push' | 'totp' | 'recovery'>('push');
  readonly totpCode      = signal('');
  readonly recoveryCode  = signal('');
  readonly totpError     = signal<string | null>(null);
  readonly recoveryError = signal<string | null>(null);
  readonly secondsLeft   = signal(300);

  private pollSub?: Subscription;
  private timerSub?: Subscription;

  readonly emailVerifiedParam = signal<string | null>(
    this.route.snapshot.queryParamMap.get('email_verified')
  );

  readonly form = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    remember: [true],
  });

  ngOnDestroy(): void {
    this.stopPolling();
  }

  fieldError(name: string): string | null {
    const ctrl = this.form.get(name);
    if (ctrl?.touched && ctrl.invalid) {
      if (ctrl.errors?.['required']) return this.translate.instant('common.required');
      if (ctrl.errors?.['email'])    return this.translate.instant('common.email_format_error');
      if (ctrl.errors?.['minlength'])
        return this.translate.instant('common.min_length', { length: ctrl.errors['minlength'].requiredLength });
    }
    return this.fieldErrors()[name]?.[0] ?? null;
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.pending()) return;

    this.pending.set(true);
    this.serverError.set(null);
    this.fieldErrors.set({});

    const { email, password, remember } = this.form.getRawValue();

    this.authApi.login({
      email:       email!,
      password:    password!,
      device_id:   this.device.getDeviceId(),
      device_type: this.device.getDeviceType(),
    }).subscribe({
      next: (res) => {
        const data = res.data as any;

        if (data.requires_2fa) {
          this.twoFaSession.set(data as TwoFaSession);
          this.step.set('2fa');
          this.startTimer();
          this.startPolling(data.session_id, remember ?? true);
          return;
        }

        const d = data as { token: string; user: CurrentUser };
        this.authState.setUser(d.user, d.token, remember ?? true);
        this.navigateAfterLogin(d.user);
      },
      error: (err: ApiError) => {
        this.pending.set(false);
        const code = err.data?.code;
        if (code === 'ACCOUNT_BLOCKED') {
          this.router.navigate(['/account-blocked']);
          return;
        }
        if (code === 'DEVICE_LIMIT_EXCEEDED') {
          this.serverError.set(this.translate.instant('auth.login.device_limit_exceeded'));
          return;
        }
        if (code === 'TWO_FA_UNAVAILABLE') {
          this.serverError.set('Сервис 2FA временно недоступен. Попробуйте позже.');
          return;
        }
        if (err.data?.errors && Object.keys(err.data.errors).length) {
          this.fieldErrors.set(err.data.errors);
        } else {
          this.serverError.set(err.message ?? this.translate.instant('auth.login.error'));
        }
      },
      complete: () => this.pending.set(false),
    });
  }

  // ─── 2FA helpers ─────────────────────────────────────────────────────────

  setTwoFaMode(mode: 'push' | 'totp' | 'recovery'): void {
    this.twoFaMode.set(mode);
    this.totpError.set(null);
    this.recoveryError.set(null);
  }

  submitTotp(): void {
    const code = this.totpCode().trim();
    if (code.length !== 6 || this.pending()) return;

    this.pending.set(true);
    this.totpError.set(null);
    this.stopPolling();

    this.lockPass.verifyTotp(this.twoFaSession()!.session_id, code).subscribe({
      next: (res) => this.handleTwoFaApproved(res.data),
      error: (err: ApiError) => {
        this.pending.set(false);
        const left = (err as any).data?.errors?.attempts_left;
        this.totpError.set(
          left != null ? `Неверный код. Осталось попыток: ${left}` : 'Неверный код'
        );
        this.startPolling(this.twoFaSession()!.session_id, true);
      },
    });
  }

  submitRecovery(): void {
    const code = this.recoveryCode().trim();
    if (!code || this.pending()) return;

    this.pending.set(true);
    this.recoveryError.set(null);
    this.stopPolling();

    this.lockPass.verifyRecovery(this.twoFaSession()!.session_id, code).subscribe({
      next: (res) => this.handleTwoFaApproved(res.data),
      error: (err: ApiError) => {
        this.pending.set(false);
        const left = (err as any).data?.errors?.attempts_left;
        this.recoveryError.set(
          left != null ? `Неверный код. Осталось попыток: ${left}` : 'Неверный код восстановления'
        );
        this.startPolling(this.twoFaSession()!.session_id, true);
      },
    });
  }

  retryTwoFa(): void {
    this.stopPolling();
    this.step.set('credentials');
    this.twoFaSession.set(null);
    this.twoFaStatus.set('pending');
    this.twoFaMode.set('push');
    this.totpCode.set('');
    this.recoveryCode.set('');
    this.totpError.set(null);
    this.recoveryError.set(null);
    this.secondsLeft.set(300);
    this.pending.set(false);
    this.serverError.set(null);
  }

  formatSecondsLeft(): string {
    const s = this.secondsLeft();
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private startPolling(sessionId: string, remember: boolean): void {
    this.pollSub = interval(2000).pipe(
      switchMap(() => this.lockPass.poll(sessionId)),
      takeWhile((res) => res.data.status === 'pending', true),
    ).subscribe({
      next: (res) => {
        const status = res.data.status;
        if (status !== 'pending') {
          this.twoFaStatus.set(status);
          if (status === 'approved') {
            this.handleTwoFaApproved(res.data, remember);
          } else {
            this.stopPolling();
            this.pending.set(false);
          }
        }
      },
      error: () => {
        // Network error — silently retry next tick
      },
    });
  }

  private stopPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = undefined;
    this.timerSub?.unsubscribe();
    this.timerSub = undefined;
  }

  private startTimer(): void {
    this.secondsLeft.set(300);
    this.timerSub = interval(1000).subscribe(() => {
      const left = this.secondsLeft() - 1;
      this.secondsLeft.set(left);
      if (left <= 0) {
        this.twoFaStatus.set('expired');
        this.stopPolling();
      }
    });
  }

  private handleTwoFaApproved(data: TwoFaPollResult, remember = true): void {
    this.stopPolling();
    if (data.token && data.user) {
      this.authState.setUser(data.user, data.token, remember);
      this.navigateAfterLogin(data.user);
    }
  }

  private navigateAfterLogin(user: CurrentUser): void {
    if (user.account_status === 'blocked_unverified_email') {
      this.router.navigate(['/account-blocked']);
    } else {
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      this.router.navigateByUrl(returnUrl ?? '/files');
    }
  }
}
