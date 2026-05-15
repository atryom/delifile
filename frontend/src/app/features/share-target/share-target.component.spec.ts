import { TestBed } from '@angular/core/testing';
import { ShareTargetComponent } from './share-target.component';
import { Router } from '@angular/router';
import { AuthStateService } from '../../core/auth/auth-state.service';
import { FileUploadService } from '../files/services/file-upload.service';
import { UrlFilesApiService } from '../../core/api/url-files-api.service';
import { FilesApiService } from '../../core/api/files-api.service';
import { TranslateService } from '@ngx-translate/core';
import { signal } from '@angular/core';
import { of } from 'rxjs';

describe('ShareTargetComponent', () => {
  const mockAuthState = {
    isAuthenticated: signal(false),
    user: signal(null),
  };
  const mockRouter = {
    navigate: vi.fn(),
    navigateByUrl: vi.fn(),
  };
  const mockUploadSvc = {
    state: signal({ phase: 'idle', progress: 0, fileId: null, error: null }),
    upload: vi.fn(),
    reset: vi.fn(),
  };
  const mockUrlFilesApi = { create: vi.fn() };
  const mockFilesApi = { updateDescription: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [ShareTargetComponent],
      providers: [
        { provide: Router, useValue: mockRouter },
        { provide: AuthStateService, useValue: mockAuthState },
        { provide: FileUploadService, useValue: mockUploadSvc },
        { provide: UrlFilesApiService, useValue: mockUrlFilesApi },
        { provide: FilesApiService, useValue: mockFilesApi },
        { provide: TranslateService, useValue: { instant: (k: string) => k, get: () => of(''), getCurrentLang: () => 'ru', getParsedResult: (key: string) => key, onTranslationChange: { subscribe: () => ({ unsubscribe: () => {} }) }, onLangChange: { subscribe: () => ({ unsubscribe: () => {} }) }, onFallbackLangChange: { subscribe: () => ({ unsubscribe: () => {} }) } } },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ShareTargetComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show need-auth when not authenticated', () => {
    const fixture = TestBed.createComponent(ShareTargetComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.phase()).toBe('need-auth');
  });

  it('should navigate to login', () => {
    const fixture = TestBed.createComponent(ShareTargetComponent);
    fixture.componentInstance.goLogin();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/share-target' } });
  });

  it('should cancel and go to files', () => {
    const fixture = TestBed.createComponent(ShareTargetComponent);
    fixture.componentInstance.cancel();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/files']);
  });

  it('should go to files', () => {
    const fixture = TestBed.createComponent(ShareTargetComponent);
    fixture.componentInstance.goToFiles();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/files']);
  });

  it('should format size', () => {
    const fixture = TestBed.createComponent(ShareTargetComponent);
    expect(fixture.componentInstance.formatSize(500)).toBe('500 Б');
    expect(fixture.componentInstance.formatSize(2048)).toContain('КБ');
    expect(fixture.componentInstance.formatSize(1048576)).toContain('МБ');
  });

  it('should validate URLs', () => {
    const fixture = TestBed.createComponent(ShareTargetComponent);
    expect(fixture.componentInstance['isValidUrl']('https://example.com')).toBe(true);
    expect(fixture.componentInstance['isValidUrl']('not a url')).toBe(false);
  });

  it('should extract URL from text', () => {
    const fixture = TestBed.createComponent(ShareTargetComponent);
    const result = fixture.componentInstance['extractUrlFromText']('Check this https://example.com/page');
    expect(result.url).toBe('https://example.com/page');
    expect(result.description).toBe('Check this');
  });

  it('should extract URL from text with trailing punctuation', () => {
    const fixture = TestBed.createComponent(ShareTargetComponent);
    const result = fixture.componentInstance['extractUrlFromText']('See https://example.com/page.');
    expect(result.url).toBe('https://example.com/page');
  });

  it('should return empty URL when no URL in text', () => {
    const fixture = TestBed.createComponent(ShareTargetComponent);
    const result = fixture.componentInstance['extractUrlFromText']('Just text');
    expect(result.url).toBe('');
    expect(result.description).toBe('Just text');
  });

  it('should detect Delifile links', () => {
    const fixture = TestBed.createComponent(ShareTargetComponent);
    fixture.componentInstance['sharedUrl'].set('https://delifile.ru/link/abc123');
    expect(fixture.componentInstance.isDeliFileLink()).toBe(true);
    fixture.componentInstance['sharedUrl'].set('https://example.com');
    expect(fixture.componentInstance.isDeliFileLink()).toBe(false);
  });
});
