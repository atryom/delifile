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

function passwordMatchValidator(ctrl: AbstractControl): ValidationErrors | null {
  const pwd  = ctrl.get('password')?.value;
  const conf = ctrl.get('password_confirmation')?.value;
  return pwd && conf && pwd !== conf ? { passwordMismatch: true } : null;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslateModule],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-header">
          <span class="auth-logo">🗂</span>
          <h1>{{ 'auth.register.title' | translate }}</h1>
          <p>{{ 'auth.register.subtitle' | translate }}</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" class="auth-form" novalidate>

          @if (serverError()) {
            <div class="alert-error">{{ serverError() }}</div>
          }

          <!-- Phone -->
          <div class="field">
            <label for="phone">{{ 'auth.register.phone' | translate }}</label>
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

          <!-- Password -->
          <div class="field">
            <label for="password">{{ 'auth.register.password' | translate }}</label>
            <input
              id="password"
              type="password"
              formControlName="password"
              [placeholder]="'auth.register.password_hint' | translate"
              autocomplete="new-password"
              [class.input-error]="fieldError('password')"
            />
            @if (fieldError('password')) {
              <span class="field-error">{{ fieldError('password') }}</span>
            }
          </div>

          <!-- Confirm Password -->
          <div class="field">
            <label for="password_confirmation">{{ 'auth.register.confirm_password' | translate }}</label>
            <input
              id="password_confirmation"
              type="password"
              formControlName="password_confirmation"
              [placeholder]="'auth.register.confirm_placeholder' | translate"
              autocomplete="new-password"
              [class.input-error]="form.errors?.['passwordMismatch'] && form.get('password_confirmation')?.touched"
            />
            @if (form.errors?.['passwordMismatch'] && form.get('password_confirmation')?.touched) {
              <span class="field-error">{{ 'auth.register.passwords_mismatch' | translate }}</span>
            }
          </div>

          <button type="submit" class="btn-primary btn-full" [disabled]="pending()">
            {{ pending() ? ('auth.register.submitting' | translate) : ('auth.register.submit' | translate) }}
          </button>

          <p class="auth-switch">
            {{ 'auth.register.have_account' | translate }}
            <a routerLink="/login" class="link-primary">{{ 'auth.register.login_link' | translate }}</a>
          </p>

        </form>

      </div>
    </div>
  `,
  styles: [`@import url('../../../../../styles/auth.shared.css');`],
})
export class RegisterComponent {
  private readonly fb        = inject(FormBuilder);
  private readonly authApi   = inject(AuthApiService);
  private readonly authState = inject(AuthStateService);
  private readonly router    = inject(Router);
  private readonly translate = inject(TranslateService);

  readonly pending     = signal(false);
  readonly serverError = signal<string | null>(null);
  private fieldErrors  = signal<Record<string, string[]>>({});

  readonly form = this.fb.group({
    phone:                 ['', [Validators.required, phoneValidator]],
    password:              ['', [Validators.required, Validators.minLength(8)]],
    password_confirmation: ['', [Validators.required]],
  }, { validators: passwordMatchValidator });

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

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.pending()) return;

    this.pending.set(true);
    this.serverError.set(null);
    this.fieldErrors.set({});

    const { phone, password, password_confirmation } = this.form.getRawValue();
    const normalizedPhone = '+' + phone!.replace(/\D/g, '');

    this.authApi.register({
      phone: normalizedPhone,
      password: password!,
      password_confirmation: password_confirmation!,
    }).subscribe({
      next: (res) => {
        this.authState.setUser(res.data.user, res.data.token);
        // next_step from spec
        if (res.data.next_step === 'pin_offer') {
          this.router.navigate(['/pin-setup']);
        } else {
          this.router.navigate(['/files']);
        }
      },
      error: (err: ApiError) => {
        this.pending.set(false);
        if (err.data?.errors && Object.keys(err.data.errors).length) {
          this.fieldErrors.set(err.data.errors);
        } else {
          this.serverError.set(err.message ?? this.translate.instant('auth.register.error'));
        }
      },
      complete: () => this.pending.set(false),
    });
  }
}
