import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthApiService } from '../../../../core/api/auth-api.service';
import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { DeviceSession } from '../../../../shared/models/api.models';

@Component({
  selector: 'app-security',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, ReactiveFormsModule, TranslateModule],
  template: `
    <div class="page">
      <h1 class="page-title">{{ 'security.title' | translate }}</h1>

      <!-- Email verification section -->
      <div class="settings-section">
        <div class="section-header">
          <div>
            <h2 class="section-title">{{ 'security.email_status.title' | translate }}</h2>
            <p class="section-desc">{{ authState.user()?.email }}</p>
          </div>
          @if (authState.isEmailVerified()) {
            <span class="badge-verified">{{ 'security.email_status.verified' | translate }}</span>
          } @else {
            <span class="badge-unverified">{{ 'security.email_status.unverified' | translate }}</span>
          }
        </div>

        @if (!authState.isEmailVerified()) {
          @if (authState.verificationDeadline()) {
            <p class="deadline-warning">
              {{ 'security.email_status.deadline' | translate:{date: (authState.verificationDeadline()! | date:'MMM d, y, HH:mm')} }}
            </p>
          }
          <div class="email-actions">
            <button class="btn-outline" (click)="resendVerification()" [disabled]="resending() || resentOk()">
              {{ resending() ? ('security.email_status.resending' | translate) : resentOk() ? ('security.email_status.sent' | translate) : ('security.email_status.resend_btn' | translate) }}
            </button>
          </div>
        }

        <!-- Change email form -->
        @if (showChangeEmail()) {
          <form [formGroup]="emailForm" (ngSubmit)="changeEmail()" class="settings-form" style="margin-top:16px" novalidate>
            <div class="field">
              <label for="new-email">Новый email</label>
              <input id="new-email" type="email" formControlName="email" autocomplete="email" />
            </div>
            @if (emailError()) {
              <div class="error-msg" role="alert">{{ emailError() }}</div>
            }
            @if (emailSuccess()) {
              <div class="success-msg" role="status">{{ 'security.email_status.sent' | translate }}</div>
            }
            <div class="form-row-actions">
              <button type="submit" class="btn-primary" [disabled]="emailForm.invalid || changingEmail()">
                {{ changingEmail() ? 'Сохранение...' : 'Сохранить' }}
              </button>
              <button type="button" class="btn-outline" (click)="showChangeEmail.set(false)">{{ 'common.cancel' | translate }}</button>
            </div>
          </form>
        } @else {
          <button class="btn-text" (click)="showChangeEmail.set(true)" style="margin-top:12px">
            {{ 'security.email_status.change_email_btn' | translate }}
          </button>
        }
      </div>

      <!-- Change password section -->
      <div class="settings-section">
        <div class="section-header">
          <div>
            <h2 class="section-title">{{ 'security.password.title' | translate }}</h2>
            <p class="section-desc">{{ 'security.password.hint' | translate }}</p>
          </div>
        </div>

        <form [formGroup]="pwdForm" (ngSubmit)="changePassword()" class="settings-form" novalidate>
          <div class="field">
            <label for="current-pwd">{{ 'security.password.current' | translate }}</label>
            <input id="current-pwd" type="password" formControlName="current_password" autocomplete="current-password" />
          </div>
          <div class="field">
            <label for="new-pwd">{{ 'security.password.new' | translate }}</label>
            <input id="new-pwd" type="password" formControlName="password" autocomplete="new-password" />
            @if (pwdForm.get('password')?.touched && pwdForm.get('password')?.errors?.['minlength']) {
              <span class="field-error">{{ 'security.password.new_hint' | translate }}</span>
            }
          </div>
          <div class="field">
            <label for="confirm-pwd">{{ 'security.password.confirm' | translate }}</label>
            <input id="confirm-pwd" type="password" formControlName="password_confirmation" autocomplete="new-password" />
            @if (pwdForm.errors?.['mismatch'] && pwdForm.get('password_confirmation')?.touched) {
              <span class="field-error">{{ 'security.password.mismatch' | translate }}</span>
            }
          </div>
          @if (pwdError()) {
            <div class="error-msg" role="alert">{{ pwdError() }}</div>
          }
          @if (pwdSuccess()) {
            <div class="success-msg" role="status">{{ 'security.password.success' | translate }}</div>
          }
          <button type="submit" class="btn-primary" [disabled]="pwdForm.invalid || changingPwd()">
            {{ changingPwd() ? ('security.password.submitting' | translate) : ('security.password.submit' | translate) }}
          </button>
        </form>
      </div>

      <!-- Active sessions section -->
      <div class="settings-section">
        <div class="section-header">
          <div>
            <h2 class="section-title">{{ 'security.sessions.title' | translate }}</h2>
            <p class="section-desc">{{ 'security.sessions.hint' | translate }}</p>
          </div>
          <button class="btn-danger-outline" (click)="logoutAll()" [disabled]="loggingOutAll()">
            {{ loggingOutAll() ? ('security.sessions.logging_out' | translate) : ('security.sessions.logout_all' | translate) }}
          </button>
        </div>

        @if (loadingSessions()) {
          <div class="loading-state">{{ 'security.sessions.loading' | translate }}</div>
        } @else {
          <div class="sessions-list">
            @for (session of sessions(); track session.id) {
              <div class="session-item">
                <div class="session-icon" aria-hidden="true">💻</div>
                <div class="session-info">
                  <p class="session-device">{{ session.device_name }}</p>
                  <p class="session-meta">
                    {{ session.ip_address ?? ('security.sessions.unknown_ip' | translate) }}
                    · {{ 'security.sessions.last_active' | translate:{date: (session.last_active_at | date:'MMM d, y, HH:mm')} }}
                  </p>
                </div>
                <button class="btn-mini-danger" (click)="deleteSession(session)">
                  {{ 'security.sessions.end_session' | translate }}
                </button>
              </div>
            }
            @if (sessions().length === 0) {
              <div class="empty-state">{{ 'security.sessions.empty' | translate }}</div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .page { padding: 28px 32px; max-width: 700px; }
    .page-title { font-size: 1.6rem; font-weight: 700; color: #1a1a2e; margin: 0 0 28px; }

    .settings-section { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 24px 28px; margin-bottom: 22px; }
    .section-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; gap: 12px; }
    .section-title { font-size: 1rem; font-weight: 700; margin: 0 0 4px; }
    .section-desc { font-size: 0.85rem; color: #9ca3af; margin: 0; }

    .badge-verified { display: inline-block; padding: 4px 12px; background: #dcfce7; color: #16a34a; border-radius: 99px; font-size: 0.8rem; font-weight: 600; flex-shrink: 0; }
    .badge-unverified { display: inline-block; padding: 4px 12px; background: #fef9c3; color: #a16207; border-radius: 99px; font-size: 0.8rem; font-weight: 600; flex-shrink: 0; }
    .deadline-warning { font-size: 0.85rem; color: #b45309; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; }
    .email-actions { display: flex; gap: 10px; flex-wrap: wrap; }

    .settings-form { display: flex; flex-direction: column; gap: 14px; }
    .field { display: flex; flex-direction: column; gap: 5px; }
    .field label { font-size: 0.86rem; font-weight: 600; color: #374151; }
    .field input { padding: 9px 12px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; outline: none; }
    .field input:focus { border-color: #6366f1; }
    .field-error { color: #dc2626; font-size: 0.8rem; }
    .error-msg { color: #dc2626; font-size: 0.85rem; }
    .success-msg { color: #16a34a; font-size: 0.85rem; background: #f0fdf4; padding: 8px 12px; border-radius: 6px; }
    .form-row-actions { display: flex; gap: 10px; }

    .sessions-list { display: flex; flex-direction: column; gap: 8px; }
    .session-item { display: flex; align-items: center; gap: 14px; padding: 12px 16px; background: #f9fafb; border: 1px solid #f0f0f0; border-radius: 10px; }
    .session-icon { font-size: 1.4rem; flex-shrink: 0; }
    .session-info { flex: 1; }
    .session-device { font-size: 0.9rem; font-weight: 600; margin: 0 0 3px; }
    .session-meta { font-size: 0.8rem; color: #9ca3af; margin: 0; }
    .empty-state { text-align: center; color: #c4c4c4; font-size: 0.88rem; padding: 16px; font-style: italic; }
    .loading-state { text-align: center; color: #9ca3af; padding: 20px; font-size: 0.9rem; }

    .btn-primary { display: inline-flex; padding: 9px 18px; background: #6366f1; color: #fff; border: none; border-radius: 8px; font-size: 0.9rem; font-weight: 600; cursor: pointer; align-self: flex-start; }
    .btn-primary:hover:not(:disabled) { background: #4f46e5; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-outline { padding: 8px 16px; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.86rem; cursor: pointer; color: #374151; }
    .btn-outline:hover:not(:disabled) { background: #f9fafb; }
    .btn-outline:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-danger-outline { padding: 8px 14px; background: #fff; border: 1px solid #fca5a5; color: #dc2626; border-radius: 8px; font-size: 0.86rem; cursor: pointer; flex-shrink: 0; }
    .btn-danger-outline:hover:not(:disabled) { background: #fff5f5; }
    .btn-danger-outline:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-mini-danger { padding: 5px 12px; background: #fff; border: 1px solid #fca5a5; color: #dc2626; border-radius: 6px; font-size: 0.8rem; cursor: pointer; flex-shrink: 0; }
    .btn-mini-danger:hover { background: #fff5f5; }
    .btn-text { background: none; border: none; color: #6366f1; font-size: 0.86rem; cursor: pointer; padding: 0; text-decoration: underline; }
    .btn-text:hover { color: #4f46e5; }
  `],
})
export class SecurityComponent implements OnInit {
  private readonly authApi   = inject(AuthApiService);
  readonly authState         = inject(AuthStateService);
  private readonly fb        = inject(FormBuilder);
  private readonly router    = inject(Router);
  private readonly translate = inject(TranslateService);

