import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TariffApiService } from './tariff-api.service';

describe('TariffApiService', () => {
  let service: TariffApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        TariffApiService,
      ],
    });
    service = TestBed.inject(TariffApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should get tariffs', () => {
    service.getPlans().subscribe();

    const req = httpMock.expectOne('/api/v1/tariffs');
    expect(req.request.method).toBe('GET');
    req.flush({ result: 'success', message: 'OK', data: { plans: [] } });
  });

  it('should get usage', () => {
    service.getUsage().subscribe();

    const req = httpMock.expectOne('/api/v1/tariffs/usage');
    req.flush({ result: 'success', message: 'OK', data: {} });
  });

  it('should request plan change', () => {
    service.requestPlan('silver').subscribe();

    const req = httpMock.expectOne('/api/v1/tariffs/request');
    expect(req.request.body).toEqual({ plan: 'silver' });
    req.flush({ result: 'success', message: 'OK', data: {} });
  });
});
