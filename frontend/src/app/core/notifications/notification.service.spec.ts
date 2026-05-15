import { TestBed } from '@angular/core/testing';
import { NotificationService } from './notification.service';
import { AuthStateService } from '../auth/auth-state.service';
import { signal } from '@angular/core';

describe('NotificationService', () => {
  let service: NotificationService;
  let mockAuthState: { user: ReturnType<typeof signal<unknown>>; isAuthenticated: ReturnType<typeof signal<boolean>> };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    (globalThis as any).Notification = { permission: 'default', requestPermission: vi.fn() };

    mockAuthState = {
      user: signal({ notifications_enabled: true }),
      isAuthenticated: signal(true),
    };

    TestBed.configureTestingModule({
      providers: [
        NotificationService,
        { provide: AuthStateService, useValue: mockAuthState },
      ],
    });
    service = TestBed.inject(NotificationService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should show banner when permission is default and user wants notifications', () => {
    expect(service.showBanner()).toBe(true);
  });

  it('should not show banner when user has no notifications enabled', () => {
    mockAuthState.user.set({ notifications_enabled: false });
    expect(service.showBanner()).toBe(false);
  });

  it('should dismiss banner', () => {
    service.dismissBanner();
    expect(service.showBanner()).toBe(false);
  });

  it('should track notified file ids', () => {
    expect(service.hasNotifiedFile('file-1')).toBe(false);
    service.markFileNotified('file-1');
    expect(service.hasNotifiedFile('file-1')).toBe(true);
  });

  it('should track notified contact ids', () => {
    expect(service.hasNotifiedContact('contact-1')).toBe(false);
    service.markContactNotified('contact-1');
    expect(service.hasNotifiedContact('contact-1')).toBe(true);
  });

  it('should add and dismiss in-app notifications', () => {
    service.show('Title', 'Body', '/route');
    expect(service.queue().length).toBe(1);
    expect(service.queue()[0].title).toBe('Title');
    expect(service.queue()[0].body).toBe('Body');

    service.dismiss(service.queue()[0].id);
    expect(service.queue().length).toBe(0);
  });

  it('should dismiss all notifications', () => {
    service.show('T1', 'B1');
    service.show('T2', 'B2');
    service.dismissAll();
    expect(service.queue().length).toBe(0);
  });

  it('should not show notification when user has them disabled', () => {
    mockAuthState.user.set({ notifications_enabled: false });
    service.show('Title', 'Body');
    expect(service.queue().length).toBe(0);
  });

  it('should limit queue to 5 items', () => {
    for (let i = 0; i < 10; i++) {
      service.show(`Title ${i}`, `Body ${i}`);
    }
    expect(service.queue().length).toBe(5);
  });
});