  readonly sessions        = signal<DeviceSession[]>([]);
  readonly loadingSessions = signal(false);
  readonly changingPwd     = signal(false);
  readonly loggingOutAll   = signal(false);
  readonly pwdError        = signal<string | null>(null);
  readonly pwdSuccess      = signal(false);

  readonly resending       = signal(false);
  readonly resentOk        = signal(false);
  readonly showChangeEmail = signal(false);
  readonly changingEmail   = signal(false);
  readonly emailError      = signal<string | null>(null);
  readonly emailSuccess    = signal(false);

  readonly pwdForm = this.fb.group({
    current_password:      ['', [Validators.required]],
    password:              ['', [Validators.required, Validators.minLength(8)]],
    password_confirmation: ['', [Validators.required]],
  }, {
    validators: (g) => {
      const p = g.get('password')?.value;
      const c = g.get('password_confirmation')?.value;
      return p && c && p !== c ? { mismatch: true } : null;
    },
  });

  readonly emailForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  ngOnInit(): void {
    this.loadSessions();
  }

  loadSessions(): void {
    this.loadingSessions.set(true);
    this.authApi.sessions().subscribe({
      next: (res) => {
        this.sessions.set(res.data.items);
        this.loadingSessions.set(false);
      },
      error: () => this.loadingSessions.set(false),
    });
  }

