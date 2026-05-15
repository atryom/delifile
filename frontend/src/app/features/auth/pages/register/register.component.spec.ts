import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { provideTranslateService } from '@ngx-translate/core';
import { AuthApiService } from '../../../../core/api/auth-api.service';
import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { InvitationsApiService } from '../../../../core/api/invitations-api.service';
import { RegisterComponent } from './register.component';

describe('RegisterComponent', () => {
  const mockAuthApi = {
    register: vi.fn(),
  };
  const mockAuthState = {
    setUser: vi.fn(),
  };
  const mockInvApi = {
    accept: vi.fn(),
  };
  const mockRouter = { navigate: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        provideTranslateService(),
        { provide: AuthApiService, useValue: mockAuthApi },
        { provide: AuthStateService, useValue: mockAuthState },
        { provide: InvitationsApiService, useValue: mockInvApi },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(RegisterComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should have password confirmation mismatch validator', () => {
    const fixture = TestBed.createComponent(RegisterComponent);
    const form = fixture.componentInstance.form;
    form.setValue({
      email: 'test@test.com',
      password: 'pass1234',
      password_confirmation: 'different',
      privacyAccepted: true,
    });
    expect(form.errors?.['passwordMismatch']).toBe(true);
  });

  it('should validate privacyAccepted as required true', () => {
    const fixture = TestBed.createComponent(RegisterComponent);
    const ctrl = fixture.componentInstance.form.get('privacyAccepted');
    ctrl?.markAsTouched();
    expect(fixture.componentInstance.privacyError()).toBe(true);
    ctrl?.setValue(true);
    expect(fixture.componentInstance.privacyError()).toBe(false);
  });

  it('should patch email from input', () => {
    const fixture = TestBed.createComponent(RegisterComponent);
    fixture.componentRef.setInput('email', 'invited@test.com');
    fixture.detectChanges(); // triggers ngOnInit

    expect(fixture.componentInstance.form.get('email')?.value).toBe('invited@test.com');
  });

  // ─── Submit without invite ──────────────────────────────────────

  it('should register and navigate to /files', () => {
    mockAuthApi.register.mockReturnValue(of({
      data: { user: { id: '1' }, token: 'tok' },
    }));

    const fixture = TestBed.createComponent(RegisterComponent);
    fixture.componentInstance.form.setValue({
      email: 'new@test.com',
      password: 'password123',
      password_confirmation: 'password123',
      privacyAccepted: true,
    });
    fixture.componentInstance.submit();

    expect(mockAuthApi.register).toHaveBeenCalledWith({
      email: 'new@test.com',
      password: 'password123',
      password_confirmation: 'password123',
    });
    expect(mockAuthState.setUser).toHaveBeenCalledWith({ id: '1' }, 'tok');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/files']);
  });

  // ─── Submit with invite ─────────────────────────────────────────

  it('should accept invite after registration', () => {
    mockAuthApi.register.mockReturnValue(of({
      data: { user: { id: '1' }, token: 'tok' },
    }));
    mockInvApi.accept.mockReturnValue(of({}));

    const fixture = TestBed.createComponent(RegisterComponent);
    fixture.componentRef.setInput('invite', 'invite-token');
    fixture.componentInstance.form.setValue({
      email: 'invited@test.com',
      password: 'password123',
      password_confirmation: 'password123',
      privacyAccepted: true,
    });
    fixture.componentInstance.submit();

    expect(mockAuthApi.register).toHaveBeenCalled();
    expect(mockInvApi.accept).toHaveBeenCalledWith('invite-token');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/files']);
  });

  // ─── Error handling ─────────────────────────────────────────────

  it('should set server error on registration failure', () => {
    mockAuthApi.register.mockReturnValue(throwError(() => ({
      message: 'Email taken',
      data: { code: 'EMAIL_EXISTS', errors: {} },
    })));

    const fixture = TestBed.createComponent(RegisterComponent);
    fixture.componentInstance.form.setValue({
      email: 'existing@test.com',
      password: 'password123',
      password_confirmation: 'password123',
      privacyAccepted: true,
    });
    fixture.componentInstance.submit();

    expect(fixture.componentInstance.serverError()).toBe('Email taken');
  });

  it('should set field errors on validation error', () => {
    mockAuthApi.register.mockReturnValue(throwError(() => ({
      message: 'Validation failed',
      data: {
        code: 'VALIDATION_ERROR',
        errors: { email: ['Email already in use'] },
      },
    })));

    const fixture = TestBed.createComponent(RegisterComponent);
    fixture.componentInstance.form.setValue({
      email: 'existing@test.com',
      password: 'password123',
      password_confirmation: 'password123',
      privacyAccepted: true,
    });
    fixture.componentInstance.submit();

    expect(fixture.componentInstance.serverError()).toBeNull();
  });

  it('should not submit when form is invalid', () => {
    const fixture = TestBed.createComponent(RegisterComponent);
    fixture.componentInstance.submit();
    expect(mockAuthApi.register).not.toHaveBeenCalled();
  });
});
