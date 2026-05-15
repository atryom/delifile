import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthStateService } from '../auth/auth-state.service';
import { guestGuard } from './guest.guard';

describe('guestGuard', () => {
  let authState: AuthStateService;

  const setup = () => {
    TestBed.configureTestingModule({
      providers: [
        AuthStateService,
        { provide: Router, useValue: { navigate: vi.fn(), createUrlTree: vi.fn() } },
      ],
    });
    authState = TestBed.inject(AuthStateService);
    TestBed.inject(Router);
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should allow access when not authenticated', () => {
    setup();

    const result = TestBed.runInInjectionContext(() => guestGuard());

    expect(result).toBe(true);
  });

  it('should redirect to /files when authenticated', () => {
    setup();
    const router = TestBed.inject(Router);

    authState.setUser({ id: '1' } as any, 'token', true);

    TestBed.runInInjectionContext(() => guestGuard());

    expect(router.createUrlTree).toHaveBeenCalledWith(['/files']);
  });
});
