import { Component, inject, signal, input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthApiService } from '../../../../core/api/auth-api.service';
import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { InvitationsApiService } from '../../../../core/api/invitations-api.service';
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
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent implements OnInit {
  private readonly fb        = inject(FormBuilder);
  private readonly authApi   = inject(AuthApiService);
  private readonly authState = inject(AuthStateService);
  private readonly invApi    = inject(InvitationsApiService);
  private readonly router    = inject(Router);
  private readonly translate = inject(TranslateService);

  // Bound from query params via withComponentInputBinding()
  readonly email  = input<string>('');
  readonly invite = input<string>('');

  readonly pending     = signal(false);
  readonly serverError = signal<string | null>(null);
  private fieldErrors  = signal<Record<string, string[]>>({});

  readonly form = this.fb.group({
    email:                 ['', [Validators.required, Validators.email]],
    password:              ['', [Validators.required, Validators.minLength(8)]],
    password_confirmation: ['', [Validators.required]],
    privacyAccepted:       [false, [Validators.requiredTrue]],
  }, { validators: passwordMatchValidator });

  ngOnInit(): void {
    const emailVal = this.email();
    if (emailVal) {
      this.form.patchValue({ email: emailVal });
    }
  }

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
    const inviteToken = this.invite();

    this.authApi.register({
      email: email!,
      password: password!,
      password_confirmation: password_confirmation!,
    }).subscribe({
      next: (res) => {
        this.authState.setUser(res.data.user, res.data.token);
        if (inviteToken) {
          this.invApi.accept(inviteToken).subscribe({
            next:  () => this.router.navigate(['/files']),
            error: () => this.router.navigate(['/files']),
          });
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
