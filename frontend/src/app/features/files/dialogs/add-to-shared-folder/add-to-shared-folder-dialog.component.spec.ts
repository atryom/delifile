import { TestBed } from '@angular/core/testing';
import { AddToSharedFolderDialogComponent } from './add-to-shared-folder-dialog.component';
import { SharedFoldersApiService } from '../../../../core/api/shared-folders-api.service';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

describe('AddToSharedFolderDialogComponent', () => {
  let mockSfApi: {
    getFileSharedFolders: ReturnType<typeof vi.fn>;
    updateFileSharedFolders: ReturnType<typeof vi.fn>;
  };

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
    mockSfApi = {
      getFileSharedFolders: vi.fn(() => of({
        result: 'success', message: 'OK',
        data: { folder_ids: ['sf-1'], folders: [
          { id: 'sf-1', name: 'Folder 1', parent_id: null, is_in: true },
          { id: 'sf-2', name: 'Folder 2', parent_id: null, is_in: false },
        ] },
      })),
      updateFileSharedFolders: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [AddToSharedFolderDialogComponent],
      providers: [
        { provide: SharedFoldersApiService, useValue: mockSfApi },
        { provide: TranslateService, useValue: translateMock },
      ],
    }).compileComponents();
  });

  function createFixture() {
    const fixture = TestBed.createComponent(AddToSharedFolderDialogComponent);
    fixture.componentRef.setInput('fileId', 'file-1');
    fixture.detectChanges();
    return fixture;
  }

  it('should create and load folders', () => {
    const fixture = createFixture();
    expect(fixture.componentInstance).toBeTruthy();
    expect(mockSfApi.getFileSharedFolders).toHaveBeenCalledWith('file-1');
  });

  it('should have pre-checked folder ids', () => {
    const fixture = createFixture();
    expect(fixture.componentInstance.checkedIds().has('sf-1')).toBe(true);
    expect(fixture.componentInstance.checkedIds().has('sf-2')).toBe(false);
  });

  it('should toggle folder selection', () => {
    const fixture = createFixture();
    const event = { target: { checked: true } } as unknown as Event;
    fixture.componentInstance.toggleFolder('sf-2', event);
    expect(fixture.componentInstance.checkedIds().has('sf-2')).toBe(true);
  });

  it('should build tree from folders', () => {
    const fixture = createFixture();
    expect(fixture.componentInstance.tree().length).toBe(2);
  });

  it('should save selection', () => {
    mockSfApi.updateFileSharedFolders.mockReturnValue(of({
      result: 'success', message: 'OK', data: {},
    }));

    const fixture = createFixture();
    fixture.componentInstance.save();
    expect(mockSfApi.updateFileSharedFolders).toHaveBeenCalledWith('file-1', ['sf-1']);
  });
});
