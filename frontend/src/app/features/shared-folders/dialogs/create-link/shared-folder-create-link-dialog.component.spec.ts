import { fakeAsync, flush, TestBed } from '@angular/core/testing';
import { SharedFolderCreateLinkDialogComponent } from './shared-folder-create-link-dialog.component';
import { SharedFoldersApiService } from '../../../../core/api/shared-folders-api.service';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

describe('SharedFolderCreateLinkDialogComponent', () => {
  let mockSfApi: { createLink: ReturnType<typeof vi.fn> };

  const translateMock = {
    instant: (k: string) => k,
    get: () => of(''),
    getCurrentLang: () => 'ru',
    getParsedResult: (key: string) => key,
    onTranslationChange: { subscribe: () => ({ unsubscribe: () => {} }) },
    onLangChange: { subscribe: () => ({ unsubscribe: () => {} }) },
    onFallbackLangChange: { subscribe: () => ({ unsubscribe: () => {} }) },
  };

  beforeEach(async () => {
    mockSfApi = { createLink: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [SharedFolderCreateLinkDialogComponent],
      providers: [
        { provide: SharedFoldersApiService, useValue: mockSfApi },
        { provide: TranslateService, useValue: translateMock },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(SharedFolderCreateLinkDialogComponent);
    fixture.componentRef.setInput('folderId', 'folder-1');
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should have default form values', () => {
    const fixture = TestBed.createComponent(SharedFolderCreateLinkDialogComponent);
    fixture.componentRef.setInput('folderId', 'folder-1');
    expect(fixture.componentInstance.form.value.ttl_hours).toBe(12);
    expect(fixture.componentInstance.form.value.allow_save).toBe(false);
    expect(fixture.componentInstance.accessType()).toBe('view');
  });

  it('should submit and create link', () => {
    mockSfApi.createLink.mockReturnValue(of({
      result: 'success',
      message: 'OK',
      data: { link: { id: 'link-1', url: 'https://example.com/link', expires_at: '2026-01-01T00:00:00Z', access_type: 'view' } },
    }));

    const fixture = TestBed.createComponent(SharedFolderCreateLinkDialogComponent);
    fixture.componentRef.setInput('folderId', 'folder-1');
    fixture.detectChanges();
    fixture.componentInstance.form.setValue({ ttl_hours: 24, allow_save: true });
    fixture.componentInstance.accessType.set('edit');
    fixture.componentInstance.submit();

    expect(mockSfApi.createLink).toHaveBeenCalledWith('folder-1', {
      access_type: 'edit',
      ttl_hours: 24,
      allow_save: true,
    });
    expect(fixture.componentInstance.createdLink()).toBeTruthy();
    expect(fixture.componentInstance.createdLink()!.url).toBe('https://example.com/link');
  });

  it('should not submit when already submitting', () => {
    const fixture = TestBed.createComponent(SharedFolderCreateLinkDialogComponent);
    fixture.componentRef.setInput('folderId', 'folder-1');
    fixture.detectChanges();
    fixture.componentInstance['submitting'].set(true);
    fixture.componentInstance.submit();
    expect(mockSfApi.createLink).not.toHaveBeenCalled();
  });

  it('should copy link to clipboard', () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true, writable: true });

    const fixture = TestBed.createComponent(SharedFolderCreateLinkDialogComponent);
    fixture.componentRef.setInput('folderId', 'folder-1');
    fixture.detectChanges();
    fixture.componentInstance['createdLink'].set({
      id: 'link-1', url: 'https://copied.link', expires_at: '2026-01-01T00:00:00Z',
      access_type: 'view' as const,
    });
    fixture.componentInstance.copyLink();
    expect(writeText).toHaveBeenCalledWith('https://copied.link');
  });
});
