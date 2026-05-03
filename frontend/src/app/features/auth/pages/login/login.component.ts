import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgIf } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthApiService } from '../../../../core/api/auth-api.service';
import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { ApiError } from '../../../../shared/models/api.models';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, NgIf, TranslateModule],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-header">
          <span class="auth-logo">🗂</span>
          <h1>{{ 'auth.login.title' | translate }}</h1>
          <p>{{ 'auth.login.subtitle' | translate }}</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" class="auth-form" novalidate>

          <!-- Global error -->
          <div class="alert-error" *ngIf="serverError()">{{ serverError() }}</div>

          <!-- Phone -->
          <div class="field">
            <label for="phone">{{ 'auth.login.phone' | translate }}</label>
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
            <label for="password">{{ 'auth.login.password' | translate }}</label>
            <input
              id="password"
              type="password"
              formControlName="password"
              placeholder="Your password"
              autocomplete="current-password"
              [class.input-error]="fieldError('password')"
            />
            <span class="field-error" *ngIf="fieldError('password')">{{ fieldError('password') }}</span>
          </div>

          <!-- Forgot password -->
          <div class="forgot-row">
            <a routerLink="/forgot-password" class="link-subtle">{{ 'auth.login.forgot' | translate }}</a>
          </div>

          <!-- Submit -->
          <button type="submit" class="btn-primary btn-full" [disabled]="pending()">
            {{ pending() ? ('auth.login.submitting' | translate) : ('auth.login.submit' | translate) }}
          </button>

          <!-- Register -->
          <p class="auth-switch">
            {{ 'auth.login.no_account' | translate }}
            <a routerLink="/register" class="link-primary">{{ 'auth.login.register_link' | translate }}</a>
          </p>

        </form>
      </div>
    </div>
  `,
  styles: [`@import url('../../../../../styles/auth.shared.css');`],
})
export class LoginComponent {
  private readonly fb       = inject(FormBuilder);
  private readonly authApi  = inject(AuthApiService);
  private readonly authState = inject(AuthStateService);
  private readonly router   = inject(Router);
  private readonly translate = inject(TranslateService);

  readonly pending     = signal(false);
  readonly serverError = signal<string | null>(null);
  private fieldErrors  = signal<Record<string, string[]>>({});

  readonly form = this.fb.group({
    phone:    ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  fieldError(name: string): string | null {
    const ctrl = this.form.get(name);
    if (ctrl?.touched && ctrl.invalid) {
      if (ctrl.errors?.['required']) return this.translate.instant('common.required');
      if (ctrl.errors?.['minlength']) return this.translate.instant('common.min_length', { length: ctrl.errors['minlength'].requiredLength });
    }
    const serverErrs = this.fieldErrors()[name];
    return serverErrs?.[0] ?? null;
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.pending()) return;

    this.pending.set(true);
    this.serverError.set(null);
    this.fieldErrors.set({});

    const { phone, password } = this.form.getRawValue();

    this.authApi.login({ phone: phone!, password: password! }).subscribe({
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
