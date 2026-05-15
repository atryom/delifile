import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { UrlFilesApiService } from './url-files-api.service';

describe('UrlFilesApiService', () => {
  let service: UrlFilesApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        UrlFilesApiService,
      ],
    });
    service = TestBed.inject(UrlFilesApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should preview URL', () => {
    service.preview('https://example.com').subscribe();

    const req = httpMock.expectOne('/api/v1/links-preview');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ url: 'https://example.com' });
    req.flush({ result: 'success', message: 'OK', data: { preview: { title: 'Example' } } });
  });

  it('should create URL file', () => {
    service.create('https://example.com').subscribe();

    const req = httpMock.expectOne('/api/v1/url-files');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ url: 'https://example.com' });
    req.flush({ result: 'success', message: 'OK', data: { file: { id: 'f1' } } });
  });
});
