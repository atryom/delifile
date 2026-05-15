import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { SupportApiService } from './support-api.service';

describe('SupportApiService', () => {
  let service: SupportApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SupportApiService,
      ],
    });
    service = TestBed.inject(SupportApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should get tickets', () => {
    service.getTickets(1).subscribe();

    const req = httpMock.expectOne('/api/v1/support/tickets?page=1');
    expect(req.request.method).toBe('GET');
    req.flush({ result: 'success', message: 'OK', data: { items: [], pagination: {} } });
  });

  it('should create ticket', () => {
    service.createTicket('Help!', []).subscribe();

    const req = httpMock.expectOne('/api/v1/support/tickets');
    expect(req.request.method).toBe('POST');
    req.flush({ result: 'success', message: 'OK', data: { ticket: { id: 't1' } } });
  });

  it('should add message to ticket', () => {
    service.sendMessage('t1', 'More info', []).subscribe();

    const req = httpMock.expectOne('/api/v1/support/tickets/t1/messages');
    expect(req.request.method).toBe('POST');
    req.flush({ result: 'success', message: 'OK', data: { message: { id: 'm1' } } });
  });

  it('should get suggestions', () => {
    service.getSuggestions(1).subscribe();

    const req = httpMock.expectOne('/api/v1/support/suggestions?page=1');
    expect(req.request.method).toBe('GET');
    req.flush({ result: 'success', message: 'OK', data: { items: [], pagination: {} } });
  });

  it('should create suggestion', () => {
    service.createSuggestion('Great idea!', []).subscribe();

    const req = httpMock.expectOne('/api/v1/support/suggestions');
    expect(req.request.method).toBe('POST');
    req.flush({ result: 'success', message: 'OK', data: { suggestion: { id: 's1' } } });
  });
});
