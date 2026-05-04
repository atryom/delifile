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
  templateUrl: './security.component.html',
  styleUrl: './security.component.scss',
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
