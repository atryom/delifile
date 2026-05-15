import { TestBed } from '@angular/core/testing';
import { SharedFolderAccessDialogComponent } from './shared-folder-access-dialog.component';
import { SharedFoldersApiService } from '../../../../core/api/shared-folders-api.service';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

describe('SharedFolderAccessDialogComponent', () => {
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
    listAccesses: vi.fn(() => of({ result: 'success', message: 'OK', data: { items: [] } })),
    listLinks: vi.fn(() => of({ result: 'success', message: 'OK', data: { items: [] } })),
    removeAccess: vi.fn(),
    disableLink: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [SharedFolderAccessDialogComponent],
      providers: [
        { provide: SharedFoldersApiService, useValue: mockSfApi },
        { provide: TranslateService, useValue: translateMock },
      ],
    }).compileComponents();
  });

  function createFixture() {
    const fixture = TestBed.createComponent(SharedFolderAccessDialogComponent);
    fixture.componentRef.setInput('folderId', 'folder-1');
    fixture.detectChanges();
    return fixture;
  }

  it('should create and load data', () => {
    const fixture = createFixture();
    expect(fixture.componentInstance).toBeTruthy();
    expect(mockSfApi.listAccesses).toHaveBeenCalledWith('folder-1');
    expect(mockSfApi.listLinks).toHaveBeenCalledWith('folder-1');
  });

  it('should remove access', () => {
    mockSfApi.removeAccess.mockReturnValue(of({ result: 'success', message: 'OK', data: {} }));
    const fixture = createFixture();
    fixture.componentInstance.removeAccess('access-1');
    expect(mockSfApi.removeAccess).toHaveBeenCalledWith('folder-1', 'access-1');
  });

  it('should disable link', () => {
    mockSfApi.disableLink.mockReturnValue(of({ result: 'success', message: 'OK', data: {} }));
    const fixture = createFixture();
    fixture.componentInstance.disableLink('link-1');
    expect(mockSfApi.disableLink).toHaveBeenCalledWith('folder-1', 'link-1');
  });

  it('should copy link', () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true, writable: true });
    const fixture = createFixture();
    fixture.componentInstance.copyLink('https://link.url', 'link-1');
    expect(writeText).toHaveBeenCalledWith('https://link.url');
  });
});
