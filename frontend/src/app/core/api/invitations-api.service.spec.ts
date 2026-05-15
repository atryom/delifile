import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { InvitationsApiService } from './invitations-api.service';

describe('InvitationsApiService', () => {
  let service: InvitationsApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        InvitationsApiService,
      ],
    });
    service = TestBed.inject(InvitationsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should send invitation', () => {
    service.send({ email: 'test@test.com' }).subscribe();

    const req = httpMock.expectOne('/api/v1/invitations');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'test@test.com' });
    req.flush({ result: 'success', message: 'OK', data: { invitation: { id: 'i1' } } });
  });

  it('should get invitation info', () => {
    service.get('token-123').subscribe();

    const req = httpMock.expectOne('/api/v1/invitations/token-123');
    expect(req.request.method).toBe('GET');
    req.flush({ result: 'success', message: 'OK', data: { invitation: {}, sender: { name: 'Test', email: 't@t.com' }, target_email: 'a@b.com', user_exists: false } });
  });

  it('should accept invitation', () => {
    service.accept('token-123').subscribe();

    const req = httpMock.expectOne('/api/v1/invitations/token-123/accept');
    expect(req.request.method).toBe('POST');
    req.flush({ result: 'success', message: 'OK', data: { invitation: { id: 'i1' } } });
  });

  it('should reject invitation', () => {
    service.reject('token-123').subscribe();

    const req = httpMock.expectOne('/api/v1/invitations/token-123/reject');
    expect(req.request.method).toBe('POST');
    req.flush({ result: 'success', message: 'OK', data: {} });
  });

  it('should cancel invitation', () => {
    service.cancel('i1').subscribe();

    const req = httpMock.expectOne('/api/v1/invitations/i1/cancel');
    expect(req.request.method).toBe('POST');
    req.flush({ result: 'success', message: 'OK', data: {} });
  });
});
