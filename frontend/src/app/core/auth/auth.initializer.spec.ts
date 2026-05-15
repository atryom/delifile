import { TestBed } from '@angular/core/testing';
import { AuthApiService } from '../api/auth-api.service';
import { AuthStateService } from '../../core/auth/auth-state.service';
import { authInitializer } from './auth.initializer';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';

describe('authInitializer', () => {
  const mockAuthApi = { me: vi.fn() };
  const mockAuthState = {
    restoreUser: vi.fn(),
    user: signal(null),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthApiService, useValue: mockAuthApi },
        { provide: AuthStateService, useValue: mockAuthState },
      ],
    });
  });

  it('should restore user on successful auth/me', async () => {
    mockAuthApi.me.mockReturnValue(of({
      result: 'success', message: 'OK',
      data: { user: { id: 'u-1', email: 'test@test.com' } },
    }));

    const fn = TestBed.runInInjectionContext(authInitializer);
    await fn();

    expect(mockAuthApi.me).toHaveBeenCalledTimes(1);
    expect(mockAuthState.restoreUser).toHaveBeenCalledWith({ id: 'u-1', email: 'test@test.com' });
  });

  it('should not restore user on failed auth/me', async () => {
    mockAuthApi.me.mockReturnValue(throwError(() => new Error('Unauthenticated')));

    const fn = TestBed.runInInjectionContext(authInitializer);
    await fn();

    expect(mockAuthApi.me).toHaveBeenCalledTimes(1);
    expect(mockAuthState.restoreUser).not.toHaveBeenCalled();
  });

  it('should not restore user when result is not success', async () => {
    mockAuthApi.me.mockReturnValue(of({ result: 'error', message: 'Fail' }));

    const fn = TestBed.runInInjectionContext(authInitializer);
    await fn();

    expect(mockAuthState.restoreUser).not.toHaveBeenCalled();
  });
});
