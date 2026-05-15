import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { AuthApiService } from '../../../../core/api/auth-api.service';
import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { DeviceService } from '../../../../core/services/device.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  const mockAuthApi = {
    login: vi.fn(),
  };
  const mockAuthState = {
    setUser: vi.fn(),
  };
  const mockDevice = {
    getDeviceId: vi.fn(() => 'device-1'),
    getDeviceType: vi.fn(() => 'web'),
  };
  const mockRouter = {
    navigate: vi.fn(),
    navigateByUrl: vi.fn(),
  };
  const mockActivatedRoute = {
    snapshot: { queryParamMap: { get: () => null } },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: AuthApiService, useValue: mockAuthApi },
        { provide: AuthStateService, useValue: mockAuthState },
        { provide: DeviceService, useValue: mockDevice },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: TranslateService, useValue: { instant: (k: string) => k } },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should have form with email, password and remember controls', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    expect(fixture.componentInstance.form.contains('email')).toBe(true);
    expect(fixture.componentInstance.form.contains('password')).toBe(true);
    expect(fixture.componentInstance.form.contains('remember')).toBe(true);
  });

  it('should validate email as required', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const email = fixture.componentInstance.form.get('email');
    email?.setValue('');
    expect(email?.valid).toBe(false);
    expect(email?.errors?.['required']).toBe(true);
  });

  it('should validate email format', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const email = fixture.componentInstance.form.get('email');
    email?.setValue('invalid');
    expect(email?.valid).toBe(false);
    expect(email?.errors?.['email']).toBe(true);
  });

  it('should validate password min length', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const password = fixture.componentInstance.form.get('password');
    password?.setValue('short');
    expect(password?.valid).toBe(false);
    expect(password?.errors?.['minlength']).toBeTruthy();
  });

  it('should call authApi.login on valid submit', () => {
    mockAuthApi.login.mockReturnValue(of({
      result: 'success',
      message: 'OK',
      data: { user: { id: '1', account_status: 'active' }, token: 'token-123' },
    }));

    const fixture = TestBed.createComponent(LoginComponent);
    fixture.componentInstance.form.setValue({
      email: 'test@test.com',
      password: 'password123',
      remember: true,
    });
    fixture.componentInstance.submit();

    expect(mockAuthApi.login).toHaveBeenCalledWith({
      email: 'test@test.com',
      password: 'password123',
      device_id: 'device-1',
      device_type: 'web',
    });
    expect(mockAuthState.setUser).toHaveBeenCalledWith(
      { id: '1', account_status: 'active' },
      'token-123',
      true,
    );
    expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/files');
  });

  it('should navigate to /account-blocked when user is blocked', () => {
    mockAuthApi.login.mockReturnValue(of({
      result: 'success',
      message: 'OK',
      data: {
        user: { id: '1', account_status: 'blocked_unverified_email' },
        token: 'token-123',
      },
    }));

    const fixture = TestBed.createComponent(LoginComponent);
    fixture.componentInstance.form.setValue({
      email: 'test@test.com',
      password: 'password123',
      remember: true,
    });
    fixture.componentInstance.submit();

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/account-blocked']);
  });

  it('should show server error on ACCOUNT_BLOCKED api error', () => {
    mockAuthApi.login.mockReturnValue(throwError(() => ({
      data: { code: 'ACCOUNT_BLOCKED' },
    })));

    const fixture = TestBed.createComponent(LoginComponent);
    fixture.componentInstance.form.setValue({
      email: 'test@test.com',
      password: 'password123',
      remember: true,
    });
    fixture.componentInstance.submit();

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/account-blocked']);
  });

  it('should show server error on login failure', () => {
    mockAuthApi.login.mockReturnValue(throwError(() => ({
      message: 'Invalid credentials',
      data: { code: 'INVALID_CREDENTIALS', errors: {} },
    })));

    const fixture = TestBed.createComponent(LoginComponent);
    fixture.componentInstance.form.setValue({
      email: 'test@test.com',
      password: 'password123',
      remember: true,
    });
    fixture.componentInstance.submit();

    expect(fixture.componentInstance.serverError()).toBe('Invalid credentials');
  });

  it('should not submit when form is invalid', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.componentInstance.submit();

    expect(mockAuthApi.login).not.toHaveBeenCalled();
  });
});
