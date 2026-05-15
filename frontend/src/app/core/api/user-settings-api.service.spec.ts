import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { UserSettingsApiService } from './user-settings-api.service';

describe('UserSettingsApiService', () => {
  let service: UserSettingsApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        UserSettingsApiService,
      ],
    });
    service = TestBed.inject(UserSettingsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should update settings', () => {
    service.updateSettings({ name: 'New Name' } as any).subscribe();

    const req = httpMock.expectOne('/api/v1/user/settings');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ name: 'New Name' });
    req.flush({ result: 'success', message: 'OK', data: { user: { id: 'u1' } } });
  });

  it('should get contact requests', () => {
    service.getContactRequests().subscribe();

    const req = httpMock.expectOne('/api/v1/contact-requests');
    expect(req.request.method).toBe('GET');
    req.flush({ result: 'success', message: 'OK', data: { items: [] } });
  });

  it('should accept contact request', () => {
    service.acceptContactRequest('cr1').subscribe();

    const req = httpMock.expectOne('/api/v1/contact-requests/cr1/accept');
    expect(req.request.method).toBe('POST');
    req.flush({ result: 'success', message: 'OK', data: {} });
  });

  it('should reject contact request', () => {
    service.rejectContactRequest('cr1').subscribe();

    const req = httpMock.expectOne('/api/v1/contact-requests/cr1/reject');
    expect(req.request.method).toBe('POST');
    req.flush({ result: 'success', message: 'OK', data: {} });
  });
});
