import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthApiService } from '../../../../core/api/auth-api.service';

type State = 'verifying' | 'password' | 'done' | 'error';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslateModule],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent implements OnInit {
  private readonly route     = inject(ActivatedRoute);
  private readonly authApi   = inject(AuthApiService);
  private readonly fb        = inject(FormBuilder);
  private readonly translate = inject(TranslateService);

  readonly state   = signal<State>('verifying');
  readonly pending = signal(false);
  readonly error   = signal<string | null>(null);

  private resetToken = '';

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

  ngOnInit(): void {
    const urlToken = this.route.snapshot.queryParamMap.get('token') ?? '';

    if (!urlToken) {
      this.state.set('error');
      this.error.set(this.translate.instant('auth.reset.no_token'));
      return;
    }

    this.authApi.verifyResetToken(urlToken).subscribe({
      next: (res) => {
        this.resetToken = res.data.token;
        this.state.set('password');
      },
      error: () => {
        this.state.set('error');
        this.error.set(this.translate.instant('auth.reset.token_invalid'));
      },
    });
  }

  submit(): void {
    this.passwordForm.markAllAsTouched();
    if (this.passwordForm.invalid || this.pending()) return;

    this.pending.set(true);
    this.error.set(null);

    const { password, password_confirmation } = this.passwordForm.getRawValue();

    this.authApi.resetPassword(this.resetToken, password!, password_confirmation!).subscribe({
      next: () => {
        this.pending.set(false);
        this.state.set('done');
      },
      error: (err) => {
        this.pending.set(false);
        this.error.set(err?.message ?? this.translate.instant('auth.reset.error'));
      },
    });
  }
}
