import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NotificationsApiService } from './notifications-api.service';

describe('NotificationsApiService', () => {
  let service: NotificationsApiService;
  let httpMock: HttpTestingController;

  const okResponse = (data: object) => ({ result: 'success', data });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        NotificationsApiService,
      ],
    });
    service = TestBed.inject(NotificationsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should get notifications without group filter', () => {
    service.getNotifications(undefined, 1).subscribe();

    const req = httpMock.expectOne((r) => r.url.includes('/api/v1/notifications'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('group')).toBe(false);
    expect(req.request.params.get('page')).toBe('1');
    req.flush(okResponse({ items: [], total: 0, page: 1, last_page: 1 }));
  });

  it('should get notifications with group filter', () => {
    service.getNotifications('access', 2).subscribe();

    const req = httpMock.expectOne((r) => r.url.includes('/api/v1/notifications'));
    expect(req.request.params.get('group')).toBe('access');
    expect(req.request.params.get('page')).toBe('2');
    req.flush(okResponse({ items: [], total: 0, page: 2, last_page: 1 }));
  });

  it('should get unread count', () => {
    service.getCount().subscribe((res) => {
      expect(res.data.unread).toBe(5);
    });

    const req = httpMock.expectOne('/api/v1/notifications/count');
    expect(req.request.method).toBe('GET');
    req.flush(okResponse({ unread: 5 }));
  });

  it('should mark a notification as read', () => {
    service.markRead('notif-id-123').subscribe();

    const req = httpMock.expectOne('/api/v1/notifications/notif-id-123/read');
    expect(req.request.method).toBe('POST');
    req.flush(okResponse({}));
  });

  it('should mark all notifications as read', () => {
    service.markAllRead().subscribe();

    const req = httpMock.expectOne('/api/v1/notifications/read-all');
    expect(req.request.method).toBe('POST');
    req.flush(okResponse({}));
  });
});
