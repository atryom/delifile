import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { provideTranslateService } from '@ngx-translate/core';
import { AuthApiService } from '../../../../core/api/auth-api.service';
import { ForgotPasswordComponent } from './forgot-password.component';

describe('ForgotPasswordComponent', () => {
  const mockAuthApi = {
    forgotPassword: vi.fn(),
    verifyResetToken: vi.fn(),
    resetPassword: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [
        provideTranslateService(),
        { provide: AuthApiService, useValue: mockAuthApi },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should start on email step', () => {
    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    expect(fixture.componentInstance.step()).toBe('email');
  });

  it('should validate email form', () => {
    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    const email = fixture.componentInstance.emailForm.get('email');
    expect(email?.valid).toBe(false);
    email?.setValue('test@test.com');
    expect(email?.valid).toBe(true);
  });

  // ─── Step 1: email ──────────────────────────────────────────────

  it('should send email and advance to code step on success', () => {
    mockAuthApi.forgotPassword.mockReturnValue(of({}));

    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    fixture.componentInstance.emailForm.setValue({ email: 'test@test.com' });
    fixture.componentInstance.submitEmail();

    expect(mockAuthApi.forgotPassword).toHaveBeenCalledWith('test@test.com');
    expect(fixture.componentInstance.step()).toBe('code');
  });

  it('should advance to code step even on error (security)', () => {
    mockAuthApi.forgotPassword.mockReturnValue(throwError(() => ({})));

    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    fixture.componentInstance.emailForm.setValue({ email: 'test@test.com' });
    fixture.componentInstance.submitEmail();

    expect(fixture.componentInstance.step()).toBe('code');
  });

  it('should not submit email form when invalid', () => {
    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    fixture.componentInstance.submitEmail();
    expect(mockAuthApi.forgotPassword).not.toHaveBeenCalled();
  });

  // ─── Step 2: code ───────────────────────────────────────────────

  it('should validate code as 6 digits', () => {
    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    const code = fixture.componentInstance.codeForm.get('code');
    code?.setValue('12345');
    expect(code?.valid).toBe(false);
    code?.setValue('123456');
    expect(code?.valid).toBe(true);
  });

  it('should verify code and advance to password step', () => {
    mockAuthApi.verifyResetToken.mockReturnValue(of({
      data: { token: 'reset-token-123' },
    }));

    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    fixture.componentInstance.step.set('code');
    fixture.componentInstance.submittedEmail = 'test@test.com';
    fixture.componentInstance.codeForm.setValue({ code: '123456' });
    fixture.componentInstance.submitCode();

    expect(mockAuthApi.verifyResetToken).toHaveBeenCalledWith('123456', 'test@test.com');
    expect(fixture.componentInstance.step()).toBe('password');
    expect(fixture.componentInstance['resetToken']).toBe('reset-token-123');
  });

  it('should show error on invalid code', () => {
    mockAuthApi.verifyResetToken.mockReturnValue(throwError(() => ({})));

    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    fixture.componentInstance.step.set('code');
    fixture.componentInstance.codeForm.setValue({ code: '000000' });
    fixture.componentInstance.submitCode();

    expect(fixture.componentInstance.error()).toBe('auth.forgot.code_invalid');
    expect(fixture.componentInstance.step()).toBe('code');
  });

  // ─── Step 3: password ───────────────────────────────────────────

  it('should validate password confirmation match', () => {
    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    const form = fixture.componentInstance.passwordForm;
    form.setValue({ password: 'newpass123', password_confirmation: 'different' });
    expect(form.valid).toBe(false);
    expect(form.errors?.['mismatch']).toBe(true);
  });

  it('should reset password and show done step', () => {
    mockAuthApi.resetPassword.mockReturnValue(of({}));

    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    fixture.componentInstance.step.set('password');
    fixture.componentInstance['resetToken'] = 'tok-1';
    fixture.componentInstance.passwordForm.setValue({
      password: 'newpass123',
      password_confirmation: 'newpass123',
    });
    fixture.componentInstance.submitPassword();

    expect(mockAuthApi.resetPassword).toHaveBeenCalledWith('tok-1', 'newpass123', 'newpass123');
    expect(fixture.componentInstance.step()).toBe('done');
  });

  it('should show error on reset failure', () => {
    mockAuthApi.resetPassword.mockReturnValue(throwError(() => ({
      message: 'Token expired',
    })));

    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    fixture.componentInstance.step.set('password');
    fixture.componentInstance['resetToken'] = 'tok-1';
    fixture.componentInstance.passwordForm.setValue({
      password: 'newpass123',
      password_confirmation: 'newpass123',
    });
    fixture.componentInstance.submitPassword();

    expect(fixture.componentInstance.error()).toBe('Token expired');
  });

  it('should not submit password form when invalid', () => {
    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    fixture.componentInstance.step.set('password');
    fixture.componentInstance.submitPassword();
    expect(mockAuthApi.resetPassword).not.toHaveBeenCalled();
  });
});
