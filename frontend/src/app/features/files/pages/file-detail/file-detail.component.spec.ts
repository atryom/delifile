import { TestBed } from '@angular/core/testing';
import { FileDetailComponent } from './file-detail.component';
import { FilesApiService } from '../../../../core/api/files-api.service';
import { DocumentsApiService } from '../../../../core/api/documents-api.service';
import { OrganizationApiService } from '../../../../core/api/organization-api.service';
import { SharedFoldersApiService } from '../../../../core/api/shared-folders-api.service';
import { CommentsApiService } from '../../../../core/api/comments-api.service';
import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { FileAccess } from '../../../../shared/models/api.models';

describe('FileDetailComponent', () => {
  const mockFilesApi = {
    get: vi.fn(),
    listLinks: vi.fn(() => of({ result: 'success', data: { items: [] } })),
    accesses: vi.fn(() => of({ result: 'success', data: { items: [] } })),
    activity: vi.fn(() => of({ result: 'success', data: { items: [] } })),
    download: vi.fn(() => of({ result: 'success', data: { url: 'https://example.com/dl' } })),
    downloadVersion: vi.fn(() => of({ result: 'success', data: { url: 'https://example.com/dl' } })),
    updateDescription: vi.fn(() => of({ result: 'success', data: { description: 'new desc' } })),
    favorite: vi.fn(() => of({ result: 'success' })),
    unfavorite: vi.fn(() => of({ result: 'success' })),
    delete: vi.fn(() => of({ result: 'success' })),
    moveFolder: vi.fn(() => of({ result: 'success' })),
    disableLink: vi.fn(() => of({ result: 'success' })),
    updateVersion: vi.fn(() => of({ result: 'success', data: { version: { id: 'v-1', is_active: true } } })),
    updateDisplayName: vi.fn(() => of({ result: 'success', data: { display_name: 'New Name' } })),
    revokeContactAccess: vi.fn(() => of({ result: 'success', data: {} })),
    updateAccess: vi.fn(() => of({ result: 'success', data: {} })),
    shareToContact: vi.fn(() => of({ result: 'success', data: { share: { contact_id: 'c-1', status: 'shared' } } })),
  };
  const mockDocsApi = {
    takeover: vi.fn(() => of({ result: 'success', data: { lock: {} } })),
  };
  const mockOrgApi = {
    getTags: vi.fn(() => of({ result: 'success', data: { items: [] } })),
    getFolderTree: vi.fn(() => of({ result: 'success', data: { items: [] } })),
    attachTags: vi.fn(() => of({ result: 'success' })),
    detachTags: vi.fn(() => of({ result: 'success' })),
    createTag: vi.fn(() => of({ result: 'success', data: { tag: { id: 't-new', name: 'new' } } })),
    updateFolder: vi.fn(),
    createFolder: vi.fn(),
    deleteFolder: vi.fn(),
  };
  const mockSfApi = {
    addFileToMyFiles: vi.fn(() => of({ result: 'success' })),
    list: vi.fn(),
    listAll: vi.fn(),
  };
  const mockCommentsApi = {
    getThreads: vi.fn(() => of({ result: 'success', data: { policy: {}, threads: {} } })),
    getThread: vi.fn(),
    markRead: vi.fn(() => of({})),
    createComment: vi.fn(),
    updateComment: vi.fn(),
    deleteComment: vi.fn(),
    updateFileCommentSettings: vi.fn(),
    updateSharedFolderCommentSettings: vi.fn(),
  };
  const mockAuthState = {
    isAuthenticated: signal(true),
    user: signal({ id: 'u-1', email: 'test@test.com' }),
    plan: signal('free'),
  };
  const mockRouter = { navigate: vi.fn() };
  const translateMock = {
    instant: (k: string) => k,
    get: () => of(''),
    getCurrentLang: () => 'ru',
    getParsedResult: (key: string) => key,
    onTranslationChange: { subscribe: () => ({ unsubscribe: () => {} }) },
    onLangChange: { subscribe: () => ({ unsubscribe: () => {} }) },
    onFallbackLangChange: { subscribe: () => ({ unsubscribe: () => {} }) },
  };

  function makeFile(overrides?: Record<string, any>) {
    return {
      id: 'f-1', original_name: 'test.txt', display_name: null, mime_type: 'text/plain',
      size: 1024, is_favorite: false, is_owner: true, has_versions: false,
      content_kind: 'file', preview_url: null, view_url: null, link_url: null,
      description: null, folder_id: null, shared_folder_only: false,
      tags: [], versions: [{ id: 'v-1', version_number: 1, is_active: true, size: 1024, original_name: 'test.txt', version_label: null, comment: null, preview_url: null }],
      ...overrides,
    };
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    mockFilesApi.get.mockReturnValue(of({ result: 'success', data: { file: makeFile() } }));

    await TestBed.configureTestingModule({
      imports: [FileDetailComponent],
      providers: [
        { provide: FilesApiService, useValue: mockFilesApi },
        { provide: DocumentsApiService, useValue: mockDocsApi },
        { provide: OrganizationApiService, useValue: mockOrgApi },
        { provide: SharedFoldersApiService, useValue: mockSfApi },
        { provide: AuthStateService, useValue: mockAuthState },
        { provide: CommentsApiService, useValue: mockCommentsApi },
        { provide: Router, useValue: mockRouter },
        { provide: TranslateService, useValue: translateMock },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(FileDetailComponent);
    fixture.componentRef.setInput('id', 'f-1');
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should load file on init', () => {
    const fixture = TestBed.createComponent(FileDetailComponent);
    fixture.componentRef.setInput('id', 'f-1');
    fixture.detectChanges();
    expect(mockFilesApi.get).toHaveBeenCalledWith('f-1');
  });

  it('should show loading while fetching file', () => {
    mockFilesApi.get.mockReturnValue(of({ result: 'success', data: { file: makeFile() } }));
    const fixture = TestBed.createComponent(FileDetailComponent);
    fixture.componentRef.setInput('id', 'f-1');
    expect(fixture.componentInstance.loading()).toBe(false);
    fixture.detectChanges();
  });

  it('should compute display title', () => {
    const fixture = TestBed.createComponent(FileDetailComponent);
    fixture.componentRef.setInput('id', 'f-1');
    fixture.componentInstance.file.set(makeFile({ original_name: 'doc.txt' }));
    expect(fixture.componentInstance.displayTitle()).toBe('doc.txt');
  });

  it('should compute display title from selected version', () => {
    const fixture = TestBed.createComponent(FileDetailComponent);
    fixture.componentRef.setInput('id', 'f-1');
    fixture.componentInstance.file.set(makeFile({
      original_name: 'doc.txt',
      versions: [{ id: 'v-2', version_number: 2, is_active: true, size: 2048, original_name: 'v2.txt', version_label: null, comment: null, preview_url: null }],
    }));
    fixture.componentInstance.selectedVersionId.set('v-2');
    expect(fixture.componentInstance.displayTitle()).toBe('v2.txt');
  });

  it('should compute display size', () => {
    const fixture = TestBed.createComponent(FileDetailComponent);
    fixture.componentRef.setInput('id', 'f-1');
    fixture.componentInstance.file.set(makeFile({ size: 2048 }));
    expect(fixture.componentInstance.displaySize()).toBe(2048);
  });

  it('should download file', () => {
    const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
    const fixture = TestBed.createComponent(FileDetailComponent);
    fixture.componentRef.setInput('id', 'f-1');
    fixture.componentInstance.file.set(makeFile());
    fixture.componentInstance.download();
    expect(mockFilesApi.download).toHaveBeenCalledWith('f-1');
    windowOpen.mockRestore();
  });

  it('should toggle favorite', () => {
    const fixture = TestBed.createComponent(FileDetailComponent);
    fixture.componentRef.setInput('id', 'f-1');
    fixture.componentInstance.file.set(makeFile({ is_favorite: false }));
    fixture.componentInstance.toggleFavorite();
    expect(mockFilesApi.favorite).toHaveBeenCalledWith('f-1');
  });

  it('should unfavorite', () => {
    const fixture = TestBed.createComponent(FileDetailComponent);
    fixture.componentRef.setInput('id', 'f-1');
    fixture.componentInstance.file.set(makeFile({ is_favorite: true }));
    fixture.componentInstance.toggleFavorite();
    expect(mockFilesApi.unfavorite).toHaveBeenCalledWith('f-1');
  });

  it('should save description', () => {
    const fixture = TestBed.createComponent(FileDetailComponent);
    fixture.componentRef.setInput('id', 'f-1');
    fixture.componentInstance.file.set(makeFile());
    fixture.componentInstance.descriptionDraft = 'new description';
    fixture.componentInstance.saveDescription();
    expect(mockFilesApi.updateDescription).toHaveBeenCalledWith('f-1', 'new description');
  });

  it('should delete file', () => {
    const fixture = TestBed.createComponent(FileDetailComponent);
    fixture.componentRef.setInput('id', 'f-1');
    fixture.componentInstance.file.set(makeFile());
    window.confirm = vi.fn(() => true) as any;
    fixture.componentInstance.deleteFile();
    expect(mockFilesApi.delete).toHaveBeenCalledWith('f-1');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/folders']);
  });

  it('should add tag', () => {
    const fixture = TestBed.createComponent(FileDetailComponent);
    fixture.componentRef.setInput('id', 'f-1');
    fixture.componentInstance.file.set(makeFile());
    fixture.componentInstance.addTag({ id: 't-1', name: 'important' });
    expect(mockOrgApi.attachTags).toHaveBeenCalledWith('f-1', ['t-1']);
  });

  it('should remove tag', () => {
    const fixture = TestBed.createComponent(FileDetailComponent);
    fixture.componentRef.setInput('id', 'f-1');
    fixture.componentInstance.file.set(makeFile({ tags: [{ id: 't-1', name: 'important' }] }));
    fixture.componentInstance.removeTag({ id: 't-1', name: 'important' });
    expect(mockOrgApi.detachTags).toHaveBeenCalledWith('f-1', ['t-1']);
  });

  it('should create and add tag', () => {
    const fixture = TestBed.createComponent(FileDetailComponent);
    fixture.componentRef.setInput('id', 'f-1');
    fixture.componentInstance.file.set(makeFile());
    fixture.componentInstance.tagSearchQuery.set('newtag');
    fixture.componentInstance.createAndAddTag();
    expect(mockOrgApi.createTag).toHaveBeenCalledWith('newtag');
  });

  it('should save folder selection', () => {
    const fixture = TestBed.createComponent(FileDetailComponent);
    fixture.componentRef.setInput('id', 'f-1');
    fixture.componentInstance.file.set(makeFile());
    fixture.componentInstance.pendingFolderId.set('folder-2');
    fixture.componentInstance.saveFolderSelection();
    expect(mockFilesApi.moveFolder).toHaveBeenCalledWith('f-1', 'folder-2');
  });

  it('should open and close dialogs', () => {
    const fixture = TestBed.createComponent(FileDetailComponent);
    fixture.componentRef.setInput('id', 'f-1');
    fixture.componentInstance.showShareDialog.set(true);
    fixture.componentInstance.onShared();
    expect(fixture.componentInstance.showShareDialog()).toBe(false);
  });

  it('should disable link', () => {
    const fixture = TestBed.createComponent(FileDetailComponent);
    fixture.componentRef.setInput('id', 'f-1');
    fixture.componentInstance.links.set([{ id: 'l-1', status: 'active' } as any]);
    fixture.componentInstance.disableLink({ id: 'l-1', status: 'active' } as any);
    expect(mockFilesApi.disableLink).toHaveBeenCalledWith('l-1');
  });

  it('should save version', () => {
    const fixture = TestBed.createComponent(FileDetailComponent);
    fixture.componentRef.setInput('id', 'f-1');
    fixture.componentInstance.file.set(makeFile());
    fixture.componentInstance.versionLabelDraft = '2.0';
    fixture.componentInstance.versionCommentDraft = 'Big update';
    fixture.componentInstance.saveVersion({ id: 'v-1' } as any);
    expect(mockFilesApi.updateVersion).toHaveBeenCalledWith('f-1', 'v-1', { version_label: '2.0', comment: 'Big update' });
  });

  it('should toggle version active', () => {
    const fixture = TestBed.createComponent(FileDetailComponent);
    fixture.componentRef.setInput('id', 'f-1');
    fixture.componentInstance.file.set(makeFile());
    fixture.componentInstance.toggleVersionActive({ id: 'v-1', is_active: false } as any);
    expect(mockFilesApi.updateVersion).toHaveBeenCalledWith('f-1', 'v-1', { is_active: true });
  });

  it('should save display name', () => {
    const fixture = TestBed.createComponent(FileDetailComponent);
    fixture.componentRef.setInput('id', 'f-1');
    fixture.componentInstance.file.set(makeFile());
    fixture.componentInstance.displayNameDraft = 'Display Name';
    fixture.componentInstance.saveDisplayName();
    expect(mockFilesApi.updateDisplayName).toHaveBeenCalledWith('f-1', 'Display Name');
  });

  it('should select version', () => {
    const fixture = TestBed.createComponent(FileDetailComponent);
    fixture.componentRef.setInput('id', 'f-1');
    fixture.componentInstance.selectVersion('v-2');
    expect(fixture.componentInstance.selectedVersionId()).toBe('v-2');
  });

  it('should format size', () => {
    const fixture = TestBed.createComponent(FileDetailComponent);
    expect(fixture.componentInstance.formatSize(500)).toBe('500 Б');
    expect(fixture.componentInstance.formatSize(2048)).toContain('КБ');
  });

  it('should return mime icon', () => {
    const fixture = TestBed.createComponent(FileDetailComponent);
    expect(fixture.componentInstance.mimeIcon('image/png')).toContain('🖼');
    expect(fixture.componentInstance.mimeIcon('video/mp4')).toContain('🎬');
  });

  it('should check canViewInBrowser', () => {
    const fixture = TestBed.createComponent(FileDetailComponent);
    fixture.componentRef.setInput('id', 'f-1');
    fixture.componentInstance.file.set(makeFile({ mime_type: 'image/png', view_url: 'https://example.com/view' }));
    expect(fixture.componentInstance.canViewInBrowser()).toBe(true);
  });

  it('should return false for canViewInBrowser without view_url', () => {
    const fixture = TestBed.createComponent(FileDetailComponent);
    fixture.componentRef.setInput('id', 'f-1');
    fixture.componentInstance.file.set(makeFile({ mime_type: 'image/png', view_url: null }));
    expect(fixture.componentInstance.canViewInBrowser()).toBe(false);
  });

  it('should add to my files', () => {
    const fixture = TestBed.createComponent(FileDetailComponent);
    fixture.componentRef.setInput('id', 'f-1');
    fixture.componentInstance.file.set(makeFile({ shared_folder_only: true }));
    fixture.componentInstance.addToMyFiles();
    expect(mockSfApi.addFileToMyFiles).toHaveBeenCalledWith('f-1');
  });

  it('should set feedback message and clear after timeout', () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(FileDetailComponent);
    fixture.componentRef.setInput('id', 'f-1');
    fixture.componentInstance.showFeedback('Saved!');
    expect(fixture.componentInstance.feedback()).toBe('Saved!');
    vi.advanceTimersByTime(3000);
    expect(fixture.componentInstance.feedback()).toBeNull();
    vi.useRealTimers();
  });

  // ── revokeAccess ──────────────────────────────────────────────────────────────

  function makeAccess(overrides?: Partial<FileAccess>): FileAccess {
    return {
      id: 'a-1',
      access_type: 'shared',
      user: { id: 42, email: 'bob@test.com', name: 'Bob' },
      contact_id: 'c-bob',
      is_favorite: false,
      saved_at: null,
      can_edit: false,
      ...overrides,
    };
  }

  it('revokeAccess() calls revokeContactAccess with contact_id and removes entry', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fixture = TestBed.createComponent(FileDetailComponent);
    fixture.componentRef.setInput('id', 'f-1');
    const access = makeAccess();
    fixture.componentInstance.accesses.set([access]);

    fixture.componentInstance.revokeAccess(access);

    expect(mockFilesApi.revokeContactAccess).toHaveBeenCalledWith('f-1', 'c-bob');
    expect(fixture.componentInstance.accesses()).toHaveLength(0);
  });

  it('revokeAccess() falls back to user id string when contact_id is absent', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fixture = TestBed.createComponent(FileDetailComponent);
    fixture.componentRef.setInput('id', 'f-1');
    const access = makeAccess({ contact_id: null });
    fixture.componentInstance.accesses.set([access]);

    fixture.componentInstance.revokeAccess(access);

    expect(mockFilesApi.revokeContactAccess).toHaveBeenCalledWith('f-1', '42');
  });

  it('revokeAccess() does nothing when confirm is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const fixture = TestBed.createComponent(FileDetailComponent);
    fixture.componentRef.setInput('id', 'f-1');
    const access = makeAccess();
    fixture.componentInstance.accesses.set([access]);

    fixture.componentInstance.revokeAccess(access);

    expect(mockFilesApi.revokeContactAccess).not.toHaveBeenCalled();
    expect(fixture.componentInstance.accesses()).toHaveLength(1);
  });

  it('revokeAccess() on markdown file: fires editorRefreshTrigger after success', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fixture = TestBed.createComponent(FileDetailComponent);
    fixture.componentRef.setInput('id', 'f-1');
    fixture.componentInstance.file.set(makeFile({ mime_type: 'text/markdown' }));
    const access = makeAccess();
    fixture.componentInstance.accesses.set([access]);
    const before = fixture.componentInstance.editorRefreshTrigger();

    fixture.componentInstance.revokeAccess(access);

    expect(fixture.componentInstance.editorRefreshTrigger()).toBeGreaterThan(before);
    expect(fixture.componentInstance.accesses()).toHaveLength(0);
  });

  it('revokeAccess() on non-markdown file: does not fire editorRefreshTrigger', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fixture = TestBed.createComponent(FileDetailComponent);
    fixture.componentRef.setInput('id', 'f-1');
    fixture.componentInstance.file.set(makeFile({ mime_type: 'text/plain' }));
    const access = makeAccess();
    fixture.componentInstance.accesses.set([access]);
    const before = fixture.componentInstance.editorRefreshTrigger();

    fixture.componentInstance.revokeAccess(access);

    expect(fixture.componentInstance.editorRefreshTrigger()).toBe(before);
  });

  it('revokeAccess() on locked markdown file: calls takeover then retries revoke', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockFilesApi.revokeContactAccess
      .mockReturnValueOnce(throwError(() => ({ status: 423, error: { message: 'Document is locked by another user' } })))
      .mockReturnValue(of({ result: 'success', data: {} }));

    const fixture = TestBed.createComponent(FileDetailComponent);
    fixture.componentRef.setInput('id', 'f-1');
    fixture.componentInstance.file.set(makeFile({ mime_type: 'text/markdown' }));
    const access = makeAccess();
    fixture.componentInstance.accesses.set([access]);

    fixture.componentInstance.revokeAccess(access);

    expect(mockDocsApi.takeover).toHaveBeenCalledWith('f-1');
    expect(mockFilesApi.revokeContactAccess).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.accesses()).toHaveLength(0);
    expect(fixture.componentInstance.editorRefreshTrigger()).toBeGreaterThan(0);
  });

  it('revokeAccess() on locked non-markdown file: does not call takeover', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockFilesApi.revokeContactAccess
      .mockReturnValueOnce(throwError(() => ({ status: 423, error: { message: 'Document is locked by another user' } })));

    const fixture = TestBed.createComponent(FileDetailComponent);
    fixture.componentRef.setInput('id', 'f-1');
    fixture.componentInstance.file.set(makeFile({ mime_type: 'text/plain' }));
    const access = makeAccess();
    fixture.componentInstance.accesses.set([access]);

    fixture.componentInstance.revokeAccess(access);

    expect(mockDocsApi.takeover).not.toHaveBeenCalled();
  });
});
