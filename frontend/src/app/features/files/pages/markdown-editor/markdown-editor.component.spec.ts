import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { MarkdownEditorComponent } from './markdown-editor.component';
import { DocumentsApiService } from '../../../../core/api/documents-api.service';
import { DocumentLockService } from '../../services/document-lock.service';
import { ImageAsset } from '../../../../shared/models/api.models';
import type { Editor } from '@tiptap/core';

// Helper: creates a mock editor with controllable spies.
// Each call returns a fresh instance — copy the reference before handing off to the component
// when you need to assert on spy call history.
const createMockEditor = (markdownContent = '# Mock content') => ({
  storage: { markdown: { getMarkdown: vi.fn(() => markdownContent) } },
  isActive: vi.fn(() => false),
  destroy: vi.fn(),
  setEditable: vi.fn(),
  isEmpty: false,
  commands: { setContent: vi.fn() },
  view: {
    state: {
      selection: { from: 0 },
      doc: { nodeAt: vi.fn(() => ({ attrs: { width: null } })) },
      tr: { setNodeMarkup: vi.fn().mockReturnThis() },
    },
    dispatch: vi.fn(),
  },
  chain: vi.fn(() => ({
    focus: vi.fn().mockReturnThis(),
    run: vi.fn(),
    setImage: vi.fn().mockReturnThis(),
    toggleBold: vi.fn().mockReturnThis(),
    toggleHeading: vi.fn().mockReturnThis(),
    updateAttributes: vi.fn().mockReturnThis(),
  })),
}) as unknown as Editor;

// Tiptap requires MutationObserver.takeRecords() which happy-dom doesn't implement.
// We replace only the Editor class; extensions from other @tiptap/* packages stay real.
vi.mock('@tiptap/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tiptap/core')>();
  return {
    ...actual,
    Editor: class MockEditor {
      storage: Record<string, unknown> = {
        markdown: {
          parse: vi.fn(() => ''),
          serialize: vi.fn(() => ''),
          getMarkdown: vi.fn(() => '# Mock content'),
        },
      };
      isActive = vi.fn(() => false);
      destroy = vi.fn();
      setEditable = vi.fn();
      isEmpty = false;
      commands = { setContent: vi.fn() };
      view = {
        state: {
          selection: { from: 0 },
          doc: { nodeAt: vi.fn(() => ({ attrs: { width: null } })) },
          tr: { setNodeMarkup: vi.fn().mockReturnThis() },
        },
        dispatch: vi.fn(),
      };
      chain = vi.fn(() => ({
        focus: vi.fn().mockReturnThis(),
        toggleBold: vi.fn().mockReturnThis(),
        run: vi.fn(),
        setImage: vi.fn().mockReturnThis(),
        toggleHeading: vi.fn().mockReturnThis(),
        updateAttributes: vi.fn().mockReturnThis(),
      }));
    },
  };
});

const makeDocResponse = (docOverrides: Record<string, unknown> = {}) => ({
  result: 'success', message: '',
  data: {
    document: {
      id: 'doc_1',
      fileName: 'notes.md',
      content: '',
      etag: '"abc123"',
      capabilities: { canEdit: true, canInsertImages: false, canTakeOverLock: false },
      lock: null,
      ...docOverrides,
    },
  },
});

