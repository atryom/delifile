import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthApiService } from '../../../../core/api/auth-api.service';

type Step = 'email' | 'code' | 'password' | 'done';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslateModule],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
})
export class ForgotPasswordComponent {
  private readonly authApi   = inject(AuthApiService);
  private readonly fb        = inject(FormBuilder);
  private readonly translate = inject(TranslateService);

  readonly step    = signal<Step>('email');
  readonly pending = signal(false);
  readonly error   = signal<string | null>(null);

  /** email entered on step 1, used for code lookup */
  private submittedEmail = '';
  /** full token returned after code verification, used in step 3 */
  private resetToken = '';

  readonly emailForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly codeForm = this.fb.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  readonly passwordForm = this.fb.group({
    password:              ['', [Validators.required, Validators.minLength(8)]],
    password_confirmation: ['', [Validators.required]],
  }, {
    validators: (g) => {
      const p = g.get('password')?.value;
      const c = g.get('password_confirmation')?.value;
      return p && c && p !== c ? { mismatch: true } : null;
    },
  });

  submitEmail(): void {
    this.emailForm.markAllAsTouched();
    if (this.emailForm.invalid || this.pending()) return;

    this.pending.set(true);
    this.error.set(null);
    this.submittedEmail = this.emailForm.getRawValue().email!;

    this.authApi.forgotPassword(this.submittedEmail).subscribe({
      next: () => {
        this.pending.set(false);
        this.step.set('code');
      },
      error: () => {
        this.pending.set(false);
        // Show code step anyway — don't reveal server errors
        this.step.set('code');
      },
    });
  }

  submitCode(): void {
    this.codeForm.markAllAsTouched();
    if (this.codeForm.invalid || this.pending()) return;

    this.pending.set(true);
    this.error.set(null);

    const code = this.codeForm.getRawValue().code!;

    this.authApi.verifyResetToken(code, this.submittedEmail).subscribe({
      next: (res) => {
        this.pending.set(false);
        this.resetToken = res.data.token;
        this.step.set('password');
      },
      error: () => {
        this.pending.set(false);
        this.error.set(this.translate.instant('auth.forgot.code_invalid'));
      },
    });
  }

  submitPassword(): void {
    this.passwordForm.markAllAsTouched();
    if (this.passwordForm.invalid || this.pending()) return;

    this.pending.set(true);
    this.error.set(null);

    const { password, password_confirmation } = this.passwordForm.getRawValue();

    this.authApi.resetPassword(this.resetToken, password!, password_confirmation!).subscribe({
      next: () => {
        this.pending.set(false);
        this.step.set('done');
      },
      error: (err) => {
        this.pending.set(false);
        this.error.set(err?.message ?? this.translate.instant('auth.forgot.reset_error'));
      },
    });
  }
}
