import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthApiService } from '../../../../core/api/auth-api.service';
import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { ApiError } from '../../../../shared/models/api.models';

@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslateModule],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-header">
          <span class="auth-logo"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
                                       fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                       stroke-linejoin="round"
                                       class="lucide lucide-file-symlink-icon lucide-file-symlink"><path
            d="M4 11V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h7"/><path
            d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="m10 18 3-3-3-3"/></svg></span>
          <h1>{{ 'auth.login.title' | translate }}</h1>
          <p>{{ 'auth.login.subtitle' | translate }}</p>
        </div>

        @if (emailVerifiedParam() === 'true') {
          <div class="alert-success">{{ 'auth.login.email_verified_success' | translate }}</div>
        }
        @if (emailVerifiedParam() === 'false') {
          <div class="alert-error">{{ 'auth.login.email_verify_failed' | translate }}</div>
        }

        <form [formGroup]="form" (ngSubmit)="submit()" class="auth-form" novalidate>

          @if (serverError()) {
            <div class="alert-error">{{ serverError() }}</div>
          }

          <div class="field">
            <label for="email">{{ 'auth.login.email' | translate }}</label>
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

          <div class="remember-row">
            <label class="remember-label">
              <input type="checkbox" formControlName="remember" class="remember-check"/>
              {{ 'auth.login.remember_me' | translate }}
            </label>
          </div>

          <button type="submit" class="btn-primary btn-full" [disabled]="pending()">
            {{ pending() ? ('auth.login.submitting' | translate) : ('auth.login.submit' | translate) }}
          </button>

          <p class="auth-switch">
            {{ 'auth.login.no_account' | translate }}
            <a routerLink="/register" class="link-primary">{{ 'auth.login.register_link' | translate }}</a>
          </p>

        </form>
      </div>
    </div>
  `,
  styles: [`
    @import url('../../../../../styles/auth.shared.css');
    .remember-row { display: flex; align-items: center; margin-bottom: 4px; }
    .remember-label { display: flex; align-items: center; gap: 8px; font-size: 0.88rem; color: #6b7280; cursor: pointer; }
    .remember-check { width: 15px; height: 15px; cursor: pointer; accent-color: #6366f1; }
  `],
})
export class LoginComponent {
  private readonly fb        = inject(FormBuilder);
  private readonly authApi   = inject(AuthApiService);
  private readonly authState = inject(AuthStateService);
  private readonly router    = inject(Router);
  private readonly route     = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);

  readonly pending     = signal(false);
  readonly serverError = signal<string | null>(null);
  private  fieldErrors = signal<Record<string, string[]>>({});

  readonly emailVerifiedParam = signal<string | null>(
    this.route.snapshot.queryParamMap.get('email_verified')
  );

  readonly form = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    remember: [true],
  });

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

    this.authApi.login({ email: email!, password: password! }).subscribe({
      next: (res) => {
        this.authState.setUser(res.data.user, res.data.token, remember ?? true);
        if (res.data.user.account_status === 'blocked_unverified_email') {
          this.router.navigate(['/account-blocked']);
        } else {
          this.router.navigate(['/files']);
        }
      },
      error: (err: ApiError) => {
        this.pending.set(false);
        const code = err.data?.code;
        if (code === 'ACCOUNT_BLOCKED') {
          this.router.navigate(['/account-blocked']);
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
}