describe('MarkdownEditorComponent', () => {
  let fixture: ComponentFixture<MarkdownEditorComponent>;
  let component: MarkdownEditorComponent;
  let docsApiMock: Record<string, ReturnType<typeof vi.fn>>;
  let lockStateSig: ReturnType<typeof signal<string>>;
  let takenOverBySig: ReturnType<typeof signal<string | null>>;

  beforeEach(async () => {
    lockStateSig   = signal<string>('held');
    takenOverBySig = signal<string | null>(null);

    docsApiMock = {
      get:          vi.fn().mockReturnValue(of(makeDocResponse())),
      save:         vi.fn().mockReturnValue(of({ result: 'success', message: '', data: { id: 'doc_1', etag: '"new"', updatedAt: '', updatedBy: null } })),
      acquireLock:  vi.fn().mockReturnValue(of({})),
      releaseLock:  vi.fn().mockReturnValue(of({})),
      heartbeat:    vi.fn().mockReturnValue(of({})),
      getImages:    vi.fn().mockReturnValue(of({ result: 'success', message: '', data: { items: [], nextCursor: null } })),
      updateAccess: vi.fn().mockReturnValue(of({})),
      takeover:     vi.fn().mockReturnValue(of({})),
    };

    const lockServiceMock = {
      lockState:   lockStateSig,
      takenOverBy: takenOverBySig,
      acquire:     vi.fn().mockResolvedValue(true),
      release:     vi.fn(),
      takeover:    vi.fn().mockResolvedValue(true),
      reacquire:   vi.fn().mockResolvedValue(true),
      reset:       vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [MarkdownEditorComponent],
      providers: [
        provideRouter([]),
        { provide: DocumentsApiService, useValue: docsApiMock },
        { provide: DocumentLockService, useValue: lockServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MarkdownEditorComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', 'doc_1');
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should load document on init', () => {
    fixture.detectChanges();
    expect(docsApiMock['get']).toHaveBeenCalledWith('doc_1');
    expect(component.doc()?.fileName).toBe('notes.md');
  });

  it('should display document filename in header', () => {
    fixture.detectChanges();
    const h1 = fixture.nativeElement.querySelector('.md-editor-filename') as HTMLElement;
    expect(h1.textContent?.trim()).toBe('notes.md');
  });

  it('should hide toolbar and save button when lockState is not held', () => {
    lockStateSig.set('readonly');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.md-btn--primary')).toBeNull();
    expect(fixture.nativeElement.querySelector('.md-toolbar')).toBeNull();
  });

  it('should show save button when lockState is held and canEdit is true', () => {
    lockStateSig.set('held');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.md-btn--primary')).toBeTruthy();
  });

  it('canEdit is true only when lockState is held', () => {
    lockStateSig.set('held');
    fixture.detectChanges();
    expect(component.canEdit()).toBe(true);

    lockStateSig.set('readonly');
    fixture.detectChanges();
    expect(component.canEdit()).toBe(false);
  });

  it('should show takeover banner with the name of the user who took over', () => {
    lockStateSig.set('lost_takeover');
    takenOverBySig.set('Мария');
    fixture.detectChanges();
    const banner = fixture.nativeElement.querySelector('.md-banner--warning') as HTMLElement;
    expect(banner).toBeTruthy();
    expect(banner.textContent).toContain('Мария');
  });

  it('should show session-expired banner with a reacquire button', () => {
    lockStateSig.set('lost_expired');
    fixture.detectChanges();
    const banner = fixture.nativeElement.querySelector('.md-banner--info') as HTMLElement;
    expect(banner).toBeTruthy();
    expect(banner.querySelector('.md-banner-action')).toBeTruthy();
  });

  it('should show locked-by-other banner with the locker name', () => {
    docsApiMock['get'].mockReturnValue(of(makeDocResponse({
      lock: { isLocked: true, lockedBy: { name: 'Иван' } },
    })));
    lockStateSig.set('readonly');
    fixture.detectChanges();
    const banners = fixture.nativeElement.querySelectorAll<HTMLElement>('.md-banner--warning');
    const lockedBanner = Array.from(banners).find(b => b.textContent?.includes('Иван'));
    expect(lockedBanner).toBeTruthy();
  });

  it('should navigate to /files when Назад is clicked', () => {
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate');
    const buttons = fixture.nativeElement.querySelectorAll<HTMLButtonElement>('.md-btn');
    const backBtn = Array.from(buttons).find(b => b.textContent?.includes('Назад'));
    backBtn?.click();
    expect(navSpy).toHaveBeenCalledWith(['/files']);
  });

  it('loading is false after successful document load', () => {
    fixture.detectChanges();
    expect(component.loading()).toBe(false);
  });

  it('loading is false and doc is null when get returns an error', () => {
    docsApiMock['get'].mockReturnValue(throwError(() => ({ status: 403 })));
    fixture.detectChanges();
    expect(component.loading()).toBe(false);
    expect(component.doc()).toBeNull();
  });

  // ── save() ──────────────────────────────────────────────────────────────────

  it('save() calls docsApi.save and updates etag on success', () => {
    fixture.detectChanges();
    component.editor = createMockEditor();

    component.save();

    expect(docsApiMock['save']).toHaveBeenCalledWith('doc_1', '# Mock content', '"abc123"');
    expect(component.saveStatus()).toBe('saved');
    expect(component.doc()?.etag).toBe('"new"');
  });

  it('save() with empty content still calls docsApi.save', () => {
    fixture.detectChanges();
    const mockEditor = createMockEditor();
    (mockEditor.storage['markdown'] as { getMarkdown: ReturnType<typeof vi.fn> }).getMarkdown
      .mockReturnValueOnce('');
    component.editor = mockEditor;

    component.save();
    expect(docsApiMock['save']).toHaveBeenCalledWith('doc_1', '', '"abc123"');
  });

  it('save() 409 → sets conflictError and saveStatus error', () => {
    docsApiMock['save'].mockReturnValue(throwError(() => ({ status: 409 })));
    fixture.detectChanges();
    component.editor = createMockEditor();

    component.save();

    expect(component.saveStatus()).toBe('error');
    expect(component.conflictError()).toBe(true);
  });

  it('save() 413 → sets saveStatus to quota', () => {
    docsApiMock['save'].mockReturnValue(throwError(() => ({ status: 413 })));
    fixture.detectChanges();
    component.editor = createMockEditor();

    component.save();

    expect(component.saveStatus()).toBe('quota');
    expect(component.conflictError()).toBe(false);
  });

  it('save() 500 → sets saveStatus to error without conflictError', () => {
    docsApiMock['save'].mockReturnValue(throwError(() => ({ status: 500 })));
    fixture.detectChanges();
    component.editor = createMockEditor();

    component.save();

    expect(component.saveStatus()).toBe('error');
    expect(component.conflictError()).toBe(false);
  });

  // ── onImageSelected ──────────────────────────────────────────────────────────

  it('onImageSelected inserts image using stableUrl, not assetUrl', () => {
    fixture.detectChanges();
    const mockEditor = createMockEditor();
    component.editor = mockEditor;

    const img: ImageAsset = {
      id: 'img_1', fileName: 'photo.png', mimeType: 'image/png', size: 1024,
      previewUrl: 'https://s3.example.com/presigned',
      assetUrl: '/api/v1/files/img_1/content',
      stableUrl: '/api/v1/files/img_1/content',
    };

    component.onImageSelected(img);

    // chain() returns a new object on each call — inspect call history of the spy
    const chainSpy = mockEditor.chain as ReturnType<typeof vi.fn>;
    const firstChainResult = chainSpy.mock.results[0]?.value;
    expect(firstChainResult?.setImage).toHaveBeenCalledWith(
      expect.objectContaining({ src: '/api/v1/files/img_1/content' })
    );
  });

  // ── ngOnDestroy ──────────────────────────────────────────────────────────────

  it('ngOnDestroy releases lock and destroys editor when lock is held', () => {
    fixture.detectChanges();
    component.editor = createMockEditor();

    const lockServiceMock = TestBed.inject(DocumentLockService) as unknown as Record<string, ReturnType<typeof vi.fn>>;
    component.ngOnDestroy();

    expect(lockServiceMock['release']).toHaveBeenCalledWith('doc_1');
    expect(component.editor?.destroy).toHaveBeenCalled();
  });

  // ── Autosave ──────────────────────────────────────────────────────────────────

  it('save() cancels pending autosave timer', () => {
    fixture.detectChanges();
    component.editor = createMockEditor();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (component as any).autoSaveTimer = setTimeout(() => {}, 99999);

    component.save();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((component as any).autoSaveTimer).toBeNull();
  });

  it('ngOnDestroy() cancels pending autosave timer', () => {
    fixture.detectChanges();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (component as any).autoSaveTimer = setTimeout(() => {}, 99999);

    component.ngOnDestroy();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((component as any).autoSaveTimer).toBeNull();
  });

  it('autosave fires docsApi.save after 3 s when unsaved and no conflictError', () => {
    fixture.detectChanges();
    vi.useFakeTimers();
    try {
      component.editor = createMockEditor();
      component.saveStatus.set('unsaved');
      component.conflictError.set(false);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).scheduleAutoSave();
      vi.advanceTimersByTime(3000);

      expect(docsApiMock['save']).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('autosave does not fire when conflictError is true', () => {
    fixture.detectChanges();
    vi.useFakeTimers();
    try {
      component.editor = createMockEditor();
      component.saveStatus.set('unsaved');
      component.conflictError.set(true);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).scheduleAutoSave();
      vi.advanceTimersByTime(3000);

      expect(docsApiMock['save']).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  // ── reacquire / takeover ──────────────────────────────────────────────────────

  it('reacquire() calls lockService.reacquire', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const lockServiceMock = TestBed.inject(DocumentLockService) as unknown as Record<string, ReturnType<typeof vi.fn>>;
    await component.reacquire();

    expect(lockServiceMock['reacquire']).toHaveBeenCalledWith('doc_1');
  });

  it('takeover() calls lockService.takeover', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const lockServiceMock = TestBed.inject(DocumentLockService) as unknown as Record<string, ReturnType<typeof vi.fn>>;
    component.takeover();
    await fixture.whenStable();

    expect(lockServiceMock['takeover']).toHaveBeenCalledWith('doc_1');
  });
});
