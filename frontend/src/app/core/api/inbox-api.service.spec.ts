import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { InboxApiService } from './inbox-api.service';

describe('InboxApiService', () => {
  let service: InboxApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        InboxApiService,
      ],
    });
    service = TestBed.inject(InboxApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should get inbox count', () => {
    service.getCount().subscribe();

    const req = httpMock.expectOne('/api/v1/inbox/count');
    expect(req.request.method).toBe('GET');
    req.flush({ result: 'success', message: 'OK', data: { total: 5 } });
  });

  it('should get inbox files', () => {
    service.getFiles().subscribe();

    const req = httpMock.expectOne('/api/v1/inbox/files');
    req.flush({ result: 'success', message: 'OK', data: { items: [] } });
  });

  it('should accept files', () => {
    service.acceptFiles(['f1', 'f2']).subscribe();

    const req = httpMock.expectOne('/api/v1/inbox/files/accept');
    expect(req.request.body).toEqual({ ids: ['f1', 'f2'] });
    req.flush({ result: 'success', message: 'OK', data: {} });
  });

  it('should reject files', () => {
    service.rejectFiles(['f1']).subscribe();

    const req = httpMock.expectOne('/api/v1/inbox/files/reject');
    expect(req.request.body).toEqual({ ids: ['f1'] });
    req.flush({ result: 'success', message: 'OK', data: {} });
  });

  it('should get shared folders', () => {
    service.getSharedFolders().subscribe();

    const req = httpMock.expectOne('/api/v1/inbox/shared-folders');
    req.flush({ result: 'success', message: 'OK', data: { items: [] } });
  });

  it('should accept shared folders', () => {
    service.acceptSharedFolders(['sf1']).subscribe();

    const req = httpMock.expectOne('/api/v1/inbox/shared-folders/accept');
    expect(req.request.body).toEqual({ ids: ['sf1'] });
    req.flush({ result: 'success', message: 'OK', data: {} });
  });

  it('should reject shared folders', () => {
    service.rejectSharedFolders(['sf1']).subscribe();

    const req = httpMock.expectOne('/api/v1/inbox/shared-folders/reject');
    expect(req.request.body).toEqual({ ids: ['sf1'] });
    req.flush({ result: 'success', message: 'OK', data: {} });
  });
});
