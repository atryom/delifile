import { TestBed } from '@angular/core/testing';
import { FoldersTreeComponent } from './folders-tree.component';
import { OrganizationApiService } from '../../../../core/api/organization-api.service';
import { SharedFoldersApiService } from '../../../../core/api/shared-folders-api.service';
import { FilesApiService } from '../../../../core/api/files-api.service';
import { CommentsApiService } from '../../../../core/api/comments-api.service';
import { FileUploadService } from '../../../files/services/file-upload.service';
import { UrlFilesApiService } from '../../../../core/api/url-files-api.service';
import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { ActivatedRoute, Router } from '@angular/router';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

describe('FoldersTreeComponent', () => {
  const mockOrgApi = {
    getTags: vi.fn(() => of({ result: 'success', data: { items: [] } })),
    attachTags: vi.fn(() => of({ result: 'success' })),
    createTag: vi.fn(() => of({ result: 'success', data: { tag: { id: 't-1', name: 'newtag' } } })),
  };
  const mockSfApi = {
    list: vi.fn(() => of({ result: 'success', data: { items: [] } })),
    listAll: vi.fn(() => of({ result: 'success', data: { items: [] } })),
    getSubfolders: vi.fn(() => of({ result: 'success', data: { items: [] } })),
    listFiles: vi.fn(() => of({ result: 'success', data: { items: [], pagination: { page: 1, per_page: 20, total: 0 } } })),
    create: vi.fn(() => of({ result: 'success' })),
    createSubfolder: vi.fn(() => of({ result: 'success' })),
    update: vi.fn(() => of({ result: 'success' })),
    delete: vi.fn(() => of({ result: 'success' })),
    leaveFolder: vi.fn(() => of({ result: 'success' })),
    addFile: vi.fn(() => of({ result: 'success' })),
    removeFile: vi.fn(() => of({ result: 'success' })),
    initUpload: vi.fn(),
    completeUpload: vi.fn(() => of({ result: 'success' })),
    addUrlFile: vi.fn(() => of({ result: 'success' })),
    setFilePrivacy: vi.fn(() => of({ result: 'success' })),
    setFolderPrivacy: vi.fn(() => of({ result: 'success' })),
  };
  const mockFilesApi = {
    list: vi.fn(() => of({ result: 'success', data: { items: [], pagination: { page: 1, per_page: 20, total: 0 } } })),
    download: vi.fn(() => of({ result: 'success', data: { url: 'https://example.com/dl' } })),
    favorite: vi.fn(() => of({ result: 'success' })),
    delete: vi.fn(() => of({ result: 'success' })),
  };
  const mockUploadSvc = {
    state: signal({ phase: 'idle', progress: 0, fileId: null, error: null }),
    upload: vi.fn(() => of('file-1')),
    reset: vi.fn(),
  };
  const mockUrlFilesApi = {
    preview: vi.fn(() => of({ result: 'success', data: { preview: { title: 'Test', image_url: null, site_name: 'test.com' } } })),
    create: vi.fn(() => of({ result: 'success', data: { file: { id: 'file-1' } } })),
  };
  const mockAuthState = {
    plan: signal('free'),
    isAuthenticated: signal(true),
  };
  const mockCommentsApi = {
    getThreads: vi.fn(() => of({ result: 'success', data: { policy: {}, threads: {} } })),
  };
  const mockRouter = { navigate: vi.fn() };
  const translateMock = {
    instant: (k: string) => k,
    get: () => of(''),
    getCurrentLang: () => 'ru',
    onTranslationChange: { subscribe: () => ({ unsubscribe: () => {} }) },
    onLangChange: { subscribe: () => ({ unsubscribe: () => {} }) },
    onFallbackLangChange: { subscribe: () => ({ unsubscribe: () => {} }) },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [FoldersTreeComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: OrganizationApiService, useValue: mockOrgApi },
        { provide: SharedFoldersApiService, useValue: mockSfApi },
        { provide: FilesApiService, useValue: mockFilesApi },
        { provide: FileUploadService, useValue: mockUploadSvc },
        { provide: UrlFilesApiService, useValue: mockUrlFilesApi },
        { provide: AuthStateService, useValue: mockAuthState },
        { provide: CommentsApiService, useValue: mockCommentsApi },
        { provide: Router, useValue: mockRouter },
        { provide: TranslateService, useValue: translateMock },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(FoldersTreeComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should initialize with root breadcrumb', () => {
    const fixture = TestBed.createComponent(FoldersTreeComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.breadcrumbs()).toEqual([{ label: 'Папки', sharedFolderId: null }]);
    expect(fixture.componentInstance.currentSharedFolderId()).toBeNull();
  });

  it('should load shared folders, files and tags on init', () => {
    const fixture = TestBed.createComponent(FoldersTreeComponent);
    fixture.detectChanges();
    expect(mockSfApi.list).toHaveBeenCalled();
    expect(mockFilesApi.list).toHaveBeenCalled();
    expect(mockOrgApi.getTags).toHaveBeenCalled();
  });

  it('should load tags on init', () => {
    const fixture = TestBed.createComponent(FoldersTreeComponent);
    fixture.detectChanges();
    expect(mockOrgApi.getTags).toHaveBeenCalled();
  });

  it('should navigate into shared folder', () => {
    const fixture = TestBed.createComponent(FoldersTreeComponent);
    fixture.componentInstance.navigateIntoSharedFolder({ id: 'sf-1', name: 'Shared', is_owner: true, parent_id: null } as any);
    expect(fixture.componentInstance.currentSharedFolderId()).toBe('sf-1');
    expect(mockSfApi.getSubfolders).toHaveBeenCalledWith('sf-1', undefined);
  });

  it('should toggle file selection', () => {
    const fixture = TestBed.createComponent(FoldersTreeComponent);
    fixture.componentInstance.toggleFileSelection('f-1');
    expect(fixture.componentInstance.selectedFileIds().has('f-1')).toBe(true);
    fixture.componentInstance.toggleFileSelection('f-1');
    expect(fixture.componentInstance.selectedFileIds().has('f-1')).toBe(false);
  });

  it('should toggle all files', () => {
    const fixture = TestBed.createComponent(FoldersTreeComponent);
    fixture.componentInstance.rawFiles.set([{ id: 'f-1' } as any, { id: 'f-2' } as any]);
    fixture.componentInstance.toggleAllFiles();
    expect(fixture.componentInstance.selectedFileIds().size).toBe(2);
    fixture.componentInstance.toggleAllFiles();
    expect(fixture.componentInstance.selectedFileIds().size).toBe(0);
  });

  it('should open and close menu', () => {
    const fixture = TestBed.createComponent(FoldersTreeComponent);
    const event = new MouseEvent('click');
    fixture.componentInstance.toggleMenu('m-1', event);
    expect(fixture.componentInstance.openMenuId()).toBe('m-1');
    fixture.componentInstance.closeMenu();
    expect(fixture.componentInstance.openMenuId()).toBeNull();
  });

  it('should start create folder', () => {
    const fixture = TestBed.createComponent(FoldersTreeComponent);
    const event = new MouseEvent('click');
    vi.spyOn(event, 'stopPropagation');
    fixture.componentInstance.startCreate(event);
    expect(fixture.componentInstance.creating()).toBe(true);
    expect(event.stopPropagation).toHaveBeenCalled();
  });

  it('should start and cancel rename', () => {
    const fixture = TestBed.createComponent(FoldersTreeComponent);
    fixture.componentInstance.startRename('f-1', 'local', 'Old Name');
    expect(fixture.componentInstance.renamingId()).toBe('f-1');
    expect(fixture.componentInstance.renameNameValue).toBe('Old Name');
    fixture.componentInstance.cancelRename();
    expect(fixture.componentInstance.renamingId()).toBeNull();
  });

  it('should confirm and cancel delete', () => {
    const fixture = TestBed.createComponent(FoldersTreeComponent);
    fixture.componentInstance.confirmDeleteSharedFolder({ id: 'sf-1', name: 'Folder' } as any);
    expect(fixture.componentInstance.deleteTarget()).toBeTruthy();
    fixture.componentInstance.cancelDelete();
    expect(fixture.componentInstance.deleteTarget()).toBeNull();
  });

  it('should set filters', () => {
    const fixture = TestBed.createComponent(FoldersTreeComponent);
    fixture.componentInstance.setFilter('favorites');
    expect(fixture.componentInstance.activeFilter()).toBe('favorites');
  });

  it('should set type group', () => {
    const fixture = TestBed.createComponent(FoldersTreeComponent);
    fixture.componentInstance.setTypeGroup('image');
    expect(fixture.componentInstance.activeTypeGroup()).toBe('image');
    fixture.componentInstance.setTypeGroup('image');
    expect(fixture.componentInstance.activeTypeGroup()).toBe('');
  });

  it('should paginate', () => {
    const fixture = TestBed.createComponent(FoldersTreeComponent);
    fixture.componentInstance.page.set(1);
    fixture.componentInstance.totalPages.set(3);
    fixture.componentInstance.goToPage(2);
    expect(fixture.componentInstance.page()).toBe(2);
  });

  it('should create shared folder', () => {
    const fixture = TestBed.createComponent(FoldersTreeComponent);
    fixture.componentInstance.createNameValue = 'New Folder';
    fixture.componentInstance.saveCreate();
    expect(mockSfApi.create).toHaveBeenCalled();
  });

  it('should open access dialog', () => {
    const fixture = TestBed.createComponent(FoldersTreeComponent);
    fixture.componentInstance.openAccessDialog({ id: 'sf-1', name: 'Shared' } as any);
    expect(fixture.componentInstance.sfAccessFolderId()).toBe('sf-1');
    fixture.componentInstance.closeAccessDialog();
    expect(fixture.componentInstance.sfAccessFolderId()).toBeNull();
  });

  it('should compute shared folder ownership', () => {
    const fixture = TestBed.createComponent(FoldersTreeComponent);
    fixture.componentInstance.sharedFolders.set([{ id: 'sf-1', is_owner: true } as any]);
    fixture.componentInstance.currentSharedFolderId.set('sf-1');
    expect(fixture.componentInstance.isSharedFolderOwner()).toBe(true);
  });

  it('should open and close add modal', () => {
    const fixture = TestBed.createComponent(FoldersTreeComponent);
    fixture.componentInstance.openAddModal();
    expect(fixture.componentInstance.addModalOpen()).toBe(true);
    fixture.componentInstance.closeAddModal();
    expect(fixture.componentInstance.addModalOpen()).toBe(false);
  });

  it('should confirm and execute leave', () => {
    const fixture = TestBed.createComponent(FoldersTreeComponent);
    fixture.componentInstance.confirmLeaveSharedFolder({ id: 'sf-1', name: 'Shared' } as any);
    expect(fixture.componentInstance.leaveTarget()).toBeTruthy();
    fixture.componentInstance.executeLeave();
    expect(mockSfApi.leaveFolder).toHaveBeenCalledWith('sf-1');
  });

  it('should download file', () => {
    const fixture = TestBed.createComponent(FoldersTreeComponent);
    fixture.componentInstance.downloadFile({ id: 'f-1', original_name: 'doc.txt', content_kind: 'file', mime_type: 'text/plain' } as any);
    expect(mockFilesApi.download).toHaveBeenCalledWith('f-1');
  });

  it('should open URL file in new window', () => {
    const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
    const fixture = TestBed.createComponent(FoldersTreeComponent);
    fixture.componentInstance.downloadFile({ id: 'f-1', content_kind: 'url_file', link_url: 'https://example.com' } as any);
    expect(windowOpen).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener');
    windowOpen.mockRestore();
  });

  it('should format size', () => {
    const fixture = TestBed.createComponent(FoldersTreeComponent);
    expect(fixture.componentInstance.formatSize(0)).toBe('—');
    expect(fixture.componentInstance.formatSize(1024)).toContain('КБ');
  });

  it('should return file icon type', () => {
    const fixture = TestBed.createComponent(FoldersTreeComponent);
    expect(fixture.componentInstance.fileIconType({ content_kind: 'url_file' } as any)).toBe('link');
    expect(fixture.componentInstance.fileIconType({ content_kind: 'file', mime_type: 'image/png' } as any)).toBe('image');
    expect(fixture.componentInstance.fileIconType({ content_kind: 'file', mime_type: 'video/mp4' } as any)).toBe('video');
  });

  it('should get file display name', () => {
    const fixture = TestBed.createComponent(FoldersTreeComponent);
    expect(fixture.componentInstance.fileDisplayName({ content_kind: 'url_file', link_title: 'My Link', original_name: 'https://x.com' } as any)).toBe('My Link');
    expect(fixture.componentInstance.fileDisplayName({ content_kind: 'file', display_name: 'Display', original_name: 'doc.pdf' } as any)).toBe('Display');
    expect(fixture.componentInstance.fileDisplayName({ content_kind: 'file', display_name: null, original_name: 'doc.pdf' } as any)).toBe('doc.pdf');
  });

  it('should preview link', () => {
    const fixture = TestBed.createComponent(FoldersTreeComponent);
    fixture.componentInstance.linkForm.setValue({ url: 'https://example.com' });
    fixture.componentInstance.previewLink();
    expect(mockUrlFilesApi.preview).toHaveBeenCalledWith('https://example.com');
  });

  it('should save link at root level', () => {
    const fixture = TestBed.createComponent(FoldersTreeComponent);
    fixture.componentInstance.linkForm.setValue({ url: 'https://example.com' });
    fixture.componentInstance.saveLink();
    expect(mockUrlFilesApi.create).toHaveBeenCalledWith('https://example.com');
  });

  it('should save link inside shared folder', () => {
    const fixture = TestBed.createComponent(FoldersTreeComponent);
    fixture.componentInstance.currentSharedFolderId.set('sf-1');
    fixture.componentInstance.linkForm.setValue({ url: 'https://example.com' });
    fixture.componentInstance.saveLink();
    expect(mockSfApi.addUrlFile).toHaveBeenCalledWith('sf-1', 'https://example.com', null);
  });

  it('should favorite file', () => {
    const fixture = TestBed.createComponent(FoldersTreeComponent);
    fixture.componentInstance.favoriteFile({ id: 'f-1' } as any);
    expect(mockFilesApi.favorite).toHaveBeenCalledWith('f-1');
  });

  it('should toggle all files when all selected', () => {
    const fixture = TestBed.createComponent(FoldersTreeComponent);
    fixture.componentInstance.rawFiles.set([{ id: 'f-1' } as any, { id: 'f-2' } as any]);
    fixture.componentInstance.selectedFileIds.set(new Set(['f-1', 'f-2']));
    expect(fixture.componentInstance.allFilesSelected()).toBe(true);
    fixture.componentInstance.toggleAllFiles();
    expect(fixture.componentInstance.selectedFileIds().size).toBe(0);
  });

  // ── filteredSharedFolders in tasks mode ───────────────────────────────────

  it('filteredSharedFolders shows only folders with tasks_count > 0 in tasks mode', () => {
    const fixture = TestBed.createComponent(FoldersTreeComponent);
    fixture.componentInstance.viewMode.set('tasks');
    fixture.componentInstance.sharedFolders.set([
      { id: 'sf-1', name: 'HasTasks', tasks_count: 3 } as any,
      { id: 'sf-2', name: 'NoTasks', tasks_count: 0 } as any,
      { id: 'sf-3', name: 'NullTasks' } as any,
    ]);
    const result = fixture.componentInstance.filteredSharedFolders();
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('sf-1');
  });

  it('filteredSharedFolders shows all folders in table mode', () => {
    const fixture = TestBed.createComponent(FoldersTreeComponent);
    fixture.componentInstance.viewMode.set('table');
    fixture.componentInstance.sharedFolders.set([
      { id: 'sf-1', name: 'HasTasks', tasks_count: 3 } as any,
      { id: 'sf-2', name: 'NoTasks', tasks_count: 0 } as any,
    ]);
    const result = fixture.componentInstance.filteredSharedFolders();
    expect(result.length).toBe(2);
  });

  // ── loadSfSubfolders passes task filters ──────────────────────────────────

  it('navigateIntoSharedFolder in tasks mode passes taskFilters object to getSubfolders', () => {
    const fixture = TestBed.createComponent(FoldersTreeComponent);
    // navigateIntoSharedFolder resets filters before calling loadSfSubfolders,
    // so the filters object will have undefined values (empty signals -> || undefined)
    fixture.componentInstance.viewMode.set('tasks');

    fixture.componentInstance.navigateIntoSharedFolder({ id: 'sf-2', name: 'Folder', is_owner: true, parent_id: null } as any);

    // In tasks mode, loadSfSubfolders passes a filters object (not undefined)
    const call = (mockSfApi.getSubfolders as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe('sf-2');
    expect(call[1]).toBeTypeOf('object');
    expect(call[1]).not.toBeNull();
  });

  it('navigateIntoSharedFolder in table mode passes undefined to getSubfolders', () => {
    const fixture = TestBed.createComponent(FoldersTreeComponent);
    fixture.componentInstance.viewMode.set('table');

    fixture.componentInstance.navigateIntoSharedFolder({ id: 'sf-3', name: 'Folder', is_owner: true, parent_id: null } as any);

    expect(mockSfApi.getSubfolders).toHaveBeenCalledWith('sf-3', undefined);
  });

  // ── onTaskFilterChange reloads subfolders when inside a folder ────────────

  it('onTaskFilterChange inside a shared folder in tasks mode calls getSubfolders', () => {
    const fixture = TestBed.createComponent(FoldersTreeComponent);
    fixture.componentInstance.viewMode.set('tasks');
    fixture.componentInstance.currentSharedFolderId.set('sf-4');
    vi.clearAllMocks();

    fixture.componentInstance.onTaskFilterChange();

    expect(mockSfApi.getSubfolders).toHaveBeenCalledWith('sf-4', expect.objectContaining({}));
  });

  it('onTaskFilterChange at root does NOT call getSubfolders', () => {
    const fixture = TestBed.createComponent(FoldersTreeComponent);
    fixture.componentInstance.currentSharedFolderId.set(null);
    vi.clearAllMocks();

    fixture.componentInstance.onTaskFilterChange();

    expect(mockSfApi.getSubfolders).not.toHaveBeenCalled();
  });
});
