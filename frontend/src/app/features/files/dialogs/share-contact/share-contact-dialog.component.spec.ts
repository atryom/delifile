import { fakeAsync, flush, TestBed } from '@angular/core/testing';
import { ShareContactDialogComponent } from './share-contact-dialog.component';
import { FilesApiService } from '../../../../core/api/files-api.service';
import { ContactsApiService } from '../../../../core/api/domain-api.services';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

describe('ShareContactDialogComponent', () => {
  let mockFilesApi: { shareToContact: ReturnType<typeof vi.fn> };
  let mockContactsApi: { list: ReturnType<typeof vi.fn> };

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
    mockFilesApi = { shareToContact: vi.fn() };
    mockContactsApi = { list: vi.fn(() => of({ result: 'success', message: 'OK', data: { items: [] } })) };

    await TestBed.configureTestingModule({
      imports: [ShareContactDialogComponent],
      providers: [
        { provide: FilesApiService, useValue: mockFilesApi },
        { provide: ContactsApiService, useValue: mockContactsApi },
        { provide: TranslateService, useValue: translateMock },
      ],
    }).compileComponents();
  });

  function createFixture() {
    const fixture = TestBed.createComponent(ShareContactDialogComponent);
    fixture.componentRef.setInput('fileId', 'file-1');
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
    const contact = { id: 'c1', name: 'John', email: 'john@test.com', is_registered: true, phone: null };
    fixture.componentInstance.select(contact);
    expect(fixture.componentInstance.selectedId()).toBe('c1');
  });

  it('should submit and share file', () => {
    mockFilesApi.shareToContact.mockReturnValue(of({
      result: 'success', message: 'OK',
      data: { share: { status: 'shared' } },
    }));

    const fixture = TestBed.createComponent(ShareContactDialogComponent);
    fixture.componentRef.setInput('fileId', 'file-1');
    fixture.detectChanges();
    fixture.componentInstance['selectedId'].set('c1');
    fixture.componentInstance.submit();

    expect(mockFilesApi.shareToContact).toHaveBeenCalledWith('file-1', 'c1');
  });

  it('should not submit without selection', () => {
    const fixture = createFixture();
    fixture.componentInstance.submit();
    expect(mockFilesApi.shareToContact).not.toHaveBeenCalled();
  });
});
