import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { SharedFoldersApiService } from './shared-folders-api.service';

describe('SharedFoldersApiService', () => {
  let service: SharedFoldersApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SharedFoldersApiService,
      ],
    });
    service = TestBed.inject(SharedFoldersApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should get shared folders list', () => {
    service.list().subscribe();

    const req = httpMock.expectOne('/api/v1/shared-folders');
    expect(req.request.method).toBe('GET');
    req.flush({ result: 'success', message: 'OK', data: { items: [] } });
  });

  it('should create shared folder', () => {
    service.create('Team Folder').subscribe();

    const req = httpMock.expectOne('/api/v1/shared-folders');
    expect(req.request.body).toEqual({ name: 'Team Folder' });
    req.flush({ result: 'success', message: 'OK', data: { folder: { id: 'sf1' } } });
  });

  it('should get files in shared folder', () => {
    service.listFiles('sf1', 1).subscribe();

    const req = httpMock.expectOne('/api/v1/shared-folders/sf1/files?page=1&per_page=20');
    expect(req.request.method).toBe('GET');
    req.flush({ result: 'success', message: 'OK', data: { items: [], pagination: {} } });
  });

  it('should list accesses', () => {
    service.listAccesses('sf1').subscribe();

    const req = httpMock.expectOne('/api/v1/shared-folders/sf1/accesses');
    req.flush({ result: 'success', message: 'OK', data: { items: [] } });
  });

  it('should add access', () => {
    service.addAccess('sf1', 'contact-1', 'edit').subscribe();

    const req = httpMock.expectOne('/api/v1/shared-folders/sf1/accesses');
    expect(req.request.body).toEqual({ contact_id: 'contact-1', access_type: 'edit' });
    req.flush({ result: 'success', message: 'OK', data: { access: {} } });
  });

  it('should create link', () => {
    service.createLink('sf1', { access_type: 'view', ttl_hours: 24, allow_save: true }).subscribe();

    const req = httpMock.expectOne('/api/v1/shared-folders/sf1/links');
    expect(req.request.body).toEqual({ access_type: 'view', ttl_hours: 24, allow_save: true });
    req.flush({ result: 'success', message: 'OK', data: { link: {} } });
  });
});
