import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { DocumentsApiService } from './documents-api.service';

describe('DocumentsApiService', () => {
  let service: DocumentsApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        DocumentsApiService,
      ],
    });
    service = TestBed.inject(DocumentsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should POST to /documents on create', () => {
    service.create('Заметка.md').subscribe();
    const req = httpMock.expectOne(r => r.url.includes('/api/v1/documents'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ fileName: 'Заметка.md' });
    req.flush({ result: 'success', message: '', data: { document: {} } });
  });

  it('should GET /documents/:id on get', () => {
    service.get('doc_123').subscribe();
    const req = httpMock.expectOne(r => r.url.includes('/api/v1/documents/doc_123'));
    expect(req.request.method).toBe('GET');
    req.flush({ result: 'success', message: '', data: { document: {} } });
  });

  it('should PUT /documents/:id with content and etag on save', () => {
    service.save('doc_123', '# Hello', '"abc123"').subscribe();
    const req = httpMock.expectOne(r => r.url.includes('/api/v1/documents/doc_123'));
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ content: '# Hello', etag: '"abc123"' });
    req.flush({ result: 'success', message: '', data: {} });
  });

  it('should POST to /documents/:id/lock on acquireLock', () => {
    service.acquireLock('doc_123').subscribe();
    const req = httpMock.expectOne(r => r.url.includes('/lock') && !r.url.includes('heartbeat'));
    expect(req.request.method).toBe('POST');
    req.flush({ result: 'success', message: '', data: { lock: {} } });
  });

  it('should POST to /lock/heartbeat on heartbeat', () => {
    service.heartbeat('doc_123').subscribe();
    const req = httpMock.expectOne(r => r.url.includes('/lock/heartbeat'));
    expect(req.request.method).toBe('POST');
    req.flush({ result: 'success', message: '', data: {} });
  });

  it('should POST to /lock/takeover on takeover', () => {
    service.takeover('doc_123').subscribe();
    const req = httpMock.expectOne(r => r.url.includes('/lock/takeover'));
    expect(req.request.method).toBe('POST');
    req.flush({ result: 'success', message: '', data: { lock: {} } });
  });

  it('should DELETE /lock on releaseLock', () => {
    service.releaseLock('doc_123').subscribe();
    const req = httpMock.expectOne(r => r.url.includes('/lock') && !r.url.includes('heartbeat') && !r.url.includes('takeover'));
    expect(req.request.method).toBe('DELETE');
    req.flush({ result: 'success', message: '', data: {} });
  });

  it('should GET /assets/images on getImages', () => {
    service.getImages({ search: 'logo', per_page: 10 }).subscribe();
    const req = httpMock.expectOne(r => r.url.includes('/assets/images'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('search')).toBe('logo');
    expect(req.request.params.get('per_page')).toBe('10');
    req.flush({ result: 'success', message: '', data: { items: [], nextCursor: null } });
  });

  it('should PATCH /files/:id/accesses/:accessId on updateAccess', () => {
    service.updateAccess('file_1', 'access_1', true).subscribe();
    const req = httpMock.expectOne(r => r.url.includes('/files/file_1/accesses/access_1'));
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ can_edit: true });
    req.flush({ result: 'success', message: '', data: {} });
  });
});
