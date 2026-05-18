import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { MarkdownEditorPanelComponent } from './markdown-editor-panel.component';
import { DocumentsApiService } from '../../../../core/api/documents-api.service';
import { DocumentLockService } from '../../services/document-lock.service';
import { ImageAsset } from '../../../../shared/models/api.models';
import type { Editor } from '@tiptap/core';

const createMockEditor = (markdownContent = '# Panel content') => ({
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

vi.mock('@tiptap/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tiptap/core')>();
  return {
    ...actual,
    Editor: class MockEditor {
      storage: Record<string, unknown> = {
        markdown: {
          parse: vi.fn(() => ''),
          serialize: vi.fn(() => ''),
          getMarkdown: vi.fn(() => '# Panel content'),
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
        run: vi.fn(),
        setImage: vi.fn().mockReturnThis(),
        toggleBold: vi.fn().mockReturnThis(),
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
      lock: { isLocked: false },
      ...docOverrides,
    },
  },
});

const makeSaveResponse = () => ({
  result: 'success', message: '',
  data: { id: 'doc_1', etag: '"new_etag"', updatedAt: '2026-01-01T00:00:00Z', updatedBy: null },
});

describe('MarkdownEditorPanelComponent', () => {
  let fixture: ComponentFixture<MarkdownEditorPanelComponent>;
  let component: MarkdownEditorPanelComponent;
  let docsApiMock: Record<string, ReturnType<typeof vi.fn>>;
  let lockStateSig: ReturnType<typeof signal<string>>;
  let takenOverBySig: ReturnType<typeof signal<string | null>>;
  let lockServiceMock: Record<string, unknown>;

  beforeEach(async () => {
    lockStateSig   = signal<string>('held');
    takenOverBySig = signal<string | null>(null);

    docsApiMock = {
      get:         vi.fn().mockReturnValue(of(makeDocResponse())),
      save:        vi.fn().mockReturnValue(of(makeSaveResponse())),
      acquireLock: vi.fn().mockReturnValue(of({})),
      releaseLock: vi.fn().mockReturnValue(of({})),
      heartbeat:   vi.fn().mockReturnValue(of({})),
      getImages:   vi.fn().mockReturnValue(of({ result: 'success', message: '', data: { items: [], nextCursor: null } })),
      takeover:    vi.fn().mockReturnValue(of({})),
    };

    lockServiceMock = {
      lockState:   lockStateSig,
      takenOverBy: takenOverBySig,
      acquire:     vi.fn().mockResolvedValue(true),
      release:     vi.fn(),
      takeover:    vi.fn().mockResolvedValue(true),
      reacquire:   vi.fn().mockResolvedValue(true),
      reset:       vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [MarkdownEditorPanelComponent],
      providers: [
        { provide: DocumentsApiService, useValue: docsApiMock },
        { provide: DocumentLockService, useValue: lockServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MarkdownEditorPanelComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('fileId', 'doc_1');
    fixture.componentRef.setInput('expanded', false);
  });

  // ── Mounting ────────────────────────────────────────────────────────────────

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should load document on init using fileId input', () => {
    fixture.detectChanges();
    expect(docsApiMock['get']).toHaveBeenCalledWith('doc_1');
    expect(component.doc()?.fileName).toBe('notes.md');
  });

  it('loading is false after document loads', () => {
    fixture.detectChanges();
    expect(component.loading()).toBe(false);
  });

  it('loading is false when get returns an error', () => {
    docsApiMock['get'].mockReturnValue(throwError(() => ({ status: 403 })));
    fixture.detectChanges();
    expect(component.loading()).toBe(false);
    expect(component.doc()).toBeNull();
  });

  // ── Header bar ──────────────────────────────────────────────────────────────

  it('should display document filename in bar', () => {
    fixture.detectChanges();
    const title = fixture.nativeElement.querySelector('.ep-title') as HTMLElement;
    expect(title.textContent?.trim()).toBe('notes.md');
  });

  it('should show save button when canEdit and not collapsed', () => {
    lockStateSig.set('held');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.ep-btn--primary')).toBeTruthy();
  });

  it('should hide save button when lockState is not held', () => {
    lockStateSig.set('readonly');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.ep-btn--primary')).toBeNull();
  });

  // ── Collapse / expand ───────────────────────────────────────────────────────

  it('should toggle collapsed state on collapse button click', () => {
    fixture.detectChanges();
    expect(component.collapsed()).toBe(false);

    const collapseBtn = fixture.nativeElement.querySelector('.ep-icon-btn') as HTMLButtonElement;
    collapseBtn.click();
    fixture.detectChanges();

    expect(component.collapsed()).toBe(true);
  });

  it('collapsed body is hidden when collapsed', () => {
    component.collapsed.set(true);
    fixture.detectChanges();
    const body = fixture.nativeElement.querySelector('.ep-collapse-body') as HTMLElement;
    expect(body.style.display).toBe('none');
  });

  // ── Lock banners ─────────────────────────────────────────────────────────────

  it('should show takeover banner when lock is lost to another user', () => {
    lockStateSig.set('lost_takeover');
    takenOverBySig.set('Иван');
    fixture.detectChanges();
    const banner = fixture.nativeElement.querySelector('.ep-banner--warning') as HTMLElement;
    expect(banner).toBeTruthy();
    expect(banner.textContent).toContain('Иван');
  });

  it('should show session-expired banner with reacquire button', () => {
    lockStateSig.set('lost_expired');
    fixture.detectChanges();
    const banner = fixture.nativeElement.querySelector('.ep-banner--info') as HTMLElement;
    expect(banner).toBeTruthy();
    expect(banner.querySelector('.ep-banner-action')).toBeTruthy();
  });

  it('should show locked-by-other banner when document is locked by someone else', () => {
    docsApiMock['get'].mockReturnValue(of(makeDocResponse({
      lock: { isLocked: true, lockedBy: { name: 'Мария' } },
    })));
    lockStateSig.set('readonly');
    fixture.detectChanges();
    const banners = fixture.nativeElement.querySelectorAll<HTMLElement>('.ep-banner--warning');
    const lockedBanner = Array.from(banners).find(b => b.textContent?.includes('Мария'));
    expect(lockedBanner).toBeTruthy();
  });

  it('should show conflict error banner on 409 save', () => {
    docsApiMock['save'].mockReturnValue(throwError(() => ({ status: 409 })));
    fixture.detectChanges();
    component.editor = createMockEditor();

    component.save();
    fixture.detectChanges();

    const banners = fixture.nativeElement.querySelectorAll<HTMLElement>('.ep-banner--warning');
    const conflictBanner = Array.from(banners).find(b => b.textContent?.includes('изменён'));
    expect(conflictBanner).toBeTruthy();
  });

  // ── save() ───────────────────────────────────────────────────────────────────

  it('save() calls docsApi.save and updates etag', () => {
    fixture.detectChanges();
    component.editor = createMockEditor();

    component.save();

    expect(docsApiMock['save']).toHaveBeenCalledWith('doc_1', '# Panel content', '"abc123"');
    expect(component.saveStatus()).toBe('saved');
    expect(component.doc()?.etag).toBe('"new_etag"');
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

  it('save() 413 → sets saveStatus to quota', () => {
    docsApiMock['save'].mockReturnValue(throwError(() => ({ status: 413 })));
    fixture.detectChanges();
    component.editor = createMockEditor();

    component.save();

    expect(component.saveStatus()).toBe('quota');
  });

  it('save() clears conflictError before each attempt', () => {
    docsApiMock['save']
      .mockReturnValueOnce(throwError(() => ({ status: 409 })))
      .mockReturnValue(of(makeSaveResponse()));
    fixture.detectChanges();
    component.editor = createMockEditor();

    component.save(); // first → conflict
    expect(component.conflictError()).toBe(true);

    component.save(); // second → success, conflict cleared
    expect(component.conflictError()).toBe(false);
    expect(component.saveStatus()).toBe('saved');
  });

  // ── onImageSelected ──────────────────────────────────────────────────────────

  it('onImageSelected inserts image using stableUrl', () => {
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

    const chainSpy = mockEditor.chain as ReturnType<typeof vi.fn>;
    const firstChainResult = chainSpy.mock.results[0]?.value;
    expect(firstChainResult?.setImage).toHaveBeenCalledWith(
      expect.objectContaining({ src: '/api/v1/files/img_1/content' })
    );
    expect(component.showImagePicker()).toBe(false);
  });

  // ── ngOnDestroy ──────────────────────────────────────────────────────────────

  it('ngOnDestroy releases lock and destroys editor when lock is held', () => {
    fixture.detectChanges();
    component.editor = createMockEditor();

    component.ngOnDestroy();

    expect((lockServiceMock['release'] as ReturnType<typeof vi.fn>))
      .toHaveBeenCalledWith('doc_1');
    expect(component.editor?.destroy).toHaveBeenCalled();
    expect((lockServiceMock['reset'] as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
  });

  it('ngOnDestroy does not release lock when not held', () => {
    lockStateSig.set('readonly');
    fixture.detectChanges();

    component.ngOnDestroy();

    expect((lockServiceMock['release'] as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
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

  // ── reacquire ────────────────────────────────────────────────────────────────

  it('reacquire() calls lockService.reacquire with fileId', async () => {
    fixture.detectChanges();

    await component.reacquire();

    expect((lockServiceMock['reacquire'] as ReturnType<typeof vi.fn>))
      .toHaveBeenCalledWith('doc_1');
  });

  // ── canEdit computed ──────────────────────────────────────────────────────────

  it('canEdit is true only when lockState is held and doc allows edit', () => {
    lockStateSig.set('held');
    fixture.detectChanges();
    expect(component.canEdit()).toBe(true);

    lockStateSig.set('lost_expired');
    fixture.detectChanges();
    expect(component.canEdit()).toBe(false);
  });

  // ── close / expandToggle outputs ─────────────────────────────────────────────

  it('close button emits closed output', () => {
    fixture.detectChanges();
    const emitted: unknown[] = [];
    component.closed.subscribe(() => emitted.push(1));

    const closeBtn = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLButtonElement>('.ep-icon-btn')
    ).find(b => b.getAttribute('aria-label') === 'Закрыть редактор');

    closeBtn?.click();
    expect(emitted.length).toBe(1);
  });
});
