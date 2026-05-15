import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { provideTranslateService } from '@ngx-translate/core';
import { AuthApiService } from '../../../../core/api/auth-api.service';
import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { AccountBlockedComponent } from './account-blocked.component';

describe('AccountBlockedComponent', () => {
  const mockAuthApi = {
    resendVerification: vi.fn(),
    logout: vi.fn(),
  };
  const mockAuthState = {
    clearUser: vi.fn(),
  };
  const mockRouter = {
    navigate: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [AccountBlockedComponent],
      providers: [
        provideTranslateService(),
        { provide: AuthApiService, useValue: mockAuthApi },
        { provide: AuthStateService, useValue: mockAuthState },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(AccountBlockedComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should resend verification on success', () => {
    mockAuthApi.resendVerification.mockReturnValue(of({
      result: 'success', message: 'Email sent', data: {},
    }));

    const fixture = TestBed.createComponent(AccountBlockedComponent);
    fixture.componentInstance.resend();

    expect(mockAuthApi.resendVerification).toHaveBeenCalled();
    expect(fixture.componentInstance.successMsg()).toBe('Email sent');
    expect(fixture.componentInstance.resending()).toBe(false);
  });

  it('should set error on resend failure', () => {
    mockAuthApi.resendVerification.mockReturnValue(throwError(() => ({
      message: 'Rate limited',
    })));

    const fixture = TestBed.createComponent(AccountBlockedComponent);
    fixture.componentInstance.resend();

    expect(fixture.componentInstance.errorMsg()).toBe('Rate limited');
    expect(fixture.componentInstance.resending()).toBe(false);
  });

  it('should logout', () => {
    mockAuthApi.logout.mockReturnValue(of({}));

    const fixture = TestBed.createComponent(AccountBlockedComponent);
    fixture.componentInstance.logout();

    expect(mockAuthApi.logout).toHaveBeenCalled();
    expect(mockAuthState.clearUser).toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
  });
});
