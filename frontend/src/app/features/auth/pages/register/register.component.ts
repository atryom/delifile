import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgIf } from '@angular/common';
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
  imports: [ReactiveFormsModule, RouterLink, NgIf, TranslateModule],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-header">
          <span class="auth-logo">🗂</span>
          <h1>{{ 'auth.register.title' | translate }}</h1>
          <p>{{ 'auth.register.subtitle' | translate }}</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" class="auth-form" novalidate>

          <div class="alert-error" *ngIf="serverError()">{{ serverError() }}</div>

          <!-- Phone -->
          <div class="field">
            <label for="phone">{{ 'auth.register.phone' | translate }}</label>
            <input
              id="phone"
              type="tel"
              formControlName="phone"
              placeholder="+79990000000"
              autocomplete="username"
              [class.input-error]="fieldError('phone')"
            />
            <span class="field-error" *ngIf="fieldError('phone')">{{ fieldError('phone') }}</span>
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
            <span class="field-error" *ngIf="fieldError('password')">{{ fieldError('password') }}</span>
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
            <span class="field-error"
              *ngIf="form.errors?.['passwordMismatch'] && form.get('password_confirmation')?.touched">
              {{ 'auth.register.passwords_mismatch' | translate }}
            </span>
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
    phone:                 ['', [Validators.required]],
    password:              ['', [Validators.required, Validators.minLength(8)]],
    password_confirmation: ['', [Validators.required]],
  }, { validators: passwordMatchValidator });

  fieldError(name: string): string | null {
    const ctrl = this.form.get(name);
    if (ctrl?.touched && ctrl.invalid) {
      if (ctrl.errors?.['required']) return this.translate.instant('common.required');
      if (ctrl.errors?.['minlength']) return this.translate.instant('common.min_length', { length: ctrl.errors['minlength'].requiredLength });
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

    this.authApi.register({
      phone: phone!,
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
