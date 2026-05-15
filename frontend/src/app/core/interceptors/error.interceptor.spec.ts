import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { errorInterceptor } from './error.interceptor';

describe('errorInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should normalize server error with error body', async () => {
    const promise = firstValueFrom(httpClient.get('/api/v1/test'));

    const req = httpMock.expectOne('/api/v1/test');
    req.flush(
      { result: 'error', message: 'Validation failed', data: { code: 'VALIDATION_ERROR', errors: {} } },
      { status: 422, statusText: 'Unprocessable' },
    );

    await expect(promise).rejects.toEqual({
      result: 'error',
      message: 'Validation failed',
      data: { code: 'VALIDATION_ERROR', errors: {} },
    });
  });
});
