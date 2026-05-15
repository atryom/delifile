import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { provideTranslateService } from '@ngx-translate/core';
import { FileListComponent } from './file-list.component';
import { FilesApiService } from '../../../../core/api/files-api.service';
import { FileUploadService, UploadState } from '../../services/file-upload.service';
import { UrlFilesApiService } from '../../../../core/api/url-files-api.service';

describe('FileListComponent', () => {
  const mockFilesApi = {
    list: vi.fn(),
    get: vi.fn(),
    updateDescription: vi.fn(),
  };
  const mockUrlFilesApi = {
    preview: vi.fn(),
    create: vi.fn(),
  };
  const mockUploadState = signal<UploadState>({
    phase: 'idle', progress: 0, fileId: null, error: null,
  });
  const mockUploadService = {
    state: mockUploadState.asReadonly(),
    upload: vi.fn(),
    cancel: vi.fn(),
    reset: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [FileListComponent],
      providers: [
        provideTranslateService(),
        { provide: FilesApiService, useValue: mockFilesApi },
        { provide: FileUploadService, useValue: mockUploadService },
        { provide: UrlFilesApiService, useValue: mockUrlFilesApi },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
      ],
    }).compileComponents();
  });

  // ─── Creation & Init ────────────────────────────────────────────────────

  it('should create', () => {
    mockFilesApi.list.mockReturnValue(of({ data: { items: [] } }));
    const fixture = TestBed.createComponent(FileListComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should load recent files on init', () => {
    mockFilesApi.list.mockReturnValue(of({ data: { items: [] } }));
    const fixture = TestBed.createComponent(FileListComponent);
    fixture.detectChanges();

    expect(mockFilesApi.list).toHaveBeenCalledWith('all', 1, undefined, {
      sort_by: 'date', sort_order: 'desc', per_page: 10,
    });
  });

  // ─── Recent Files Display ───────────────────────────────────────────────

  it('should show loading state for recent files', () => {
    mockFilesApi.list.mockReturnValue(of({ data: { items: [] } }));
    const fixture = TestBed.createComponent(FileListComponent);
    fixture.detectChanges(); // triggers ngOnInit (loads files → recentLoading becomes false)
    fixture.componentInstance.recentLoading.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Загрузка...');
  });

  it('should show empty state when no recent files', () => {
    mockFilesApi.list.mockReturnValue(of({ data: { items: [] } }));
    const fixture = TestBed.createComponent(FileListComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Нет файлов');
  });

  it('should display recent files list', () => {
    mockFilesApi.list.mockReturnValue(of({
      data: {
        items: [
          { id: '1', original_name: 'test.pdf', size: 1024, mime_type: 'application/pdf', content_kind: 'binary_file', status: 'available', uploaded_at: '2025-01-15T10:00:00Z' },
          { id: '2', original_name: 'photo.jpg', size: 2048, mime_type: 'image/jpeg', content_kind: 'binary_file', status: 'available', uploaded_at: '2025-01-14T10:00:00Z' },
        ] as any[],
      },
    }));
    const fixture = TestBed.createComponent(FileListComponent);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('test.pdf');
    expect(el.textContent).toContain('photo.jpg');
  });

  // ─── formatSize helper ──────────────────────────────────────────────────

  it('should format size in bytes', () => {
    mockFilesApi.list.mockReturnValue(of({ data: { items: [] } }));
    const fixture = TestBed.createComponent(FileListComponent);
    expect(fixture.componentInstance.formatSize(500)).toBe('500 B');
    expect(fixture.componentInstance.formatSize(2048)).toBe('2.0 KB');
    expect(fixture.componentInstance.formatSize(1048576)).toBe('1.0 MB');
    expect(fixture.componentInstance.formatSize(1073741824)).toBe('1.0 GB');
  });

  // ─── Link Form ──────────────────────────────────────────────────────────

  it('should validate link url as required', () => {
    mockFilesApi.list.mockReturnValue(of({ data: { items: [] } }));
    const fixture = TestBed.createComponent(FileListComponent);
    const url = fixture.componentInstance.linkForm.get('url');
    url?.setValue('');
    expect(url?.valid).toBe(false);
    expect(url?.errors?.['required']).toBe(true);
  });

  it('should validate link url pattern', () => {
    mockFilesApi.list.mockReturnValue(of({ data: { items: [] } }));
    const fixture = TestBed.createComponent(FileListComponent);
    const url = fixture.componentInstance.linkForm.get('url');
    url?.setValue('not-a-url');
    expect(url?.valid).toBe(false);
    expect(url?.errors?.['pattern']).toBeTruthy();
  });

  it('should accept valid http url', () => {
    mockFilesApi.list.mockReturnValue(of({ data: { items: [] } }));
    const fixture = TestBed.createComponent(FileListComponent);
    const url = fixture.componentInstance.linkForm.get('url');
    url?.setValue('https://example.com');
    expect(url?.valid).toBe(true);
  });

  // ─── Link Preview ───────────────────────────────────────────────────────

  it('should set link preview on successful preview', () => {
    mockFilesApi.list.mockReturnValue(of({ data: { items: [] } }));
    mockUrlFilesApi.preview.mockReturnValue(of({
      data: { preview: { title: 'Example', description: 'A site', image_url: null, site_name: 'Example.com', hostname: 'example.com' } },
    }));

    const fixture = TestBed.createComponent(FileListComponent);
    fixture.componentInstance.linkForm.setValue({ url: 'https://example.com' });
    fixture.componentInstance.previewLink();

    expect(mockUrlFilesApi.preview).toHaveBeenCalledWith('https://example.com');
    expect(fixture.componentInstance.linkPreview()?.title).toBe('Example');
    expect(fixture.componentInstance.previewing()).toBe(false);
  });

  it('should set link error on failed preview', () => {
    mockFilesApi.list.mockReturnValue(of({ data: { items: [] } }));
    mockUrlFilesApi.preview.mockReturnValue(throwError(() => ({})));

    const fixture = TestBed.createComponent(FileListComponent);
    fixture.componentInstance.linkForm.setValue({ url: 'https://example.com' });
    fixture.componentInstance.previewLink();

    expect(fixture.componentInstance.linkError()).toBe('Не удалось получить превью');
    expect(fixture.componentInstance.previewing()).toBe(false);
  });

  // ─── Save Link ──────────────────────────────────────────────────────────

  it('should save link', () => {
    mockFilesApi.list.mockReturnValue(of({ data: { items: [] } }));
    mockUrlFilesApi.create.mockReturnValue(of({
      data: { file: { id: 'new-1', original_name: 'Example', description: '' } },
    }));

    const fixture = TestBed.createComponent(FileListComponent);
    fixture.componentInstance.linkForm.setValue({ url: 'https://example.com' });
    fixture.componentInstance.saveLink();

    expect(mockUrlFilesApi.create).toHaveBeenCalledWith('https://example.com');
    expect(fixture.componentInstance.newlyAddedFile()).toBeTruthy();
    expect(fixture.componentInstance.linkForm.get('url')?.value).toBeNull();
  });

  it('should not save link when form is invalid', () => {
    mockFilesApi.list.mockReturnValue(of({ data: { items: [] } }));
    const fixture = TestBed.createComponent(FileListComponent);
    fixture.componentInstance.saveLink();

    expect(mockUrlFilesApi.create).not.toHaveBeenCalled();
  });

  it('should set link error on save failure', () => {
    mockFilesApi.list.mockReturnValue(of({ data: { items: [] } }));
    mockUrlFilesApi.create.mockReturnValue(throwError(() => ({
      message: 'Link save failed',
    })));

    const fixture = TestBed.createComponent(FileListComponent);
    fixture.componentInstance.linkForm.setValue({ url: 'https://example.com' });
    fixture.componentInstance.saveLink();

    expect(fixture.componentInstance.linkError()).toBe('Link save failed');
  });

  // ─── Newly Added File ───────────────────────────────────────────────────

  it('should dismiss newly added file', () => {
    mockFilesApi.list.mockReturnValue(of({ data: { items: [] } }));
    const fixture = TestBed.createComponent(FileListComponent);
    fixture.componentInstance.newlyAddedFile.set({ id: '1' } as any);
    fixture.componentInstance.dismissNewlyAdded();
    expect(fixture.componentInstance.newlyAddedFile()).toBeNull();
  });

  it('should save description for newly added file', () => {
    mockFilesApi.list.mockReturnValue(of({ data: { items: [] } }));
    mockFilesApi.updateDescription.mockReturnValue(of({}));

    const fixture = TestBed.createComponent(FileListComponent);
    fixture.componentInstance.newlyAddedFile.set({ id: 'f1' } as any);
    fixture.componentInstance.newFileDescription = 'New desc';
    fixture.componentInstance.saveDescription();

    expect(mockFilesApi.updateDescription).toHaveBeenCalledWith('f1', 'New desc');
  });

  it('should not save description when no file', () => {
    mockFilesApi.list.mockReturnValue(of({ data: { items: [] } }));
    const fixture = TestBed.createComponent(FileListComponent);
    fixture.componentInstance.saveDescription();
    expect(mockFilesApi.updateDescription).not.toHaveBeenCalled();
  });

  // ─── Upload ─────────────────────────────────────────────────────────────

  it('should call uploadService.upload on file selected', () => {
    mockFilesApi.list.mockReturnValue(of({ data: { items: [] } }));
    mockUploadService.upload.mockReturnValue(of('file-id'));

    const fixture = TestBed.createComponent(FileListComponent);
    const file = new File(['content'], 'test.txt', { type: 'text/plain' });
    const event = { target: { files: [file] } } as unknown as Event;
    fixture.componentInstance.onFileSelected(event);

    expect(mockUploadService.upload).toHaveBeenCalledWith(file);
  });

  it('should handle drag and drop', () => {
    mockFilesApi.list.mockReturnValue(of({ data: { items: [] } }));
    mockUploadService.upload.mockReturnValue(of('file-id'));

    const fixture = TestBed.createComponent(FileListComponent);
    const file = new File(['c'], 'drop.txt', { type: 'text/plain' });
    const dragEvent = { preventDefault: vi.fn(), dataTransfer: { files: [file] } } as unknown as DragEvent;
    fixture.componentInstance.onDragOver(dragEvent);
    expect(fixture.componentInstance.isDragOver()).toBe(true);

    fixture.componentInstance.onDrop(dragEvent);
    expect(mockUploadService.upload).toHaveBeenCalledWith(file);
    expect(fixture.componentInstance.isDragOver()).toBe(false);
  });

  it('should cancel upload', () => {
    mockFilesApi.list.mockReturnValue(of({ data: { items: [] } }));
    const fixture = TestBed.createComponent(FileListComponent);

    mockUploadState.set({
      phase: 'uploading', progress: 50, fileId: 'f1', error: null,
    });
    fixture.componentInstance.cancelUpload();

    expect(mockUploadService.cancel).toHaveBeenCalledWith('f1');
  });

  it('should reset upload', () => {
    mockFilesApi.list.mockReturnValue(of({ data: { items: [] } }));
    const fixture = TestBed.createComponent(FileListComponent);
    fixture.componentInstance.resetUpload();
    expect(mockUploadService.reset).toHaveBeenCalled();
  });

  // ─── Upload Progress Display ────────────────────────────────────────────

  it('should show upload progress card when uploading', () => {
    mockFilesApi.list.mockReturnValue(of({ data: { items: [] } }));
    const fixture = TestBed.createComponent(FileListComponent);
    mockUploadState.set({
      phase: 'uploading', progress: 45, fileId: 'f1', error: null,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('45%');
  });

  it('should show upload error card', () => {
    mockFilesApi.list.mockReturnValue(of({ data: { items: [] } }));
    const fixture = TestBed.createComponent(FileListComponent);
    mockUploadState.set({
      phase: 'error', progress: 0, fileId: null, error: 'Upload failed',
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Upload failed');
  });
});
