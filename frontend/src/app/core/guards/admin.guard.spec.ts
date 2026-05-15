import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthStateService } from '../auth/auth-state.service';
import { adminGuard } from './admin.guard';

describe('adminGuard', () => {
  let authState: AuthStateService;

  const setup = () => {
    TestBed.configureTestingModule({
      providers: [
        AuthStateService,
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    });
    authState = TestBed.inject(AuthStateService);
    TestBed.inject(Router);
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should redirect to /files when not authenticated', () => {
    setup();
    const router = TestBed.inject(Router);

    const result = TestBed.runInInjectionContext(() => adminGuard());

    expect(router.navigate).toHaveBeenCalledWith(['/files']);
    expect(result).toBe(false);
  });

  it('should redirect to /files when authenticated but not superuser', () => {
    setup();
    const router = TestBed.inject(Router);

    authState.setUser({ id: '1', is_superuser: false } as any, 'token', true);

    const result = TestBed.runInInjectionContext(() => adminGuard());

    expect(router.navigate).toHaveBeenCalledWith(['/files']);
    expect(result).toBe(false);
  });

  it('should allow access when authenticated and superuser', () => {
    setup();

    authState.setUser({ id: '1', is_superuser: true } as any, 'token', true);

    const result = TestBed.runInInjectionContext(() => adminGuard());

    expect(result).toBe(true);
  });
});
