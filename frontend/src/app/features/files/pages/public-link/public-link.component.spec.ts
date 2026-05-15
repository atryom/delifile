import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { provideTranslateService } from '@ngx-translate/core';
import { FilesApiService } from '../../../../core/api/files-api.service';
import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { PublicLinkComponent } from './public-link.component';

describe('PublicLinkComponent', () => {
  const mockFilesApi = {
    resolveLink: vi.fn(),
    downloadViaLink: vi.fn(),
    saveViaLink: vi.fn(),
  };
  const mockAuthState = { isAuthenticated: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockAuthState.isAuthenticated.mockReturnValue(false);
    await TestBed.configureTestingModule({
      imports: [PublicLinkComponent],
      providers: [
        provideTranslateService(),
        { provide: FilesApiService, useValue: mockFilesApi },
        { provide: AuthStateService, useValue: mockAuthState },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: vi.fn() } } } },
      ],
    }).compileComponents();
  });

  // ─── Init ───────────────────────────────────────────────────────

  it('should create and resolve link', () => {
    mockFilesApi.resolveLink.mockReturnValue(of({
      data: {
        file: { original_name: 'doc.pdf', size: 1024, mime_type: 'application/pdf' },
        link: { expires_at: null, allow_save: true },
      },
    }));

    const fixture = TestBed.createComponent(PublicLinkComponent);
    fixture.componentRef.setInput('token', 'pub-tok');
    fixture.detectChanges(); // ngOnInit

    expect(mockFilesApi.resolveLink).toHaveBeenCalledWith('pub-tok');
    expect(fixture.componentInstance.status()).toBe('ready');
    expect(fixture.componentInstance.fileInfo()?.original_name).toBe('doc.pdf');
  });

  it('should go to invalid state on resolve failure', () => {
    mockFilesApi.resolveLink.mockReturnValue(throwError(() => ({})));

    const fixture = TestBed.createComponent(PublicLinkComponent);
    fixture.componentRef.setInput('token', 'bad-tok');
    fixture.detectChanges();

    expect(fixture.componentInstance.status()).toBe('invalid');
  });

  // ─── Computed flags ─────────────────────────────────────────────

  it('should detect video files', () => {
    mockFilesApi.resolveLink.mockReturnValue(of({
      data: { file: { mime_type: 'video/mp4' }, link: {} },
    }));

    const fixture = TestBed.createComponent(PublicLinkComponent);
    fixture.componentRef.setInput('token', 'tok');
    fixture.detectChanges();

    expect(fixture.componentInstance.isVideo()).toBe(true);
    expect(fixture.componentInstance.isAudio()).toBe(false);
  });

  it('should detect audio files', () => {
    mockFilesApi.resolveLink.mockReturnValue(of({
      data: { file: { mime_type: 'audio/mpeg' }, link: {} },
    }));

    const fixture = TestBed.createComponent(PublicLinkComponent);
    fixture.componentRef.setInput('token', 'tok');
    fixture.detectChanges();

    expect(fixture.componentInstance.isVideo()).toBe(false);
    expect(fixture.componentInstance.isAudio()).toBe(true);
  });

  // ─── formatSize helper ──────────────────────────────────────────

  it('should format file sizes', () => {
    mockFilesApi.resolveLink.mockReturnValue(of({
      data: { file: { original_name: 'f', size: 0, mime_type: '' }, link: {} },
    }));

    const fixture = TestBed.createComponent(PublicLinkComponent);
    fixture.componentRef.setInput('token', 'tok');
    fixture.detectChanges();

    expect(fixture.componentInstance.formatSize(500)).toBe('500 B');
    expect(fixture.componentInstance.formatSize(2048)).toBe('2.0 KB');
  });

  // ─── Download ───────────────────────────────────────────────────

  it('should download via link', () => {
    mockFilesApi.resolveLink.mockReturnValue(of({
      data: { file: { original_name: 'f', size: 0, mime_type: '' }, link: {} },
    }));
    mockFilesApi.downloadViaLink.mockReturnValue(of({
      data: { url: 'https://cdn.example.com/file' },
    }));

    const fixture = TestBed.createComponent(PublicLinkComponent);
    fixture.componentRef.setInput('token', 'tok');
    fixture.detectChanges();

    fixture.componentInstance.download();
    expect(mockFilesApi.downloadViaLink).toHaveBeenCalledWith('tok');
    expect(fixture.componentInstance.status()).toBe('downloaded');
  });

  it('should go to invalid on download failure', () => {
    mockFilesApi.resolveLink.mockReturnValue(of({
      data: { file: { original_name: 'f', size: 0, mime_type: '' }, link: {} },
    }));
    mockFilesApi.downloadViaLink.mockReturnValue(throwError(() => ({})));

    const fixture = TestBed.createComponent(PublicLinkComponent);
    fixture.componentRef.setInput('token', 'tok');
    fixture.detectChanges();

    fixture.componentInstance.download();
    expect(fixture.componentInstance.status()).toBe('invalid');
  });

  // ─── Save to Account ────────────────────────────────────────────

  it('should save file to account', () => {
    mockFilesApi.resolveLink.mockReturnValue(of({
      data: { file: { original_name: 'f', size: 0, mime_type: '' }, link: {} },
    }));
    mockFilesApi.saveViaLink.mockReturnValue(of({}));

    const fixture = TestBed.createComponent(PublicLinkComponent);
    fixture.componentRef.setInput('token', 'tok');
    fixture.detectChanges();

    fixture.componentInstance.saveToAccount();
    expect(mockFilesApi.saveViaLink).toHaveBeenCalledWith('tok');
    expect(fixture.componentInstance.saved()).toBe(true);
  });

  it('should set saved even when already saved', () => {
    mockFilesApi.resolveLink.mockReturnValue(of({
      data: { file: { original_name: 'f', size: 0, mime_type: '' }, link: {} },
    }));
    mockFilesApi.saveViaLink.mockReturnValue(throwError(() => ({
      data: { code: 'ALREADY_SAVED' },
    })));

    const fixture = TestBed.createComponent(PublicLinkComponent);
    fixture.componentRef.setInput('token', 'tok');
    fixture.detectChanges();

    fixture.componentInstance.saveToAccount();
    expect(fixture.componentInstance.saved()).toBe(true);
    expect(fixture.componentInstance.saveError()).toBeNull();
  });

  it('should show error on save failure', () => {
    mockFilesApi.resolveLink.mockReturnValue(of({
      data: { file: { original_name: 'f', size: 0, mime_type: '' }, link: {} },
    }));
    mockFilesApi.saveViaLink.mockReturnValue(throwError(() => ({
      message: 'Link expired',
    })));

    const fixture = TestBed.createComponent(PublicLinkComponent);
    fixture.componentRef.setInput('token', 'tok');
    fixture.detectChanges();

    fixture.componentInstance.saveToAccount();
    expect(fixture.componentInstance.saved()).toBe(false);
    expect(fixture.componentInstance.saveError()).toBe('Link expired');
  });

  // ─── fileIcon helper ────────────────────────────────────────────

  it('should return correct icon for file type', () => {
    mockFilesApi.resolveLink.mockReturnValue(of({
      data: { file: { original_name: 'f', size: 0, mime_type: '' }, link: {} },
    }));

    const fixture = TestBed.createComponent(PublicLinkComponent);
    fixture.componentRef.setInput('token', 'tok');
    fixture.detectChanges();

    expect(fixture.componentInstance.fileIcon()).toBe('📎');

    fixture.componentInstance.fileInfo.set({
      original_name: 'p', size: 0, mime_type: 'image/png',
    });
    expect(fixture.componentInstance.fileIcon()).toBe('🖼️');

    fixture.componentInstance.fileInfo.set({
      original_name: 'p', size: 0, mime_type: 'application/pdf',
    });
    expect(fixture.componentInstance.fileIcon()).toBe('📄');
  });
});
