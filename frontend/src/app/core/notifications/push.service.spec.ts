import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { PushService } from './push.service';
import { environment } from '../../../environments/environment';

describe('PushService', () => {
  let service: PushService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PushService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should report not supported in test environment', () => {
    expect(service.isSupported).toBe(false);
  });

  it('should silently skip subscribe when not supported', async () => {
    await expect(service.subscribe()).resolves.toBeUndefined();
  });

  it('should silently skip unsubscribe when not supported', async () => {
    await expect(service.unsubscribe()).resolves.toBeUndefined();
  });
});
