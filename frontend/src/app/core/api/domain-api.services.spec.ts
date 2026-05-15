import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ContactsApiService } from './domain-api.services';
import { ActivityApiService } from './domain-api.services';
import { OrganizationApiService } from './domain-api.services';

describe('ContactsApiService', () => {
  let service: ContactsApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ContactsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should list contacts', () => {
    service.list().subscribe();
    const req = httpMock.expectOne('/api/v1/contacts');
    expect(req.request.method).toBe('GET');
    req.flush({ result: 'success', message: 'OK', data: { items: [] } });
  });

  it('should list contacts with search', () => {
    service.list('john').subscribe();
    const req = httpMock.expectOne(r => r.url.includes('/api/v1/contacts'));
    expect(req.request.params.get('search')).toBe('john');
    req.flush({ result: 'success', message: 'OK', data: { items: [] } });
  });

  it('should create contact', () => {
    service.create({ name: 'John', email: 'john@test.com' }).subscribe();
    const req = httpMock.expectOne('/api/v1/contacts');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'John', email: 'john@test.com' });
    req.flush({ result: 'success', message: 'OK', data: { contact: { id: '1' }, invitation_sent: false } });
  });

  it('should get contact', () => {
    service.get('1').subscribe();
    const req = httpMock.expectOne('/api/v1/contacts/1');
    expect(req.request.method).toBe('GET');
    req.flush({ result: 'success', message: 'OK', data: { contact: { id: '1' } } });
  });

  it('should import contacts', () => {
    service.import([{ name: 'John', phone: '+123' }]).subscribe();
    const req = httpMock.expectOne('/api/v1/contacts/import');
    expect(req.request.method).toBe('POST');
    req.flush({ result: 'success', message: 'OK', data: { imported: 1 } });
  });

  it('should resolve contacts', () => {
    service.resolve().subscribe();
    const req = httpMock.expectOne('/api/v1/contacts/resolve');
    expect(req.request.method).toBe('POST');
    req.flush({ result: 'success', message: 'OK', data: { newly_resolved: 0 } });
  });

  it('should delete contact', () => {
    service.delete('1').subscribe();
    const req = httpMock.expectOne('/api/v1/contacts/1');
    expect(req.request.method).toBe('DELETE');
    req.flush({ result: 'success', message: 'OK', data: {} });
  });

  it('should get contact history', () => {
    service.history('1').subscribe();
    const req = httpMock.expectOne('/api/v1/contacts/1/history');
    expect(req.request.method).toBe('GET');
    req.flush({ result: 'success', message: 'OK', data: { items: [] } });
  });
});

describe('ActivityApiService', () => {
  let service: ActivityApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ActivityApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should list activity', () => {
    service.list().subscribe();
    const req = httpMock.expectOne('/api/v1/activity?page=1');
    expect(req.request.method).toBe('GET');
    req.flush({ result: 'success', message: 'OK', data: { items: [], pagination: { page: 1, per_page: 20, total: 0 } } });
  });
});

describe('OrganizationApiService', () => {
  let service: OrganizationApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(OrganizationApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should list folders', () => {
    service.listFolders().subscribe();
    const req = httpMock.expectOne('/api/v1/folders');
    expect(req.request.method).toBe('GET');
    req.flush({ result: 'success', message: 'OK', data: { items: [] } });
  });

  it('should list tags', () => {
    service.listTags().subscribe();
    const req = httpMock.expectOne('/api/v1/tags');
    expect(req.request.method).toBe('GET');
    req.flush({ result: 'success', message: 'OK', data: { items: [] } });
  });
});
