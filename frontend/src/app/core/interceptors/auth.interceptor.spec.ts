import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { HttpInterceptorFn, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthStateService } from '../auth/auth-state.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let authState: AuthStateService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        AuthStateService,
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    });
    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    authState = TestBed.inject(AuthStateService);
    router = TestBed.inject(Router);
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should add Bearer token when authenticated', () => {
    authState.setUser({ id: '1' } as any, 'my-token', true);

    httpClient.get('/api/v1/test').subscribe();

    const req = httpMock.expectOne('/api/v1/test');
    expect(req.request.headers.get('Authorization')).toBe('Bearer my-token');
    req.flush({});
  });

  it('should clear user and redirect to /login on 401', () => {
    authState.setUser({ id: '1' } as any, 'token', true);
    expect(authState.isAuthenticated()).toBe(true);

    httpClient.get('/api/v1/test').subscribe({ error: () => {} });

    const req = httpMock.expectOne('/api/v1/test');
    req.flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(authState.isAuthenticated()).toBe(false);
    expect(authState.token()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should not redirect on 401 when already not authenticated', () => {
    httpClient.get('/api/v1/test').subscribe({ error: () => {} });

    const req = httpMock.expectOne('/api/v1/test');
    req.flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(router.navigate).not.toHaveBeenCalled();
  });
});
