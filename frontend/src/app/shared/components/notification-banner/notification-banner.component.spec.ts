import { TestBed } from '@angular/core/testing';
import { NotificationBannerComponent } from './notification-banner.component';
import { NotificationService } from '../../../core/notifications/notification.service';
import { AuthStateService } from '../../../core/auth/auth-state.service';
import { signal } from '@angular/core';
import { Router } from '@angular/router';

describe('NotificationBannerComponent', () => {
  const mockNotifService = {
    queue: signal([
      { id: 'n1', title: 'Test', body: 'Body', route: '/files', timestamp: 1 },
      { id: 'n2', title: 'Test 2', body: 'Body 2', route: undefined, timestamp: 2 },
    ]),
    dismiss: vi.fn(),
  };
  const mockAuthState = { user: signal({}) };
  const mockRouter = { navigateByUrl: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [NotificationBannerComponent],
      providers: [
        { provide: NotificationService, useValue: mockNotifService },
        { provide: AuthStateService, useValue: mockAuthState },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(NotificationBannerComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should dismiss and navigate on open', () => {
    const fixture = TestBed.createComponent(NotificationBannerComponent);
    fixture.componentInstance.open('n1', '/files');
    expect(mockNotifService.dismiss).toHaveBeenCalledWith('n1');
    expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/files');
  });
});
