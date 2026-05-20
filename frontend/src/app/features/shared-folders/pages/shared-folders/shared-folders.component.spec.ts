import { TestBed } from '@angular/core/testing';
import { SharedFoldersComponent } from './shared-folders.component';
import { SharedFoldersApiService } from '../../../../core/api/shared-folders-api.service';
import { FilesApiService } from '../../../../core/api/files-api.service';
import { UrlFilesApiService } from '../../../../core/api/url-files-api.service';
import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { VideoThumbnailService } from '../../../files/services/video-thumbnail.service';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClientTestingModule, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { signal } from '@angular/core';
import { of } from 'rxjs';

describe('SharedFoldersComponent', () => {
  const mockSfApi = {
    list: vi.fn(() => of({ result: 'success', data: { items: [] } })),
    getSubfolders: vi.fn(() => of({ result: 'success', data: { items: [] } })),
    createSubfolder: vi.fn(() => of({ result: 'success', data: { folder: { id: 'sub-1', name: 'Sub' } } })),
    listFiles: vi.fn(() => of({ result: 'success', data: { items: [], pagination: { page: 1, per_page: 20, total: 0 } } })),
    initUpload: vi.fn(),
    completeUpload: vi.fn(() => of({ result: 'success' })),
    addUrlFile: vi.fn(() => of({ result: 'success' })),
    leaveFolder: vi.fn(() => of({ result: 'success' })),
  };
  const mockFilesApi = {
    download: vi.fn(() => of({ result: 'success', data: { url: 'https://example.com/dl' } })),
  };
  const mockUrlFilesApi = {
    preview: vi.fn(() => of({ result: 'success', data: { preview: { title: 'Test', image_url: null, site_name: 'test.com' } } })),
  };
  const mockAuthState = {
    plan: signal('free'),
  };
  const mockThumbnailSvc = {
    generateFromFile: vi.fn(() => Promise.resolve(null)),
  };

  const mockRouter = { navigate: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [SharedFoldersComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SharedFoldersApiService, useValue: mockSfApi },
        { provide: FilesApiService, useValue: mockFilesApi },
        { provide: UrlFilesApiService, useValue: mockUrlFilesApi },
        { provide: AuthStateService, useValue: mockAuthState },
        { provide: VideoThumbnailService, useValue: mockThumbnailSvc },
        { provide: TranslateService, useValue: { instant: (k: string) => k, get: () => of(''), getCurrentLang: () => 'ru', getParsedResult: (key: string) => key, onTranslationChange: { subscribe: () => ({ unsubscribe: () => {} }) }, onLangChange: { subscribe: () => ({ unsubscribe: () => {} }) }, onFallbackLangChange: { subscribe: () => ({ unsubscribe: () => {} }) } } },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(SharedFoldersComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should load folders on init', () => {
    const fixture = TestBed.createComponent(SharedFoldersComponent);
    fixture.detectChanges();
    expect(mockSfApi.list).toHaveBeenCalled();
  });

  it('should select folder', () => {
    const fixture = TestBed.createComponent(SharedFoldersComponent);
    fixture.componentInstance.selectFolder({ id: 'sf-1', name: 'Test', is_owner: true, my_access_type: 'edit', parent_id: null } as any);
    expect(fixture.componentInstance.selectedFolder()).toBeTruthy();
    expect(mockSfApi.listFiles).toHaveBeenCalledWith('sf-1', 1);
    expect(mockSfApi.getSubfolders).toHaveBeenCalledWith('sf-1');
  });

  it('should navigate to subfolder', () => {
    const fixture = TestBed.createComponent(SharedFoldersComponent);
    fixture.detectChanges();
    fixture.componentInstance.breadcrumb.set([{ id: 'sf-1', name: 'Root' } as any]);
    fixture.componentInstance.navigateToSubfolder({ id: 'sub-1', name: 'Sub', is_owner: false, my_access_type: 'view', parent_id: 'sf-1' } as any);
    expect(fixture.componentInstance.selectedFolder()?.id).toBe('sub-1');
    expect(fixture.componentInstance.breadcrumb().length).toBe(2);
  });

  it('should navigate breadcrumb', () => {
    const fixture = TestBed.createComponent(SharedFoldersComponent);
    fixture.componentInstance.breadcrumb.set([
      { id: 'root', name: 'Root', is_owner: true, my_access_type: 'edit', parent_id: null } as any,
      { id: 'sub', name: 'Sub', is_owner: false, my_access_type: 'view', parent_id: 'root' } as any,
    ]);
    fixture.componentInstance.selectedFolder.set(fixture.componentInstance.breadcrumb()[1]);
    fixture.componentInstance.navigateBreadcrumb(0);
    expect(fixture.componentInstance.selectedFolder()?.id).toBe('root');
    expect(fixture.componentInstance.breadcrumb().length).toBe(1);
  });

  it('should create subfolder', () => {
    const fixture = TestBed.createComponent(SharedFoldersComponent);
    fixture.componentInstance.selectedFolder.set({ id: 'sf-1', name: 'Root' } as any);
    fixture.componentInstance.newSubfolderName.set('New Sub');
    fixture.componentInstance.createSubfolder();
    expect(mockSfApi.createSubfolder).toHaveBeenCalledWith('sf-1', 'New Sub');
  });

  it('should handle folder select', () => {
    const fixture = TestBed.createComponent(SharedFoldersComponent);
    fixture.componentInstance.folders.set([{ id: 'sf-1', name: 'Test', is_owner: true, my_access_type: 'edit', parent_id: null } as any]);
    const event = { target: { value: 'sf-1' } } as any;
    fixture.componentInstance.onFolderSelect(event);
    expect(fixture.componentInstance.selectedFolder()).toBeTruthy();
  });

  it('should load files on page change', () => {
    const fixture = TestBed.createComponent(SharedFoldersComponent);
    fixture.componentInstance.selectedFolder.set({ id: 'sf-1' } as any);
    fixture.componentInstance.page.set(1);
    fixture.componentInstance.totalPages.set(3);
    fixture.componentInstance.nextPage();
    expect(fixture.componentInstance.page()).toBe(2);
    fixture.componentInstance.prevPage();
    expect(fixture.componentInstance.page()).toBe(1);
  });

  it('should toggle upload', () => {
    const fixture = TestBed.createComponent(SharedFoldersComponent);
    expect(fixture.componentInstance.uploadExpanded()).toBe(false);
    fixture.componentInstance.toggleUpload();
    expect(fixture.componentInstance.uploadExpanded()).toBe(true);
  });

  it('should handle drag events', () => {
    const fixture = TestBed.createComponent(SharedFoldersComponent);
    fixture.componentInstance.onDragOver({ preventDefault: vi.fn() } as any);
    expect(fixture.componentInstance.isDragOver()).toBe(true);
    fixture.componentInstance.onDragLeave();
    expect(fixture.componentInstance.isDragOver()).toBe(false);
  });

  it('should open and close access dialog', () => {
    const fixture = TestBed.createComponent(SharedFoldersComponent);
    fixture.componentInstance.openAccessDialog();
    expect(fixture.componentInstance.accessDialogOpen()).toBe(true);
    fixture.componentInstance.closeAccessDialog();
    expect(fixture.componentInstance.accessDialogOpen()).toBe(false);
  });

  it('should open and close leave dialog', () => {
    const fixture = TestBed.createComponent(SharedFoldersComponent);
    fixture.componentInstance.openLeaveDialog();
    expect(fixture.componentInstance.leaveDialogOpen()).toBe(true);
    fixture.componentInstance.closeLeaveDialog();
    expect(fixture.componentInstance.leaveDialogOpen()).toBe(false);
  });

  it('should confirm leave', () => {
    const fixture = TestBed.createComponent(SharedFoldersComponent);
    fixture.componentInstance.selectedFolder.set({ id: 'sf-1' } as any);
    fixture.componentInstance.confirmLeave();
    expect(mockSfApi.leaveFolder).toHaveBeenCalledWith('sf-1');
  });

  it('should preview link', () => {
    const fixture = TestBed.createComponent(SharedFoldersComponent);
    fixture.componentInstance.linkForm.setValue({ url: 'https://example.com' });
    fixture.componentInstance.previewLink();
    expect(mockUrlFilesApi.preview).toHaveBeenCalledWith('https://example.com');
  });

  it('should save link', () => {
    const fixture = TestBed.createComponent(SharedFoldersComponent);
    fixture.componentInstance.selectedFolder.set({ id: 'sf-1' } as any);
    fixture.componentInstance.linkForm.setValue({ url: 'https://example.com' });
    fixture.componentInstance.saveLink();
    expect(mockSfApi.addUrlFile).toHaveBeenCalledWith('sf-1', 'https://example.com', null);
  });

  it('should download file', () => {
    const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
    const fixture = TestBed.createComponent(SharedFoldersComponent);
    fixture.componentInstance.downloadFile('file-1');
    expect(mockFilesApi.download).toHaveBeenCalledWith('file-1');
    windowOpen.mockRestore();
  });

  it('should compute canEdit', () => {
    const fixture = TestBed.createComponent(SharedFoldersComponent);
    expect(fixture.componentInstance.canEdit()).toBe(false);
    fixture.componentInstance.selectedFolder.set({ id: 'sf-1', is_owner: true, my_access_type: 'edit' } as any);
    expect(fixture.componentInstance.canEdit()).toBe(true);
  });

  it('should open create subfolder form', () => {
    const fixture = TestBed.createComponent(SharedFoldersComponent);
    fixture.componentInstance.openCreateSubfolderForm();
    expect(fixture.componentInstance.showCreateSubfolder()).toBe(true);
  });

  it('should reset upload state', () => {
    const fixture = TestBed.createComponent(SharedFoldersComponent);
    fixture.componentInstance.resetUpload();
    expect(fixture.componentInstance.uploadState().phase).toBe('idle');
    expect(fixture.componentInstance.uploadState().progress).toBe(0);
  });

  it('should check view in browser', () => {
    const fixture = TestBed.createComponent(SharedFoldersComponent);
    expect(fixture.componentInstance.canViewInBrowser({
      content_kind: 'file', mime_type: 'image/png', view_url: 'https://example.com/view',
    } as any)).toBe(true);
    expect(fixture.componentInstance.canViewInBrowser({
      content_kind: 'url_file', mime_type: 'image/png', view_url: 'https://example.com/view',
    } as any)).toBe(false);
  });

  it('should return file detail link', () => {
    const fixture = TestBed.createComponent(SharedFoldersComponent);
    const result = fixture.componentInstance.fileDetailLink('file-1');
    expect(result).toEqual(['/files', 'file-1']);
  });

  it('should return file detail query params', () => {
    const fixture = TestBed.createComponent(SharedFoldersComponent);
    fixture.componentInstance.selectedFolder.set({ id: 'sf-1' } as any);
    const result = fixture.componentInstance.fileDetailQueryParams();
    expect(result).toEqual({ from: 'shared-folder', folder_id: 'sf-1' });
  });
});
