import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthApiService } from '../../../../core/api/auth-api.service';
import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { ApiError } from '../../../../shared/models/api.models';

function phoneValidator(ctrl: AbstractControl): ValidationErrors | null {
  const v: string = ctrl.value ?? '';
  return /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/.test(v) ? null : { phone: true };
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslateModule],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-header">
          <span class="auth-logo">🗂</span>
          <h1>{{ 'auth.login.title' | translate }}</h1>
          <p>{{ 'auth.login.subtitle' | translate }}</p>
        </div>

        <!-- PIN mode -->
        @if (showPinMode()) {
          <form [formGroup]="pinForm" (ngSubmit)="submitPin()" class="auth-form" novalidate>

            @if (pinError()) {
              <div class="alert-error">{{ pinError() }}</div>
            }

            <div class="pin-hero">🔑</div>
            <p class="pin-hint">{{ 'auth.login.pin_hint' | translate }}</p>

            <div class="field">
              <label for="pin">{{ 'auth.login.pin_label' | translate }}</label>
              <input
                id="pin"
                type="password"
                formControlName="pin"
                [placeholder]="'auth.login.pin_placeholder' | translate"
                inputmode="numeric"
                maxlength="6"
                autocomplete="off"
                [class.input-error]="pinForm.get('pin')?.touched && pinForm.get('pin')?.invalid"
              />
            </div>

            <button type="submit" class="btn-primary btn-full" [disabled]="pinPending()">
              {{ pinPending() ? ('auth.login.submitting' | translate) : ('auth.login.submit' | translate) }}
            </button>

            <button type="button" class="btn-link-center" (click)="switchToPassword()">
              {{ 'auth.login.use_password' | translate }}
            </button>

          </form>
        }

        <!-- Password mode -->
        @if (!showPinMode()) {
          <form [formGroup]="form" (ngSubmit)="submit()" class="auth-form" novalidate>

            @if (serverError()) {
              <div class="alert-error">{{ serverError() }}</div>
            }

            <div class="field">
              <label for="phone">{{ 'auth.login.phone' | translate }}</label>
              <input
                id="phone"
                type="tel"
                formControlName="phone"
                placeholder="+7 (999) 888-77-66"
                autocomplete="username"
                (input)="onPhoneInput($event)"
                [class.input-error]="fieldError('phone')"
              />
              @if (fieldError('phone')) {
                <span class="field-error">{{ fieldError('phone') }}</span>
              }
            </div>

            <div class="field">
              <label for="password">{{ 'auth.login.password' | translate }}</label>
              <input
                id="password"
                type="password"
                formControlName="password"
                autocomplete="current-password"
                [class.input-error]="fieldError('password')"
              />
              @if (fieldError('password')) {
                <span class="field-error">{{ fieldError('password') }}</span>
              }
            </div>

            <div class="forgot-row">
              <a routerLink="/forgot-password" class="link-subtle">{{ 'auth.login.forgot' | translate }}</a>
            </div>

            <button type="submit" class="btn-primary btn-full" [disabled]="pending()">
              {{ pending() ? ('auth.login.submitting' | translate) : ('auth.login.submit' | translate) }}
            </button>

            @if (hasPin()) {
              <button type="button" class="btn-link-center" (click)="showPinMode.set(true)">
                {{ 'auth.login.use_pin' | translate }}
              </button>
            }

            <p class="auth-switch">
              {{ 'auth.login.no_account' | translate }}
              <a routerLink="/register" class="link-primary">{{ 'auth.login.register_link' | translate }}</a>
            </p>

          </form>
        }
      </div>
    </div>
  `,
  styles: [`
    @import url('../../../../../styles/auth.shared.css');
    .pin-hero { text-align: center; font-size: 2.4rem; margin-bottom: 4px; }
    .pin-hint { text-align: center; font-size: 0.87rem; color: #6b7280; margin: 0 0 12px; }
    .btn-link-center {
      background: none; border: none; color: #6366f1; cursor: pointer;
      font-size: 0.87rem; padding: 4px 0; text-align: center; width: 100%;
    }
    .btn-link-center:hover { text-decoration: underline; }
  `],
})
export class LoginComponent {
  private readonly fb        = inject(FormBuilder);
  private readonly authApi   = inject(AuthApiService);
  private readonly authState = inject(AuthStateService);
  private readonly router    = inject(Router);
  private readonly translate = inject(TranslateService);

  readonly pending     = signal(false);
  readonly pinPending  = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly pinError    = signal<string | null>(null);
  private  fieldErrors = signal<Record<string, string[]>>({});

  readonly hasPin      = signal(!!localStorage.getItem('fs_device_pin'));
  readonly showPinMode = signal(
    !!localStorage.getItem('fs_device_pin') && !!localStorage.getItem('auth_token'),
  );

  readonly form = this.fb.group({
    phone:    ['', [Validators.required, phoneValidator]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  readonly pinForm = this.fb.group({
    pin: ['', [Validators.required, Validators.pattern(/^\d{4,6}$/)]],
  });

  // ── Phone formatting ───────────────────────────────────────────────────────

  onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const pos   = input.selectionStart ?? 0;
    const before = input.value.length;
    const formatted = this.formatPhone(input.value);
    input.value = formatted;
    this.form.get('phone')!.setValue(formatted, { emitEvent: false });
    const newPos = Math.max(0, pos + (formatted.length - before));
    input.setSelectionRange(newPos, newPos);
  }

  private formatPhone(raw: string): string {
    let d = raw.replace(/\D/g, '');
    if (d.startsWith('7') || d.startsWith('8')) d = d.slice(1);
    d = d.slice(0, 10);
    if (!d) return '';
    const g = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)];
    let r = '+7 (' + g[0];
    if (!g[1]) return r;
    r += ') ' + g[1];
    if (!g[2]) return r;
    r += '-' + g[2];
    if (!g[3]) return r;
    return r + '-' + g[3];
  }

  fieldError(name: string): string | null {
    const ctrl = this.form.get(name);
    if (ctrl?.touched && ctrl.invalid) {
      if (ctrl.errors?.['required']) return this.translate.instant('common.required');
      if (ctrl.errors?.['phone'])    return this.translate.instant('common.phone_format_error');
      if (ctrl.errors?.['minlength'])
        return this.translate.instant('common.min_length', { length: ctrl.errors['minlength'].requiredLength });
    }
    return this.fieldErrors()[name]?.[0] ?? null;
  }

  // ── PIN flow ───────────────────────────────────────────────────────────────

  switchToPassword(): void {
    this.showPinMode.set(false);
    this.pinError.set(null);
  }

  submitPin(): void {
    this.pinForm.markAllAsTouched();
    if (this.pinForm.invalid || this.pinPending()) return;

    const pin    = this.pinForm.getRawValue().pin!;
    const stored = localStorage.getItem('fs_device_pin');
    if (!stored || btoa(pin) !== stored) {
      this.pinError.set(this.translate.instant('auth.login.pin_error'));
      return;
    }

    this.pinPending.set(true);
    this.authApi.me().subscribe({
      next: (res) => {
        this.pinPending.set(false);
        if (res?.result === 'success' && res.data?.user) {
          this.authState.restoreUser(res.data.user);
          this.router.navigate(['/files']);
        } else {
          this.switchToPassword();
          this.serverError.set(this.translate.instant('auth.login.session_expired'));
        }
      },
      error: () => {
        this.pinPending.set(false);
        this.switchToPassword();
        this.serverError.set(this.translate.instant('auth.login.session_expired'));
      },
    });
  }

  // ── Password flow ──────────────────────────────────────────────────────────

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.pending()) return;

    this.pending.set(true);
    this.serverError.set(null);
    this.fieldErrors.set({});

    const { phone, password } = this.form.getRawValue();
    const normalizedPhone = '+' + phone!.replace(/\D/g, '');

    this.authApi.login({ phone: normalizedPhone, password: password! }).subscribe({
      next: (res) => {
        this.authState.setUser(res.data.user, res.data.token);
        this.router.navigate(['/files']);
      },
      error: (err: ApiError) => {
        this.pending.set(false);
        if (err.data?.errors && Object.keys(err.data.errors).length) {
          this.fieldErrors.set(err.data.errors);
        } else {
          this.serverError.set(err.message ?? this.translate.instant('auth.login.error'));
        }
      },
      complete: () => this.pending.set(false),
    });
  }
}
