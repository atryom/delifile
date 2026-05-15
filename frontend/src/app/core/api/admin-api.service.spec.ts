import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AdminApiService } from './admin-api.service';

describe('AdminApiService', () => {
  let service: AdminApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AdminApiService,
      ],
    });
    service = TestBed.inject(AdminApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should get stats', () => {
    service.getStats().subscribe();

    const req = httpMock.expectOne('/api/v1/admin/stats');
    expect(req.request.method).toBe('GET');
    req.flush({ result: 'success', message: 'OK', data: {} });
  });

  it('should get users', () => {
    service.getUsers().subscribe();

    const req = httpMock.expectOne('/api/v1/admin/users');
    expect(req.request.method).toBe('GET');
    req.flush({ result: 'success', message: 'OK', data: { items: [] } });
  });

  it('should update user plan', () => {
    service.updatePlan('u1', 'pro').subscribe();

    const req = httpMock.expectOne('/api/v1/admin/users/u1/plan');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ plan: 'pro' });
    req.flush({ result: 'success', message: 'OK', data: {} });
  });

  it('should block user', () => {
    service.blockUser('u1').subscribe();

    const req = httpMock.expectOne('/api/v1/admin/users/u1/block');
    expect(req.request.method).toBe('POST');
    req.flush({ result: 'success', message: 'OK', data: { account_status: 'blocked' } });
  });

  it('should generate reset link', () => {
    service.generateResetLink('u1').subscribe();

    const req = httpMock.expectOne('/api/v1/admin/users/u1/reset-link');
    expect(req.request.method).toBe('POST');
    req.flush({ result: 'success', message: 'OK', data: { url: 'https://...' } });
  });

  it('should reset sessions', () => {
    service.resetSessions('u1').subscribe();

    const req = httpMock.expectOne('/api/v1/admin/users/u1/reset-sessions');
    expect(req.request.method).toBe('POST');
    req.flush({ result: 'success', message: 'OK', data: {} });
  });

  it('should notify user', () => {
    service.notifyUser('u1', 'Hello', 'Test').subscribe();

    const req = httpMock.expectOne('/api/v1/admin/users/u1/notify');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ title: 'Hello', body: 'Test' });
    req.flush({ result: 'success', message: 'OK', data: {} });
  });

  it('should notify all users', () => {
    service.notifyAll('All', 'Broadcast').subscribe();

    const req = httpMock.expectOne('/api/v1/admin/notify-all');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ title: 'All', body: 'Broadcast' });
    req.flush({ result: 'success', message: 'OK', data: {} });
  });
});
