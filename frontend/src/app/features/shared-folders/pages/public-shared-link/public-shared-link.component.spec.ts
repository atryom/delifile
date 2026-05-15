import { TestBed } from '@angular/core/testing';
import { PublicSharedLinkComponent } from './public-shared-link.component';
import { SharedFoldersApiService } from '../../../../core/api/shared-folders-api.service';
import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';

describe('PublicSharedLinkComponent', () => {
  const translateMock = {
    instant: (k: string) => k,
    get: () => of(''),
    getCurrentLang: () => 'ru',
    getParsedResult: (key: string) => key,
    onTranslationChange: { subscribe: () => ({ unsubscribe: () => {} }) },
    onLangChange: { subscribe: () => ({ unsubscribe: () => {} }) },
    onFallbackLangChange: { subscribe: () => ({ unsubscribe: () => {} }) },
  };
  const mockSfApi = {
    resolveSharedLink: vi.fn(),
    publicFiles: vi.fn(),
  };
  const mockAuthState = {
    isAuthenticated: signal(false),
  };
  const mockRouter = {
    navigate: vi.fn(),
    navigateByUrl: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [PublicSharedLinkComponent],
      providers: [
        { provide: SharedFoldersApiService, useValue: mockSfApi },
        { provide: AuthStateService, useValue: mockAuthState },
        { provide: TranslateService, useValue: translateMock },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    mockSfApi.resolveSharedLink.mockReturnValue(of({
      result: 'success', message: 'OK',
      data: { folder: { id: 'f1' }, link: { access_type: 'view', allow_save: false } },
    }));
    mockSfApi.publicFiles.mockReturnValue(of({
      result: 'success', message: 'OK',
      data: { items: [], pagination: { page: 1, per_page: 20, total: 0 } },
    }));
    const fixture = TestBed.createComponent(PublicSharedLinkComponent);
    fixture.componentRef.setInput('token', 'token-123');
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should start in resolving state before api responds', () => {
    const fixture = TestBed.createComponent(PublicSharedLinkComponent);
    fixture.componentRef.setInput('token', 'token-123');
    expect(fixture.componentInstance.resolving()).toBe(true);
  });

  it('should resolve link successfully', () => {
    mockSfApi.resolveSharedLink.mockReturnValue(of({
      result: 'success', message: 'OK',
      data: { folder: { id: 'folder-1', name: 'Test' }, link: { access_type: 'view', allow_save: false } },
    }));
    mockSfApi.publicFiles.mockReturnValue(of({
      result: 'success', message: 'OK',
      data: { items: [], pagination: { page: 1, per_page: 20, total: 0 } },
    }));

    const fixture = TestBed.createComponent(PublicSharedLinkComponent);
    fixture.componentRef.setInput('token', 'token-123');
    fixture.detectChanges();

    expect(mockSfApi.resolveSharedLink).toHaveBeenCalledWith('token-123');
    expect(fixture.componentInstance.folder()).toBeTruthy();
    expect(fixture.componentInstance.linkAccessType()).toBe('view');
  });

  it('should set invalid on error', () => {
    mockSfApi.resolveSharedLink.mockReturnValue(throwError(() => new Error('invalid')));

    const fixture = TestBed.createComponent(PublicSharedLinkComponent);
    fixture.componentRef.setInput('token', 'token-123');
    fixture.detectChanges();

    expect(fixture.componentInstance.invalid()).toBe(true);
  });

  it('should format size', () => {
    const fixture = TestBed.createComponent(PublicSharedLinkComponent);
    fixture.componentRef.setInput('token', 'token-123');
    expect(fixture.componentInstance.formatSize(500)).toBe('500 B');
    expect(fixture.componentInstance.formatSize(2048)).toContain('KB');
    expect(fixture.componentInstance.formatSize(1048576)).toContain('MB');
  });

  it('should return mime icon', () => {
    const fixture = TestBed.createComponent(PublicSharedLinkComponent);
    fixture.componentRef.setInput('token', 'token-123');
    expect(fixture.componentInstance.mimeIcon('image/png')).toContain('🖼');
    expect(fixture.componentInstance.mimeIcon('video/mp4')).toContain('🎬');
    expect(fixture.componentInstance.mimeIcon(null)).toContain('📎');
  });
});
