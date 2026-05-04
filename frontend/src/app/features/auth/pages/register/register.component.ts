import { Component, inject, signal, input, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthApiService } from '../../../../core/api/auth-api.service';
import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { ApiError } from '../../../../shared/models/api.models';


function passwordMatchValidator(ctrl: AbstractControl): ValidationErrors | null {
  const pwd  = ctrl.get('password')?.value;
  const conf = ctrl.get('password_confirmation')?.value;
  return pwd && conf && pwd !== conf ? { passwordMismatch: true } : null;
}

@Component({
  selector: 'app-register',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
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

          <!-- Email -->
          <div class="field">
            <label for="email">{{ 'auth.register.email' | translate }}</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              placeholder="you@example.com"
              autocomplete="username"
              [class.input-error]="fieldError('email')"
            />
            @if (fieldError('email')) {
              <span class="field-error">{{ fieldError('email') }}</span>
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

          <!-- Privacy policy checkbox -->
          <div class="field field-checkbox">
            <label class="checkbox-label">
              <input
                type="checkbox"
                formControlName="privacyAccepted"
                [class.input-error]="privacyError()"
              />
              <span>
                {{ 'auth.register.privacy_prefix' | translate }}
                <a routerLink="/privacy" target="_blank" class="link-primary">{{ 'auth.register.privacy_link' | translate }}</a>
              </span>
            </label>
            @if (privacyError()) {
              <span class="field-error">{{ 'auth.register.privacy_required' | translate }}</span>
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
  styles: [`
    @import url('../../../../../styles/auth.shared.css');
    .field-checkbox { margin-top: 4px; }
    .checkbox-label {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      cursor: pointer;
      font-size: 0.875rem;
      line-height: 1.5;
    }
    .checkbox-label input[type="checkbox"] {
      margin-top: 3px;
      flex-shrink: 0;
      width: 16px;
      height: 16px;
      accent-color: #6366f1;
      cursor: pointer;
    }
  `],
})
export class RegisterComponent {
  private readonly fb        = inject(FormBuilder);
  private readonly authApi   = inject(AuthApiService);
  private readonly authState = inject(AuthStateService);
  private readonly router    = inject(Router);
  private readonly translate = inject(TranslateService);

  // Pre-filled email from invitation flow (passed as query param)
  readonly prefillEmail = input<string>('');

  readonly pending     = signal(false);
  readonly serverError = signal<string | null>(null);
  private fieldErrors  = signal<Record<string, string[]>>({});

  readonly form = this.fb.group({
    email:                 [this.prefillEmail() || '', [Validators.required, Validators.email]],
    password:              ['', [Validators.required, Validators.minLength(8)]],
    password_confirmation: ['', [Validators.required]],
    privacyAccepted:       [false, [Validators.requiredTrue]],
  }, { validators: passwordMatchValidator });

  privacyError(): boolean {
    const ctrl = this.form.get('privacyAccepted');
    return !!(ctrl?.touched && ctrl.invalid);
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

    const { email, password, password_confirmation } = this.form.getRawValue();

    this.authApi.register({
      email: email!,
      password: password!,
      password_confirmation: password_confirmation!,
    }).subscribe({
      next: (res) => {
        this.authState.setUser(res.data.user, res.data.token);
        this.router.navigate(['/files']);
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
