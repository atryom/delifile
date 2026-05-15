import { TestBed } from '@angular/core/testing';
import { SupportComponent } from './support.component';
import { SupportApiService } from '../../../../core/api/support-api.service';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

describe('SupportComponent', () => {
  const mockApi = {
    getTickets: vi.fn(() => of({ result: 'success', message: 'OK', data: { items: [], pagination: { page: 1, per_page: 20, total: 0 } } })),
    getTicket: vi.fn(),
    getSuggestions: vi.fn(() => of({ result: 'success', message: 'OK', data: { items: [], pagination: { page: 1, per_page: 20, total: 0 } } })),
    createTicket: vi.fn(),
    createSuggestion: vi.fn(),
    sendMessage: vi.fn(),
    confirmTicket: vi.fn(),
    markTicketRead: vi.fn(),
    getAttachmentUrl: vi.fn(),
    getSuggestionAttachmentUrl: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [SupportComponent],
      providers: [
        { provide: SupportApiService, useValue: mockApi },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
      ],
    }).compileComponents();
  });

  function createFixture() {
    const fixture = TestBed.createComponent(SupportComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('should create and load tickets', () => {
    const fixture = createFixture();
    expect(fixture.componentInstance).toBeTruthy();
    expect(mockApi.getTickets).toHaveBeenCalledWith(1);
  });

  it('should start on tickets tab', () => {
    const fixture = createFixture();
    expect(fixture.componentInstance.activeTab()).toBe('tickets');
  });

  it('should switch to suggestions tab', () => {
    const fixture = createFixture();
    fixture.componentInstance.setTab('suggestions');
    expect(fixture.componentInstance.activeTab()).toBe('suggestions');
    expect(mockApi.getSuggestions).toHaveBeenCalled();
  });

  it('should open a ticket', () => {
    mockApi.getTicket.mockReturnValue(of({
      result: 'success', message: 'OK',
      data: { ticket: { id: 'ticket-1', messages: [], status: 'new' } },
    }));
    const fixture = createFixture();
    fixture.componentInstance.openTicket('ticket-1');
    expect(mockApi.getTicket).toHaveBeenCalledWith('ticket-1');
    expect(fixture.componentInstance.activeTicket()).toBeTruthy();
  });

  it('should open create ticket form', () => {
    const fixture = createFixture();
    fixture.componentInstance.openCreateTicket();
    expect(fixture.componentInstance.showCreateTicket()).toBe(true);
  });

  it('should cancel create ticket', () => {
    const fixture = createFixture();
    fixture.componentInstance.openCreateTicket();
    fixture.componentInstance.cancelCreateTicket();
    expect(fixture.componentInstance.showCreateTicket()).toBe(false);
  });

  it('should submit a ticket', () => {
    mockApi.createTicket.mockReturnValue(of({
      result: 'success', message: 'OK',
      data: { ticket: { id: 'ticket-1' } },
    }));
    const fixture = createFixture();
    fixture.componentInstance.openCreateTicket();
    fixture.componentInstance.ticketForm.setValue({ body: 'Test message body for ticket' });
    fixture.componentInstance.submitTicket();
    expect(mockApi.createTicket).toHaveBeenCalledWith('Test message body for ticket', []);
  });

  it('should not submit invalid ticket', () => {
    const fixture = createFixture();
    fixture.componentInstance.openCreateTicket();
    fixture.componentInstance.submitTicket();
    expect(mockApi.createTicket).not.toHaveBeenCalled();
  });

  it('should submit a suggestion', () => {
    mockApi.createSuggestion.mockReturnValue(of({ result: 'success', message: 'OK', data: {} }));
    const fixture = createFixture();
    fixture.componentInstance.setTab('suggestions');
    fixture.componentInstance.openCreateSuggestion();
    fixture.componentInstance.suggestionForm.setValue({ body: 'Test suggestion body text' });
    fixture.componentInstance.submitSuggestion();
    expect(mockApi.createSuggestion).toHaveBeenCalledWith('Test suggestion body text', []);
  });

  it('should send message', () => {
    mockApi.getTicket.mockReturnValue(of({
      result: 'success', message: 'OK',
      data: { ticket: { id: 'ticket-1', messages: [], status: 'in_progress' } },
    }));
    mockApi.sendMessage.mockReturnValue(of({
      result: 'success', message: 'OK',
      data: { message: { id: 'msg-1', body: 'Reply' } },
    }));
    const fixture = createFixture();
    fixture.componentInstance.openTicket('ticket-1');
    fixture.componentInstance.messageForm.setValue({ body: 'Reply message' });
    fixture.componentInstance.sendMessage();
    expect(mockApi.sendMessage).toHaveBeenCalledWith('ticket-1', 'Reply message', []);
  });

  it('should confirm ticket', () => {
    mockApi.getTicket.mockReturnValue(of({
      result: 'success', message: 'OK',
      data: { ticket: { id: 'ticket-1', messages: [], status: 'awaiting_confirmation' } },
    }));
    mockApi.confirmTicket.mockReturnValue(of({ result: 'success', message: 'OK', data: {} }));
    const fixture = createFixture();
    fixture.componentInstance.openTicket('ticket-1');
    fixture.componentInstance.confirmTicket();
    expect(mockApi.confirmTicket).toHaveBeenCalledWith('ticket-1');
  });

  it('should apply status label', () => {
    const fixture = createFixture();
    expect(fixture.componentInstance.statusLabel('new')).toBe('Новое');
    expect(fixture.componentInstance.statusLabel('completed')).toBe('Выполнено');
  });
});
