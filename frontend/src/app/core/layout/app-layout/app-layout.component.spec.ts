import { TestBed } from '@angular/core/testing';
import { AppLayoutComponent } from './app-layout.component';
import { AuthStateService } from '../../auth/auth-state.service';
import { AuthApiService } from '../../api/auth-api.service';
import { Router, ActivatedRoute } from '@angular/router';
import { UserSettingsApiService } from '../../api/user-settings-api.service';
import { FilesApiService } from '../../api/files-api.service';
import { NotificationService } from '../../notifications/notification.service';
import { PushService } from '../../notifications/push.service';
import { PwaInstallService } from '../../services/pwa-install.service';
import { ThemeService } from '../../services/theme.service';
import { TranslateService } from '@ngx-translate/core';
import { signal } from '@angular/core';
import { of } from 'rxjs';

describe('AppLayoutComponent', () => {
  const mockAuthState = {
    isAuthenticated: signal(false),
    isBlocked: signal(false),
    needsEmailVerification: signal(false),
    isEmailVerified: signal(false),
    user: signal(null),
    plan: signal(null),
    isSuperUser: signal(false),
    verificationDeadline: signal(null),
    updateUser: vi.fn(),
    clearUser: vi.fn(),
  };
  const mockAuthApi = {
    resendVerification: vi.fn(() => of({ result: 'success' })),
    logout: vi.fn(() => of({})),
  };
  const mockRouter = {
    navigate: vi.fn(),
    events: of({}),
  };
  const mockSettingsApi = {
    updateSettings: vi.fn(() => of({ result: 'success', data: { user: { id: 'u-1' } } })),
    getContactRequests: vi.fn(() => of({ result: 'success', data: { items: [] } })),
  };
  const mockFilesApi = {
    list: vi.fn(() => of({ result: 'success', data: { items: [] } })),
  };
  const mockNotifService = {
    showBanner: signal(false),
    isGranted: () => false,
    requestPermission: vi.fn(),
    show: vi.fn(),
    dismissAll: vi.fn(),
    hasNotifiedFile: () => false,
    markFileNotified: vi.fn(),
    hasNotifiedContact: () => false,
    markContactNotified: vi.fn(),
  };
  const mockPushService = {
    subscribe: vi.fn(() => Promise.resolve()),
  };
  const mockPwaInstall = {
    deferredPrompt: signal(null),
    canInstall: signal(false),
    install: vi.fn(),
  };
  const mockThemeService = {
    isDark: signal(false),
    toggle: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [AppLayoutComponent],
      providers: [
        { provide: AuthStateService, useValue: mockAuthState },
        { provide: AuthApiService, useValue: mockAuthApi },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
        { provide: UserSettingsApiService, useValue: mockSettingsApi },
        { provide: FilesApiService, useValue: mockFilesApi },
        { provide: NotificationService, useValue: mockNotifService },
        { provide: PushService, useValue: mockPushService },
        { provide: PwaInstallService, useValue: mockPwaInstall },
        { provide: ThemeService, useValue: mockThemeService },
        { provide: TranslateService, useValue: { instant: (k: string) => k, get: () => of(''), getCurrentLang: () => 'ru', getParsedResult: (key: string) => key, onTranslationChange: { subscribe: () => ({ unsubscribe: () => {} }) }, onLangChange: { subscribe: () => ({ unsubscribe: () => {} }) }, onFallbackLangChange: { subscribe: () => ({ unsubscribe: () => {} }) } } },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(AppLayoutComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show plan label', () => {
    const fixture = TestBed.createComponent(AppLayoutComponent);
    expect(fixture.componentInstance.planLabel()).toBe('Free');
    mockAuthState.plan.set('gold');
    expect(fixture.componentInstance.planLabel()).toBe('Gold');
  });

  it('should toggle theme', () => {
    const fixture = TestBed.createComponent(AppLayoutComponent);
    fixture.componentInstance.toggleTheme();
    expect(mockThemeService.toggle).toHaveBeenCalled();
  });

  it('should toggle sidebar', () => {
    const fixture = TestBed.createComponent(AppLayoutComponent);
    expect(fixture.componentInstance.sidebarOpen()).toBe(false);
    fixture.componentInstance.toggleSidebar();
    expect(fixture.componentInstance.sidebarOpen()).toBe(true);
    fixture.componentInstance.closeSidebar();
    expect(fixture.componentInstance.sidebarOpen()).toBe(false);
  });

  it('should resend verification', () => {
    const fixture = TestBed.createComponent(AppLayoutComponent);
    fixture.componentInstance.resendVerification();
    expect(mockAuthApi.resendVerification).toHaveBeenCalled();
  });

  it('should logout', () => {
    const fixture = TestBed.createComponent(AppLayoutComponent);
    fixture.componentInstance.logout();
    expect(mockAuthApi.logout).toHaveBeenCalled();
  });
});
