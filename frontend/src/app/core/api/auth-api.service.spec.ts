import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AuthApiService } from './auth-api.service';

describe('AuthApiService', () => {
  let service: AuthApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AuthApiService,
      ],
    });
    service = TestBed.inject(AuthApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should send register request', () => {
    const data = { email: 'test@test.com', password: '12345678', password_confirmation: '12345678' };

    service.register(data).subscribe((res) => {
      expect(res.result).toBe('success');
    });

    const req = httpMock.expectOne('/api/v1/auth/register');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(data);
    req.flush({ result: 'success', message: 'OK', data: { token: 'abc', user: { id: '1', email: 'test@test.com' } } });
  });

  it('should send login request', () => {
    service.login({ email: 'test@test.com', password: 'pass' }).subscribe();

    const req = httpMock.expectOne('/api/v1/auth/login');
    expect(req.request.method).toBe('POST');
    req.flush({ result: 'success', message: 'OK', data: {} });
  });

  it('should send logout request', () => {
    service.logout().subscribe();

    const req = httpMock.expectOne('/api/v1/auth/logout');
    expect(req.request.method).toBe('POST');
    req.flush({ result: 'success', message: 'OK', data: {} });
  });

  it('should send me request', () => {
    service.me().subscribe();

    const req = httpMock.expectOne('/api/v1/auth/me');
    expect(req.request.method).toBe('GET');
    req.flush({ result: 'success', message: 'OK', data: { user: {} } });
  });

  it('should send sessions request', () => {
    service.sessions().subscribe();

    const req = httpMock.expectOne('/api/v1/auth/sessions');
    expect(req.request.method).toBe('GET');
    req.flush({ result: 'success', message: 'OK', data: { items: [] } });
  });

  it('should send change password request', () => {
    service.changePassword({ current_password: 'old', password: 'new', password_confirmation: 'new' }).subscribe();

    const req = httpMock.expectOne('/api/v1/auth/password/change');
    expect(req.request.method).toBe('POST');
    req.flush({ result: 'success', message: 'OK', data: {} });
  });

  it('should send forgot password request', () => {
    service.forgotPassword('test@test.com').subscribe();

    const req = httpMock.expectOne('/api/v1/auth/password/forgot');
    expect(req.request.body).toEqual({ email: 'test@test.com' });
    req.flush({ result: 'success', message: 'OK', data: {} });
  });
});
