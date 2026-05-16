import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { MarkdownEditorComponent } from './markdown-editor.component';
import { DocumentsApiService } from '../../../../core/api/documents-api.service';
import { DocumentLockService } from '../../services/document-lock.service';

// Tiptap requires MutationObserver.takeRecords() which happy-dom doesn't implement.
// We replace only the Editor class; extensions from other @tiptap/* packages stay real.
vi.mock('@tiptap/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tiptap/core')>();
  return {
    ...actual,
    Editor: class MockEditor {
      storage: Record<string, unknown> = {
        markdown: { parse: vi.fn(() => ''), serialize: vi.fn(() => '') },
      };
      isActive = vi.fn(() => false);
      destroy = vi.fn();
      setEditable = vi.fn();
      commands = { setContent: vi.fn() };
      chain = vi.fn(() => ({
        focus: vi.fn().mockReturnThis(),
        toggleBold: vi.fn().mockReturnThis(),
        run: vi.fn(),
        setImage: vi.fn().mockReturnThis(),
        toggleHeading: vi.fn().mockReturnThis(),
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
});
