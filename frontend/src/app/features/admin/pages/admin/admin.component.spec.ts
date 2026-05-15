import { TestBed } from '@angular/core/testing';
import { AdminComponent } from './admin.component';
import { AdminApiService } from '../../../../core/api/admin-api.service';
import { SupportApiService } from '../../../../core/api/support-api.service';
import { ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';

describe('AdminComponent', () => {
  const mockAdminApi = {
    getStats: vi.fn(() => of({ result: 'success', data: { total_users: 10, active_today: 5, storage_used_gb: 20 } })),
    getUsers: vi.fn(() => of({ result: 'success', data: { items: [] } })),
    updatePlan: vi.fn(() => of({ result: 'success' })),
    blockUser: vi.fn(() => of({ result: 'success', data: { account_status: 'blocked_unverified_email' } })),
    generateResetLink: vi.fn(() => of({ result: 'success', data: { url: 'https://example.com/reset' } })),
    resetSessions: vi.fn(() => of({ result: 'success' })),
    notifyAll: vi.fn(() => of({ result: 'success' })),
    notifyUser: vi.fn(() => of({ result: 'success' })),
  };
  const mockSupportApi = {
    adminGetTickets: vi.fn(() => of({ result: 'success', data: { items: [], pagination: { page: 1, per_page: 20, total: 0 } } })),
    adminGetTicket: vi.fn(() => of({ result: 'success', data: { ticket: { id: 't-1', messages: [] } } })),
    adminMarkTicketRead: vi.fn(() => of({})),
    adminTakeTicket: vi.fn(() => of({ result: 'success' })),
    adminAwaitConfirmation: vi.fn(() => of({ result: 'success' })),
    adminSendMessage: vi.fn(() => of({ result: 'success', data: { message: { id: 'm-1' } } })),
    adminGetAttachmentUrl: vi.fn(() => of({ result: 'success', data: { url: 'https://example.com/dl', original_name: 'doc.pdf' } })),
    adminGetSuggestions: vi.fn(() => of({ result: 'success', data: { items: [], pagination: { page: 1, per_page: 20, total: 0 } } })),
    adminGetSuggestion: vi.fn(() => of({ result: 'success', data: { suggestion: { id: 's-1' } } })),
    adminUpdateSuggestionStatus: vi.fn(() => of({ result: 'success' })),
    adminAddSuggestionComment: vi.fn(() => of({ result: 'success', data: { comment: { id: 'c-1' } } })),
    adminGetSuggestionAttachmentUrl: vi.fn(() => of({ result: 'success', data: { url: 'https://example.com/dl', original_name: 'doc.pdf' } })),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [AdminComponent],
      providers: [
        { provide: AdminApiService, useValue: mockAdminApi },
        { provide: SupportApiService, useValue: mockSupportApi },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(AdminComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should load stats on creation', () => {
    TestBed.createComponent(AdminComponent);
    expect(mockAdminApi.getStats).toHaveBeenCalled();
  });

  it('should load users on creation', () => {
    TestBed.createComponent(AdminComponent);
    expect(mockAdminApi.getUsers).toHaveBeenCalled();
  });

  it('should set active tab', () => {
    const fixture = TestBed.createComponent(AdminComponent);
    fixture.componentInstance.setTab('users');
    expect(fixture.componentInstance.activeTab()).toBe('users');
  });

  it('should load support tickets on support tab', () => {
    const fixture = TestBed.createComponent(AdminComponent);
    fixture.componentInstance.setTab('support');
    expect(mockSupportApi.adminGetTickets).toHaveBeenCalled();
  });

  it('should load suggestions on suggestions tab', () => {
    const fixture = TestBed.createComponent(AdminComponent);
    fixture.componentInstance.setTab('suggestions');
    expect(mockSupportApi.adminGetSuggestions).toHaveBeenCalled();
  });

  it('should save plan', () => {
    const fixture = TestBed.createComponent(AdminComponent);
    fixture.componentInstance.editingPlan.set({ 'user-1': 'gold' });
    fixture.componentInstance.savePlan('user-1');
    expect(mockAdminApi.updatePlan).toHaveBeenCalledWith('user-1', 'gold');
  });

  it('should toggle block', () => {
    const fixture = TestBed.createComponent(AdminComponent);
    fixture.componentInstance.toggleBlock('user-1');
    expect(mockAdminApi.blockUser).toHaveBeenCalledWith('user-1');
  });

  it('should generate reset link', () => {
    const fixture = TestBed.createComponent(AdminComponent);
    fixture.componentInstance.generateResetLink('user-1');
    expect(mockAdminApi.generateResetLink).toHaveBeenCalledWith('user-1');
  });

  it('should reset sessions after confirm', () => {
    const fixture = TestBed.createComponent(AdminComponent);
    fixture.componentInstance.askResetSessions('user-1');
    expect(fixture.componentInstance.confirmReset()).toBe('user-1');
    fixture.componentInstance.confirmResetSessions('user-1');
    expect(mockAdminApi.resetSessions).toHaveBeenCalledWith('user-1');
  });

  it('should open and close ticket', () => {
    const fixture = TestBed.createComponent(AdminComponent);
    fixture.componentInstance.openTicket('t-1');
    expect(mockSupportApi.adminGetTicket).toHaveBeenCalledWith('t-1');
    fixture.componentInstance.closeTicket();
    expect(fixture.componentInstance.activeTicket()).toBeNull();
  });

  it('should take ticket', () => {
    const fixture = TestBed.createComponent(AdminComponent);
    fixture.componentInstance.takeTicket('t-1');
    expect(mockSupportApi.adminTakeTicket).toHaveBeenCalledWith('t-1');
  });

  it('should set ticket awaiting confirmation', () => {
    const fixture = TestBed.createComponent(AdminComponent);
    fixture.componentInstance.awaitConfirmation('t-1');
    expect(mockSupportApi.adminAwaitConfirmation).toHaveBeenCalledWith('t-1');
  });

  it('should send admin message', () => {
    const fixture = TestBed.createComponent(AdminComponent);
    fixture.componentInstance.activeTicket.set({ id: 't-1', messages: [] } as any);
    fixture.componentInstance.adminMessageForm.setValue({ body: 'Hello' });
    fixture.componentInstance.sendAdminMessage();
    expect(mockSupportApi.adminSendMessage).toHaveBeenCalledWith('t-1', 'Hello', []);
  });

  it('should open and close suggestion', () => {
    const fixture = TestBed.createComponent(AdminComponent);
    fixture.componentInstance.openSuggestion('s-1');
    expect(mockSupportApi.adminGetSuggestion).toHaveBeenCalledWith('s-1');
    fixture.componentInstance.closeSuggestion();
    expect(fixture.componentInstance.activeSuggestion()).toBeNull();
  });

  it('should toggle suggestion status', () => {
    const fixture = TestBed.createComponent(AdminComponent);
    fixture.componentInstance.toggleSuggestionStatus('s-1', 'new');
    expect(mockSupportApi.adminUpdateSuggestionStatus).toHaveBeenCalledWith('s-1', 'accepted');
    fixture.componentInstance.toggleSuggestionStatus('s-2', 'accepted');
    expect(mockSupportApi.adminUpdateSuggestionStatus).toHaveBeenCalledWith('s-2', 'new');
  });

  it('should add suggestion comment', () => {
    const fixture = TestBed.createComponent(AdminComponent);
    fixture.componentInstance.activeSuggestion.set({ id: 's-1' } as any);
    fixture.componentInstance.commentForm.setValue({ body: 'Great idea!' });
    fixture.componentInstance.addSuggestionComment('s-1');
    expect(mockSupportApi.adminAddSuggestionComment).toHaveBeenCalledWith('s-1', 'Great idea!');
  });

  it('should open notify dialog for user', () => {
    const fixture = TestBed.createComponent(AdminComponent);
    fixture.componentInstance.openNotifyDialog({ id: 'u-1', email: 'u@test.com' } as any);
    expect(fixture.componentInstance.notifyTarget()).toEqual({ userId: 'u-1', email: 'u@test.com' });
  });

  it('should open broadcast dialog', () => {
    const fixture = TestBed.createComponent(AdminComponent);
    fixture.componentInstance.openBroadcastDialog();
    expect(fixture.componentInstance.notifyTarget()).toBe('all');
  });

  it('should send notify to user', () => {
    const fixture = TestBed.createComponent(AdminComponent);
    fixture.componentInstance.notifyTarget.set({ userId: 'u-1', email: 'u@test.com' });
    fixture.componentInstance.notifyTitle.set('Title');
    fixture.componentInstance.notifyBody.set('Body');
    fixture.componentInstance.sendNotify();
    expect(mockAdminApi.notifyUser).toHaveBeenCalledWith('u-1', 'Title', 'Body');
  });

  it('should send broadcast', () => {
    const fixture = TestBed.createComponent(AdminComponent);
    fixture.componentInstance.notifyTarget.set('all');
    fixture.componentInstance.notifyTitle.set('Broadcast');
    fixture.componentInstance.notifyBody.set('Hello all');
    fixture.componentInstance.sendNotify();
    expect(mockAdminApi.notifyAll).toHaveBeenCalledWith('Broadcast', 'Hello all');
  });

  it('should format date', () => {
    const fixture = TestBed.createComponent(AdminComponent);
    expect(fixture.componentInstance.formatDate('2024-01-15T10:30:00Z')).toContain('15');
  });

  it('should return plan label', () => {
    const fixture = TestBed.createComponent(AdminComponent);
    expect(fixture.componentInstance.planLabel('gold')).toBe('Gold');
    expect(fixture.componentInstance.planLabel(null)).toBe('—');
  });

  it('should return status label', () => {
    const fixture = TestBed.createComponent(AdminComponent);
    expect(fixture.componentInstance.statusLabel('active')).toContain('Активен');
    expect(fixture.componentInstance.statusLabel('unknown')).toBe('unknown');
  });

  it('should handle setSupportStatusFilter', () => {
    const fixture = TestBed.createComponent(AdminComponent);
    fixture.componentInstance.setSupportStatusFilter('in_progress');
    expect(fixture.componentInstance.supportStatusFilter()).toBe('in_progress');
    expect(mockSupportApi.adminGetTickets).toHaveBeenCalledWith(1, 'in_progress');
  });

  it('should handle setSuggestionsFilter', () => {
    const fixture = TestBed.createComponent(AdminComponent);
    fixture.componentInstance.setSuggestionsFilter('accepted');
    expect(fixture.componentInstance.suggestionsStatusFilter()).toBe('accepted');
    expect(mockSupportApi.adminGetSuggestions).toHaveBeenCalledWith(1, 'accepted');
  });

  it('should download attachment', () => {
    const fixture = TestBed.createComponent(AdminComponent);
    fixture.componentInstance.downloadAttachment('t-1', 'a-1', 'doc.pdf');
    expect(mockSupportApi.adminGetAttachmentUrl).toHaveBeenCalledWith('t-1', 'a-1');
  });

  it('should track by id', () => {
    const fixture = TestBed.createComponent(AdminComponent);
    expect(fixture.componentInstance.trackById(0, { id: 'abc' } as any)).toBe('abc');
    expect(fixture.componentInstance.trackById(1, { id: 42 } as any)).toBe(42);
  });
});
