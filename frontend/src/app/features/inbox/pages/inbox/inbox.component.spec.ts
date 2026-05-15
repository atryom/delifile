import { TestBed } from '@angular/core/testing';
import { InboxComponent } from './inbox.component';
import { InboxApiService } from '../../../../core/api/inbox-api.service';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

describe('InboxComponent', () => {
  const translateMock = {
    instant: (k: string) => k,
    get: () => of(''),
    getCurrentLang: () => 'ru',
    getParsedResult: (key: string) => key,
    onTranslationChange: { subscribe: () => ({ unsubscribe: () => {} }) },
    onLangChange: { subscribe: () => ({ unsubscribe: () => {} }) },
    onFallbackLangChange: { subscribe: () => ({ unsubscribe: () => {} }) },
  };
  const mockInboxApi = {
    getFiles: vi.fn(() => of({ result: 'success', message: 'OK', data: { items: [] } })),
    getSharedFolders: vi.fn(() => of({ result: 'success', message: 'OK', data: { items: [] } })),
    acceptFiles: vi.fn(),
    rejectFiles: vi.fn(),
    acceptSharedFolders: vi.fn(),
    rejectSharedFolders: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [InboxComponent],
      providers: [
        { provide: InboxApiService, useValue: mockInboxApi },
        { provide: TranslateService, useValue: translateMock },
      ],
    }).compileComponents();
  });

  function createFixture() {
    const fixture = TestBed.createComponent(InboxComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('should create and load data', () => {
    const fixture = createFixture();
    expect(fixture.componentInstance).toBeTruthy();
    expect(mockInboxApi.getFiles).toHaveBeenCalledTimes(1);
    expect(mockInboxApi.getSharedFolders).toHaveBeenCalledTimes(1);
  });

  it('should toggle file selection', () => {
    const fixture = createFixture();
    fixture.componentInstance.toggleFileSelection('f1');
    expect(fixture.componentInstance.selectedFileIds().has('f1')).toBe(true);
    fixture.componentInstance.toggleFileSelection('f1');
    expect(fixture.componentInstance.selectedFileIds().has('f1')).toBe(false);
  });

  it('should toggle all files selection', () => {
    const fixture = createFixture();
    fixture.componentInstance['files'].set([
      { id: 'f1' } as any,
      { id: 'f2' } as any,
    ]);
    fixture.componentInstance.toggleAllFiles();
    expect(fixture.componentInstance.selectedFileIds().size).toBe(2);
    fixture.componentInstance.toggleAllFiles();
    expect(fixture.componentInstance.selectedFileIds().size).toBe(0);
  });

  it('should toggle folder selection', () => {
    const fixture = createFixture();
    fixture.componentInstance.toggleFolderSelection('sf1');
    expect(fixture.componentInstance.selectedFolderIds().has('sf1')).toBe(true);
  });

  it('should toggle all folders selection', () => {
    const fixture = createFixture();
    fixture.componentInstance['folders'].set([
      { id: 'sf1' } as any,
      { id: 'sf2' } as any,
    ]);
    fixture.componentInstance.toggleAllFolders();
    expect(fixture.componentInstance.selectedFolderIds().size).toBe(2);
  });

  it('should accept selected files', () => {
    mockInboxApi.acceptFiles.mockReturnValue(of({ result: 'success', message: 'OK', data: {} }));
    const fixture = createFixture();
    fixture.componentInstance['selectedFileIds'].set(new Set(['f1']));
    fixture.componentInstance.acceptFiles();
    expect(mockInboxApi.acceptFiles).toHaveBeenCalledWith(['f1']);
  });

  it('should reject selected files', () => {
    mockInboxApi.rejectFiles.mockReturnValue(of({ result: 'success', message: 'OK', data: {} }));
    const fixture = createFixture();
    fixture.componentInstance['selectedFileIds'].set(new Set(['f1']));
    fixture.componentInstance.rejectFiles();
    expect(mockInboxApi.rejectFiles).toHaveBeenCalledWith(['f1']);
  });

  it('should accept selected folders', () => {
    mockInboxApi.acceptSharedFolders.mockReturnValue(of({ result: 'success', message: 'OK', data: {} }));
    const fixture = createFixture();
    fixture.componentInstance['selectedFolderIds'].set(new Set(['sf1']));
    fixture.componentInstance.acceptFolders();
    expect(mockInboxApi.acceptSharedFolders).toHaveBeenCalledWith(['sf1']);
  });

  it('should reject selected folders', () => {
    mockInboxApi.rejectSharedFolders.mockReturnValue(of({ result: 'success', message: 'OK', data: {} }));
    const fixture = createFixture();
    fixture.componentInstance['selectedFolderIds'].set(new Set(['sf1']));
    fixture.componentInstance.rejectFolders();
    expect(mockInboxApi.rejectSharedFolders).toHaveBeenCalledWith(['sf1']);
  });

  it('should clear selections', () => {
    const fixture = createFixture();
    fixture.componentInstance['selectedFileIds'].set(new Set(['f1']));
    fixture.componentInstance['selectedFolderIds'].set(new Set(['sf1']));
    fixture.componentInstance.clearFileSelection();
    fixture.componentInstance.clearFolderSelection();
    expect(fixture.componentInstance.selectedFileIds().size).toBe(0);
    expect(fixture.componentInstance.selectedFolderIds().size).toBe(0);
  });
});
