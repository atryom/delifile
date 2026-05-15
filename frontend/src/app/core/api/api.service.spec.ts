import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ApiService } from './api.service';

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ApiService,
      ],
    });
    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should send GET request', () => {
    service.get('/test').subscribe();

    const req = httpMock.expectOne('/api/v1/test');
    expect(req.request.method).toBe('GET');
    req.flush({ result: 'success', message: 'OK', data: {} });
  });

  it('should send GET request with params', () => {
    service.get('/test', { page: 1, filter: 'mine' }).subscribe();

    const req = httpMock.expectOne((r) => r.url.includes('/api/v1/test'));
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('filter')).toBe('mine');
    req.flush({ result: 'success', message: 'OK', data: {} });
  });

  it('should send POST request', () => {
    service.post('/test', { key: 'value' }).subscribe();

    const req = httpMock.expectOne('/api/v1/test');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ key: 'value' });
    req.flush({ result: 'success', message: 'OK', data: {} });
  });

  it('should send PUT request', () => {
    service.put('/test/1', { key: 'value' }).subscribe();

    const req = httpMock.expectOne('/api/v1/test/1');
    expect(req.request.method).toBe('PUT');
    req.flush({ result: 'success', message: 'OK', data: {} });
  });

  it('should send PATCH request', () => {
    service.patch('/test/1', { key: 'value' }).subscribe();

    const req = httpMock.expectOne('/api/v1/test/1');
    expect(req.request.method).toBe('PATCH');
    req.flush({ result: 'success', message: 'OK', data: {} });
  });

  it('should send DELETE request', () => {
    service.delete('/test/1').subscribe();

    const req = httpMock.expectOne('/api/v1/test/1');
    expect(req.request.method).toBe('DELETE');
    req.flush({ result: 'success', message: 'OK', data: {} });
  });

  it('should send external PUT without base URL', () => {
    service.putExternal('https://s3.example.com/upload', new Blob(), { 'Content-Type': 'application/pdf' }).subscribe();

    const req = httpMock.expectOne('https://s3.example.com/upload');
    expect(req.request.method).toBe('PUT');
    req.flush(null);
  });
});
