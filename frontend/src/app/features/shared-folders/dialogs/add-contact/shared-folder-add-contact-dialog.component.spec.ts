import { fakeAsync, flush, TestBed } from '@angular/core/testing';
import { SharedFolderAddContactDialogComponent } from './shared-folder-add-contact-dialog.component';
import { ContactsApiService } from '../../../../core/api/domain-api.services';
import { SharedFoldersApiService } from '../../../../core/api/shared-folders-api.service';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

describe('SharedFolderAddContactDialogComponent', () => {
  let mockContactsApi: { list: ReturnType<typeof vi.fn> };
  let mockSfApi: { addAccess: ReturnType<typeof vi.fn> };

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
    mockContactsApi = { list: vi.fn(() => of({ result: 'success', message: 'OK', data: { items: [] } })) };
    mockSfApi = { addAccess: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [SharedFolderAddContactDialogComponent],
      providers: [
        { provide: ContactsApiService, useValue: mockContactsApi },
        { provide: SharedFoldersApiService, useValue: mockSfApi },
        { provide: TranslateService, useValue: translateMock },
      ],
    }).compileComponents();
  });

  function createFixture() {
    const fixture = TestBed.createComponent(SharedFolderAddContactDialogComponent);
    fixture.componentRef.setInput('folderId', 'folder-1');
    fixture.detectChanges();
    return fixture;
  }

  it('should create and load contacts', () => {
    const fixture = createFixture();
    expect(fixture.componentInstance).toBeTruthy();
    expect(mockContactsApi.list).toHaveBeenCalledWith(undefined);
  });

  it('should select a contact', () => {
    const fixture = createFixture();
    const contact = { id: 'c1', name: 'John', email: 'john@test.com', is_registered: true };
    fixture.componentInstance.select(contact);
    expect(fixture.componentInstance.selectedId()).toBe('c1');
  });

  it('should submit and add access', () => {
    mockSfApi.addAccess.mockReturnValue(of({ result: 'success', message: 'OK', data: {} }));

    const fixture = TestBed.createComponent(SharedFolderAddContactDialogComponent);
    fixture.componentRef.setInput('folderId', 'folder-1');
    fixture.detectChanges();
    fixture.componentInstance['selectedId'].set('c1');
    fixture.componentInstance.submit();

    expect(mockSfApi.addAccess).toHaveBeenCalledWith('folder-1', 'c1', 'view');
  });

  it('should not submit without selection', () => {
    const fixture = createFixture();
    fixture.componentInstance.submit();
    expect(mockSfApi.addAccess).not.toHaveBeenCalled();
  });
});
