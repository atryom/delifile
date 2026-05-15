import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { provideTranslateService } from '@ngx-translate/core';
import { AuthApiService } from '../../../../core/api/auth-api.service';
import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { UserSettingsApiService } from '../../../../core/api/user-settings-api.service';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { SecurityComponent } from './security.component';

describe('SecurityComponent', () => {
  const mockAuthApi = {
    sessions: vi.fn(),
    resendVerification: vi.fn(),
    changeEmail: vi.fn(),
    changePassword: vi.fn(),
    deleteSession: vi.fn(),
    logoutAll: vi.fn(),
  };
  const mockAuthState = {
    user: vi.fn(),
    isEmailVerified: vi.fn(),
    updateUser: vi.fn(),
    clearUser: vi.fn(),
  };
  const mockSettingsApi = {
    updateSettings: vi.fn(),
    getContactRequests: vi.fn(),
    acceptContactRequest: vi.fn(),
    rejectContactRequest: vi.fn(),
  };
  const mockNotifService = {
    permission: vi.fn(),
    requestPermission: vi.fn(),
  };
  const mockRouter = { navigate: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockAuthState.user.mockReturnValue({
      notifications_enabled: true,
      notify_new_files: true,
      notify_contacts_added: true,
      allow_contacts_without_confirmation: true,
      auto_add_received_files: true,
    });
    mockAuthState.isEmailVerified.mockReturnValue(true);
    await TestBed.configureTestingModule({
      imports: [SecurityComponent],
      providers: [
        provideTranslateService(),
        { provide: AuthApiService, useValue: mockAuthApi },
        { provide: AuthStateService, useValue: mockAuthState },
        { provide: UserSettingsApiService, useValue: mockSettingsApi },
        { provide: NotificationService, useValue: mockNotifService },
        { provide: Router, useValue: mockRouter },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: () => null } } },
        },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    mockAuthApi.sessions.mockReturnValue(of({ data: { items: [] } }));
    mockSettingsApi.getContactRequests.mockReturnValue(of({ data: { items: [] } }));
    const fixture = TestBed.createComponent(SecurityComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  // ─── Sessions ───────────────────────────────────────────────────

  it('should load sessions on init', () => {
    mockAuthApi.sessions.mockReturnValue(of({ data: { items: [] } }));
    mockSettingsApi.getContactRequests.mockReturnValue(of({ data: { items: [] } }));
    const fixture = TestBed.createComponent(SecurityComponent);
    fixture.detectChanges();
    expect(mockAuthApi.sessions).toHaveBeenCalled();
  });

  it('should delete session', () => {
    mockAuthApi.sessions.mockReturnValue(of({
      data: {
        items: [{ id: 's1', device_name: 'Chrome', device_type: 'web',
          ip_address: null, last_active_at: null }],
      },
    }));
    mockSettingsApi.getContactRequests.mockReturnValue(of({ data: { items: [] } }));
    mockAuthApi.deleteSession.mockReturnValue(of({}));

    const fixture = TestBed.createComponent(SecurityComponent);
    fixture.detectChanges();

    fixture.componentInstance.deleteSession(fixture.componentInstance.sessions()[0]);
    expect(mockAuthApi.deleteSession).toHaveBeenCalledWith('s1');
    expect(fixture.componentInstance.sessions().length).toBe(0);
  });

  it('should logout all sessions', () => {
    mockAuthApi.sessions.mockReturnValue(of({ data: { items: [] } }));
    mockSettingsApi.getContactRequests.mockReturnValue(of({ data: { items: [] } }));
    mockAuthApi.logoutAll.mockReturnValue(of({}));
    globalThis.confirm = vi.fn(() => true);

    const fixture = TestBed.createComponent(SecurityComponent);
    fixture.detectChanges();
    fixture.componentInstance.logoutAll();

    expect(mockAuthApi.logoutAll).toHaveBeenCalled();
    expect(mockAuthState.clearUser).toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
  });

  // ─── Password Change ────────────────────────────────────────────

  it('should validate password form', () => {
    mockAuthApi.sessions.mockReturnValue(of({ data: { items: [] } }));
    mockSettingsApi.getContactRequests.mockReturnValue(of({ data: { items: [] } }));
    const fixture = TestBed.createComponent(SecurityComponent);

    const form = fixture.componentInstance.pwdForm;
    form.setValue({
      current_password: 'old',
      password: 'newpass123',
      password_confirmation: 'different',
    });
    expect(form.errors?.['mismatch']).toBe(true);
  });

  it('should change password', () => {
    mockAuthApi.sessions.mockReturnValue(of({ data: { items: [] } }));
    mockSettingsApi.getContactRequests.mockReturnValue(of({ data: { items: [] } }));
    mockAuthApi.changePassword.mockReturnValue(of({}));

    const fixture = TestBed.createComponent(SecurityComponent);
    fixture.detectChanges();

    fixture.componentInstance.pwdForm.setValue({
      current_password: 'old',
      password: 'newpass123',
      password_confirmation: 'newpass123',
    });
    fixture.componentInstance.changePassword();

    expect(mockAuthApi.changePassword).toHaveBeenCalledWith({
      current_password: 'old',
      password: 'newpass123',
      password_confirmation: 'newpass123',
    });
    expect(fixture.componentInstance.pwdSuccess()).toBe(true);
  });

  it('should show error on password change failure', () => {
    mockAuthApi.sessions.mockReturnValue(of({ data: { items: [] } }));
    mockSettingsApi.getContactRequests.mockReturnValue(of({ data: { items: [] } }));
    mockAuthApi.changePassword.mockReturnValue(throwError(() => ({
      message: 'Wrong current password',
    })));

    const fixture = TestBed.createComponent(SecurityComponent);
    fixture.detectChanges();

    fixture.componentInstance.pwdForm.setValue({
      current_password: 'wrong',
      password: 'newpass123',
      password_confirmation: 'newpass123',
    });
    fixture.componentInstance.changePassword();

    expect(fixture.componentInstance.pwdError()).toBe('Wrong current password');
  });

  // ─── Email Change ───────────────────────────────────────────────

  it('should validate email form', () => {
    mockAuthApi.sessions.mockReturnValue(of({ data: { items: [] } }));
    mockSettingsApi.getContactRequests.mockReturnValue(of({ data: { items: [] } }));
    const fixture = TestBed.createComponent(SecurityComponent);

    const ctrl = fixture.componentInstance.emailForm.get('email');
    ctrl?.setValue('invalid');
    expect(ctrl?.errors?.['email']).toBe(true);
    ctrl?.setValue('new@test.com');
    expect(ctrl?.valid).toBe(true);
  });

  it('should change email', () => {
    mockAuthApi.sessions.mockReturnValue(of({ data: { items: [] } }));
    mockSettingsApi.getContactRequests.mockReturnValue(of({ data: { items: [] } }));
    mockAuthApi.changeEmail.mockReturnValue(of({
      data: { user: { id: '1', email: 'new@test.com' } },
    }));

    const fixture = TestBed.createComponent(SecurityComponent);
    fixture.detectChanges();

    fixture.componentInstance.emailForm.setValue({ email: 'new@test.com' });
    fixture.componentInstance.changeEmail();

    expect(mockAuthApi.changeEmail).toHaveBeenCalledWith({ email: 'new@test.com' });
    expect(mockAuthState.updateUser).toHaveBeenCalledWith({ id: '1', email: 'new@test.com' });
  });

  // ─── Resend Verification ────────────────────────────────────────

  it('should resend verification email', () => {
    mockAuthApi.sessions.mockReturnValue(of({ data: { items: [] } }));
    mockSettingsApi.getContactRequests.mockReturnValue(of({ data: { items: [] } }));
    mockAuthApi.resendVerification.mockReturnValue(of({}));

    const fixture = TestBed.createComponent(SecurityComponent);
    fixture.detectChanges();
    fixture.componentInstance.resendVerification();

    expect(mockAuthApi.resendVerification).toHaveBeenCalled();
    expect(fixture.componentInstance.resentOk()).toBe(true);
  });

  // ─── Settings Toggles ───────────────────────────────────────────

  it('should toggle settings and save', () => {
    mockAuthApi.sessions.mockReturnValue(of({ data: { items: [] } }));
    mockSettingsApi.getContactRequests.mockReturnValue(of({ data: { items: [] } }));
    mockSettingsApi.updateSettings.mockReturnValue(of({
      data: {
        user: {
          notifications_enabled: true,
          notify_new_files: false,
          notify_contacts_added: true,
          allow_contacts_without_confirmation: false,
          auto_add_received_files: true,
        },
      },
    }));

    const fixture = TestBed.createComponent(SecurityComponent);
    fixture.detectChanges();

    fixture.componentInstance.toggleNotifyNewFiles(false);
    expect(fixture.componentInstance.notifyNewFiles()).toBe(false);
    expect(mockSettingsApi.updateSettings).toHaveBeenCalled();

    fixture.componentInstance.toggleAllowContacts(false);
    expect(fixture.componentInstance.allowContactsWithout()).toBe(false);
  });

  // ─── Contact Requests ───────────────────────────────────────────

  it('should load contact requests on init', () => {
    mockAuthApi.sessions.mockReturnValue(of({ data: { items: [] } }));
    mockSettingsApi.getContactRequests.mockReturnValue(of({
      data: { items: [{ id: 'cr1', requester: {} as any, status: 'pending', created_at: null }] },
    }));

    const fixture = TestBed.createComponent(SecurityComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.contactRequests().length).toBe(1);
  });

  it('should accept contact request', () => {
    mockAuthApi.sessions.mockReturnValue(of({ data: { items: [] } }));
    mockSettingsApi.getContactRequests.mockReturnValue(of({
      data: { items: [{ id: 'cr1', requester: {} as any, status: 'pending', created_at: null }] },
    }));
    mockSettingsApi.acceptContactRequest.mockReturnValue(of({}));

    const fixture = TestBed.createComponent(SecurityComponent);
    fixture.detectChanges();

    fixture.componentInstance.acceptContactRequest('cr1');
    expect(mockSettingsApi.acceptContactRequest).toHaveBeenCalledWith('cr1');
    expect(fixture.componentInstance.contactRequests().length).toBe(0);
  });

  it('should reject contact request', () => {
    mockAuthApi.sessions.mockReturnValue(of({ data: { items: [] } }));
    mockSettingsApi.getContactRequests.mockReturnValue(of({
      data: { items: [{ id: 'cr1', requester: {} as any, status: 'pending', created_at: null }] },
    }));
    mockSettingsApi.rejectContactRequest.mockReturnValue(of({}));

    const fixture = TestBed.createComponent(SecurityComponent);
    fixture.detectChanges();

    fixture.componentInstance.rejectContactRequest('cr1');
    expect(mockSettingsApi.rejectContactRequest).toHaveBeenCalledWith('cr1');
    expect(fixture.componentInstance.contactRequests().length).toBe(0);
  });
});
