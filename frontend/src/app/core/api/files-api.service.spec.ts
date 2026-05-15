import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { FilesApiService } from './files-api.service';

describe('FilesApiService', () => {
  let service: FilesApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        FilesApiService,
      ],
    });
    service = TestBed.inject(FilesApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should list files with default params', () => {
    service.list().subscribe();

    const req = httpMock.expectOne((r) => r.url.includes('/api/v1/files'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('filter')).toBe('mine');
    expect(req.request.params.get('page')).toBe('1');
    req.flush({ result: 'success', message: 'OK', data: { items: [], pagination: { page: 1, per_page: 20, total: 0 } } });
  });

  it('should list favorites', () => {
    service.list('favorites', 1).subscribe();

    const req = httpMock.expectOne((r) => r.url.includes('/api/v1/files'));
    expect(req.request.params.get('filter')).toBe('favorites');
    req.flush({ result: 'success', message: 'OK', data: { items: [], pagination: { page: 1, per_page: 20, total: 0 } } });
  });

  it('should get file by id', () => {
    service.get('file-123').subscribe();

    const req = httpMock.expectOne('/api/v1/files/file-123');
    expect(req.request.method).toBe('GET');
    req.flush({ result: 'success', message: 'OK', data: { file: { id: 'file-123' } } });
  });

  it('should delete file', () => {
    service.delete('file-123').subscribe();

    const req = httpMock.expectOne('/api/v1/files/file-123');
    expect(req.request.method).toBe('DELETE');
    req.flush({ result: 'success', message: 'Deleted', data: {} });
  });

  it('should init upload', () => {
    service.initUpload({ original_name: 'test.pdf', size: 1024, mime_type: 'application/pdf' }).subscribe();

    const req = httpMock.expectOne('/api/v1/files/init-upload');
    expect(req.request.method).toBe('POST');
    req.flush({ result: 'success', message: 'OK', data: { file: { id: 'f1' }, upload_url: 'https://s3.example.com/upload' } });
  });

  it('should complete upload', () => {
    service.completeUpload('file-123').subscribe();

    const req = httpMock.expectOne('/api/v1/files/complete-upload');
    expect(req.request.body).toEqual({ file_id: 'file-123' });
    req.flush({ result: 'success', message: 'OK', data: { file: { id: 'file-123', status: 'available' } } });
  });

  it('should pin file', () => {
    service.pin('file-123').subscribe();

    const req = httpMock.expectOne('/api/v1/files/file-123/pin');
    expect(req.request.method).toBe('POST');
    req.flush({ result: 'success', message: 'Pinned', data: {} });
  });

  it('should unpin file', () => {
    service.unpin('file-123').subscribe();

    const req = httpMock.expectOne('/api/v1/files/file-123/unpin');
    expect(req.request.method).toBe('POST');
    req.flush({ result: 'success', message: 'Unpinned', data: {} });
  });

  it('should favorite file', () => {
    service.favorite('file-123').subscribe();

    const req = httpMock.expectOne('/api/v1/files/file-123/favorite');
    req.flush({ result: 'success', message: 'Favorited', data: {} });
  });

  it('should move file to folder', () => {
    service.moveFolder('file-123', 'folder-1').subscribe();

    const req = httpMock.expectOne('/api/v1/files/file-123/move-folder');
    expect(req.request.body).toEqual({ folder_id: 'folder-1' });
    req.flush({ result: 'success', message: 'Moved', data: {} });
  });

  it('should download file', () => {
    service.download('file-123').subscribe((res) => {
      expect(res.data.url).toBe('https://s3.example.com/download');
    });

    const req = httpMock.expectOne('/api/v1/files/file-123/download');
    req.flush({ result: 'success', message: 'OK', data: { url: 'https://s3.example.com/download', expires_in: 3600 } });
  });

  it('should share to contact', () => {
    service.shareToContact('file-123', 'contact-1').subscribe();

    const req = httpMock.expectOne('/api/v1/files/file-123/share-to-contact');
    expect(req.request.body).toEqual({ contact_id: 'contact-1' });
    req.flush({ result: 'success', message: 'Shared', data: {} });
  });

  it('should create link', () => {
    service.createLink('file-123', 24, true).subscribe();

    const req = httpMock.expectOne('/api/v1/files/file-123/create-link');
    expect(req.request.body).toEqual({ ttl_hours: 24, allow_save: true });
    req.flush({ result: 'success', message: 'Link created', data: { link: { id: 'link-1', token: 'abc' } } });
  });

  it('should resolve public link', () => {
    service.resolveLink('link-token').subscribe();

    const req = httpMock.expectOne('/api/v1/links/link-token/resolve');
    expect(req.request.method).toBe('POST');
    req.flush({ result: 'success', message: 'OK', data: { file: {}, link: { expires_at: '', allow_save: false } } });
  });
});
