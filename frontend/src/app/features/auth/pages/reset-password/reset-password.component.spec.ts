import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { provideTranslateService } from '@ngx-translate/core';
import { AuthApiService } from '../../../../core/api/auth-api.service';
import { ResetPasswordComponent } from './reset-password.component';

describe('ResetPasswordComponent', () => {
  const mockAuthApi = {
    verifyResetToken: vi.fn(),
    resetPassword: vi.fn(),
  };
  const mockRouter = { navigate: vi.fn() };
  let mockActivatedRoute: { snapshot: { queryParamMap: { get: ReturnType<typeof vi.fn> } } };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockActivatedRoute = {
      snapshot: { queryParamMap: { get: vi.fn() } },
    };
  });

  async function createComponent() {
    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [
        provideTranslateService(),
        { provide: AuthApiService, useValue: mockAuthApi },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
    }).compileComponents();
    return TestBed.createComponent(ResetPasswordComponent);
  }

  // ─── Init ───────────────────────────────────────────────────────

  it('should create', async () => {
    mockActivatedRoute.snapshot.queryParamMap.get.mockReturnValue('url-token');
    mockAuthApi.verifyResetToken.mockReturnValue(of({ data: { token: 'real-token' } }));

    const fixture = await createComponent();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should go to error state when no token in url', async () => {
    mockActivatedRoute.snapshot.queryParamMap.get.mockReturnValue('');

    const fixture = await createComponent();
    fixture.detectChanges(); // triggers ngOnInit

    expect(fixture.componentInstance.state()).toBe('error');
    expect(fixture.componentInstance.error()).toBe('auth.reset.no_token');
  });

  it('should verify token and go to password state', async () => {
    mockActivatedRoute.snapshot.queryParamMap.get.mockReturnValue('url-token');
    mockAuthApi.verifyResetToken.mockReturnValue(of({ data: { token: 'real-token' } }));

    const fixture = await createComponent();
    fixture.detectChanges(); // triggers ngOnInit

    expect(mockAuthApi.verifyResetToken).toHaveBeenCalledWith('url-token');
    expect(fixture.componentInstance.state()).toBe('password');
  });

  it('should go to error state when token verification fails', async () => {
    mockActivatedRoute.snapshot.queryParamMap.get.mockReturnValue('bad-token');
    mockAuthApi.verifyResetToken.mockReturnValue(throwError(() => ({})));

    const fixture = await createComponent();
    fixture.detectChanges(); // triggers ngOnInit

    expect(fixture.componentInstance.state()).toBe('error');
    expect(fixture.componentInstance.error()).toBe('auth.reset.token_invalid');
  });

  // ─── Password Form ──────────────────────────────────────────────

  it('should validate password min length', async () => {
    mockActivatedRoute.snapshot.queryParamMap.get.mockReturnValue('tok');
    mockAuthApi.verifyResetToken.mockReturnValue(of({ data: { token: 'real-tok' } }));

    const fixture = await createComponent();
    fixture.detectChanges();

    const pwd = fixture.componentInstance.passwordForm.get('password');
    pwd?.setValue('short');
    expect(pwd?.errors?.['minlength']).toBeTruthy();
  });

  it('should validate password confirmation match', async () => {
    mockActivatedRoute.snapshot.queryParamMap.get.mockReturnValue('tok');
    mockAuthApi.verifyResetToken.mockReturnValue(of({ data: { token: 'real-tok' } }));

    const fixture = await createComponent();
    fixture.detectChanges();

    const form = fixture.componentInstance.passwordForm;
    form.setValue({ password: 'newpass123', password_confirmation: 'different' });
    expect(form.errors?.['mismatch']).toBe(true);
  });

  it('should reset password and go to done state', async () => {
    mockActivatedRoute.snapshot.queryParamMap.get.mockReturnValue('tok');
    mockAuthApi.verifyResetToken.mockReturnValue(of({ data: { token: 'real-tok' } }));
    mockAuthApi.resetPassword.mockReturnValue(of({}));

    const fixture = await createComponent();
    fixture.detectChanges();
    fixture.componentInstance.passwordForm.setValue({
      password: 'newpass123',
      password_confirmation: 'newpass123',
    });
    fixture.componentInstance.submit();

    expect(mockAuthApi.resetPassword).toHaveBeenCalledWith('real-tok', 'newpass123', 'newpass123');
    expect(fixture.componentInstance.state()).toBe('done');
  });

  it('should show error on reset failure', async () => {
    mockActivatedRoute.snapshot.queryParamMap.get.mockReturnValue('tok');
    mockAuthApi.verifyResetToken.mockReturnValue(of({ data: { token: 'real-tok' } }));
    mockAuthApi.resetPassword.mockReturnValue(throwError(() => ({
      message: 'Token expired',
    })));

    const fixture = await createComponent();
    fixture.detectChanges();
    fixture.componentInstance.passwordForm.setValue({
      password: 'newpass123',
      password_confirmation: 'newpass123',
    });
    fixture.componentInstance.submit();

    expect(fixture.componentInstance.error()).toBe('Token expired');
  });

  it('should not submit password form when invalid', async () => {
    mockActivatedRoute.snapshot.queryParamMap.get.mockReturnValue('tok');
    mockAuthApi.verifyResetToken.mockReturnValue(of({ data: { token: 'real-tok' } }));

    const fixture = await createComponent();
    fixture.detectChanges();
    fixture.componentInstance.submit();

    expect(mockAuthApi.resetPassword).not.toHaveBeenCalled();
  });
});
