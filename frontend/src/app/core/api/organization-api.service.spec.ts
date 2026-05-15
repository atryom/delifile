import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { OrganizationApiService } from './organization-api.service';

describe('OrganizationApiService', () => {
  let service: OrganizationApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        OrganizationApiService,
      ],
    });
    service = TestBed.inject(OrganizationApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should get folder tree', () => {
    service.getFolderTree().subscribe();

    const req = httpMock.expectOne('/api/v1/folders/tree');
    expect(req.request.method).toBe('GET');
    req.flush({ result: 'success', message: 'OK', data: { items: [] } });
  });

  it('should create folder', () => {
    service.createFolder({ name: 'New Folder' }).subscribe();

    const req = httpMock.expectOne('/api/v1/folders');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'New Folder' });
    req.flush({ result: 'success', message: 'OK', data: { folder: {} } });
  });

  it('should delete folder', () => {
    service.deleteFolder('folder-1', true).subscribe();

    const req = httpMock.expectOne('/api/v1/folders/folder-1?force=1');
    expect(req.request.method).toBe('DELETE');
    req.flush({ result: 'success', message: 'OK', data: {} });
  });

  it('should list tags', () => {
    service.getTags().subscribe();

    const req = httpMock.expectOne('/api/v1/tags');
    expect(req.request.method).toBe('GET');
    req.flush({ result: 'success', message: 'OK', data: { items: [] } });
  });

  it('should create tag', () => {
    service.createTag('important').subscribe();

    const req = httpMock.expectOne('/api/v1/tags');
    expect(req.request.body).toEqual({ name: 'important' });
    req.flush({ result: 'success', message: 'OK', data: { tag: {} } });
  });

  it('should attach tags to file', () => {
    service.attachTags('file-1', ['tag-1', 'tag-2']).subscribe();

    const req = httpMock.expectOne('/api/v1/files/file-1/attach-tags');
    expect(req.request.body).toEqual({ tag_ids: ['tag-1', 'tag-2'] });
    req.flush({ result: 'success', message: 'OK', data: {} });
  });
});
