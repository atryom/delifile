import { Component, inject, signal, OnInit } from '@angular/core';
import { NgIf, NgFor, DatePipe } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthApiService } from '../../../../core/api/auth-api.service';
import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { DeviceSession } from '../../../../shared/models/api.models';

@Component({
  selector: 'app-security',
  standalone: true,
  imports: [NgIf, NgFor, DatePipe, ReactiveFormsModule, TranslateModule],
  template: `
    <div class="page">
      <h1 class="page-title">{{ 'security.title' | translate }}</h1>

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
            <label>{{ 'security.password.current' | translate }}</label>
            <input type="password" formControlName="current_password" autocomplete="current-password" />
          </div>
          <div class="field">
            <label>{{ 'security.password.new' | translate }}</label>
            <input type="password" formControlName="password" autocomplete="new-password" />
            <span class="field-error" *ngIf="pwdForm.get('password')?.touched && pwdForm.get('password')?.errors?.['minlength']">
              {{ 'security.password.new_hint' | translate }}
            </span>
          </div>
          <div class="field">
            <label>{{ 'security.password.confirm' | translate }}</label>
            <input type="password" formControlName="password_confirmation" autocomplete="new-password" />
            <span class="field-error" *ngIf="pwdForm.errors?.['mismatch'] && pwdForm.get('password_confirmation')?.touched">
              {{ 'security.password.mismatch' | translate }}
            </span>
          </div>
          <div class="error-msg" *ngIf="pwdError()">{{ pwdError() }}</div>
          <div class="success-msg" *ngIf="pwdSuccess()">{{ 'security.password.success' | translate }}</div>
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

        <div class="loading-state" *ngIf="loadingSessions()">{{ 'security.sessions.loading' | translate }}</div>

        <div class="sessions-list" *ngIf="!loadingSessions()">
          <div *ngFor="let session of sessions()" class="session-item">
            <div class="session-icon">💻</div>
            <div class="session-info">
              <p class="session-device">{{ session.device_name }}</p>
              <p class="session-meta">
                {{ session.ip_address ?? ('security.sessions.unknown_ip' | translate) }}
                · {{ 'security.sessions.last_active' | translate:{ date: (session.last_active_at | date:'MMM d, y, HH:mm') } }}
              </p>
            </div>
            <button class="btn-mini-danger" (click)="deleteSession(session)">
              {{ 'security.sessions.end_session' | translate }}
            </button>
          </div>

          <div class="empty-state" *ngIf="sessions().length === 0">
            {{ 'security.sessions.empty' | translate }}
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page { padding: 28px 32px; max-width: 700px; }
    .page-title { font-size: 1.6rem; font-weight: 700; color: #1a1a2e; margin: 0 0 28px; }

    .settings-section { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 24px 28px; margin-bottom: 22px; }
    .section-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; gap: 12px; }
    .section-title { font-size: 1rem; font-weight: 700; margin: 0 0 4px; }
    .section-desc { font-size: 0.85rem; color: #9ca3af; margin: 0; }

    .settings-form { display: flex; flex-direction: column; gap: 14px; }
    .field { display: flex; flex-direction: column; gap: 5px; }
    .field label { font-size: 0.86rem; font-weight: 600; color: #374151; }
    .field input { padding: 9px 12px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; outline: none; }
    .field input:focus { border-color: #6366f1; }
    .field-error { color: #dc2626; font-size: 0.8rem; }
    .error-msg { color: #dc2626; font-size: 0.85rem; }
    .success-msg { color: #16a34a; font-size: 0.85rem; background: #f0fdf4; padding: 8px 12px; border-radius: 6px; }

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
    .btn-danger-outline { padding: 8px 14px; background: #fff; border: 1px solid #fca5a5; color: #dc2626; border-radius: 8px; font-size: 0.86rem; cursor: pointer; flex-shrink: 0; }
    .btn-danger-outline:hover:not(:disabled) { background: #fff5f5; }
    .btn-danger-outline:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-mini-danger { padding: 5px 12px; background: #fff; border: 1px solid #fca5a5; color: #dc2626; border-radius: 6px; font-size: 0.8rem; cursor: pointer; flex-shrink: 0; }
    .btn-mini-danger:hover { background: #fff5f5; }
  `],
})
export class SecurityComponent implements OnInit {
  private readonly authApi   = inject(AuthApiService);
  private readonly authState = inject(AuthStateService);
  private readonly fb        = inject(FormBuilder);
  private readonly router    = inject(Router);
  private readonly translate = inject(TranslateService);

  readonly sessions        = signal<DeviceSession[]>([]);
  readonly loadingSessions = signal(false);
  readonly changingPwd     = signal(false);
  readonly loggingOutAll   = signal(false);
  readonly pwdError        = signal<string | null>(null);
  readonly pwdSuccess      = signal(false);

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