  resendVerification(): void {
    this.resending.set(true);
    this.authApi.resendVerification().subscribe({
      next: () => {
        this.resending.set(false);
        this.resentOk.set(true);
        setTimeout(() => this.resentOk.set(false), 5000);
      },
      error: () => this.resending.set(false),
    });
  }

  changeEmail(): void {
    if (this.emailForm.invalid || this.changingEmail()) return;
    this.changingEmail.set(true);
    this.emailError.set(null);
    this.emailSuccess.set(false);

    const { email } = this.emailForm.getRawValue();
    this.authApi.changeEmail({ email: email! }).subscribe({
      next: (res) => {
        this.changingEmail.set(false);
        this.authState.updateUser(res.data.user);
        this.emailSuccess.set(true);
        this.emailForm.reset();
        setTimeout(() => {
          this.emailSuccess.set(false);
          this.showChangeEmail.set(false);
        }, 3000);
      },
      error: (err) => {
        this.changingEmail.set(false);
        this.emailError.set(err?.message ?? 'Не удалось сменить email');
      },
    });
  }

  changePassword(): void {
    this.pwdForm.markAllAsTouched();
    if (this.pwdForm.invalid || this.changingPwd()) return;

    this.changingPwd.set(true);
    this.pwdError.set(null);
    this.pwdSuccess.set(false);

    const { current_password, password, password_confirmation } = this.pwdForm.getRawValue();

    this.authApi.changePassword({
      current_password: current_password!,
      password: password!,
      password_confirmation: password_confirmation!,
    }).subscribe({
      next: () => {
        this.changingPwd.set(false);
        this.pwdSuccess.set(true);
        this.pwdForm.reset();
        setTimeout(() => this.pwdSuccess.set(false), 5000);
      },
      error: (err) => {
        this.changingPwd.set(false);
        this.pwdError.set(err?.message ?? this.translate.instant('security.password.error'));
      },
    });
  }

  deleteSession(session: DeviceSession): void {
    this.authApi.deleteSession(session.id).subscribe(() => {
      this.sessions.update((ss) => ss.filter((s) => s.id !== session.id));
    });
  }

  logoutAll(): void {
    if (!confirm(this.translate.instant('security.sessions.logout_all_confirm'))) return;
    this.loggingOutAll.set(true);
    this.authApi.logoutAll().subscribe({
      next: () => {
        this.authState.clearUser();
        this.router.navigate(['/login']);
      },
      error: () => this.loggingOutAll.set(false),
    });
  }
}
