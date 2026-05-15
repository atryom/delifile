import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthStateService } from '../auth/auth-state.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  let authState: AuthStateService;

  const setup = (routerSpy: Record<string, unknown>) => {
    TestBed.configureTestingModule({
      providers: [
        AuthStateService,
        { provide: Router, useValue: routerSpy },
      ],
    });
    authState = TestBed.inject(AuthStateService);
    TestBed.inject(Router);
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should redirect to /login when not authenticated', () => {
    const navigate = vi.fn();
    setup({ navigate, createUrlTree: vi.fn(() => '/login') });

    const result = TestBed.runInInjectionContext(() => authGuard());

    expect(result).not.toBe(true);
  });

  it('should redirect to /account-blocked when blocked', () => {
    const navigate = vi.fn();
    const createUrlTree = vi.fn(() => '/account-blocked');
    setup({ navigate, createUrlTree });

    authState.setUser({ id: '1', account_status: 'blocked_unverified_email' } as any, 'token', true);

    const result = TestBed.runInInjectionContext(() => authGuard());

    expect(createUrlTree).toHaveBeenCalledWith(['/account-blocked']);
    expect(result).not.toBe(true);
  });

  it('should allow access when authenticated and not blocked', () => {
    const navigate = vi.fn();
    const createUrlTree = vi.fn();
    setup({ navigate, createUrlTree });

    authState.setUser({ id: '1', account_status: 'active' } as any, 'token', true);

    const result = TestBed.runInInjectionContext(() => authGuard());

    expect(result).toBe(true);
  });
});
