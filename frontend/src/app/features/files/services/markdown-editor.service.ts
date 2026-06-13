import { Injectable, inject, signal, computed, NgZone } from '@angular/core';
import { Observable, of } from 'rxjs';
import { tap, map, catchError } from 'rxjs/operators';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { ResizableImage } from '../pages/markdown-editor/resizable-image.extension';
import { Link } from '@tiptap/extension-link';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Markdown } from 'tiptap-markdown';
import { Placeholder } from '@tiptap/extension-placeholder';
import { DocumentsApiService } from '../../../core/api/documents-api.service';
import { DocumentLockService } from './document-lock.service';
import { Document as DocModel, ImageAsset } from '../../../shared/models/api.models';

export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error' | 'quota';

export interface EditorInitOptions {
  withTable?: boolean;
}

@Injectable()
export class MarkdownEditorService {
  private readonly docsApi   = inject(DocumentsApiService);
  readonly lockService        = inject(DocumentLockService);
  private readonly zone       = inject(NgZone);

  editor: Editor | null = null;
  periodicSaveTimer: ReturnType<typeof setInterval> | null = null;
  private readonly AUTO_SAVE_INTERVAL = 30_000;

  readonly doc              = signal<DocModel | null>(null);
  readonly loading          = signal(true);
  readonly saveStatus       = signal<SaveStatus>('saved');
  readonly originalContent  = signal<string>('');
  readonly conflictError    = signal(false);
  readonly isImageSelected  = signal(false);
  readonly selectedImgWidth = signal<string | null>(null);
  readonly imgWidthPx       = signal('');
  readonly editorEmpty      = signal(true);
  readonly isInTable        = signal(false);
  readonly activeMarks      = signal<Set<string>>(new Set());

  readonly lockState = this.lockService.lockState;

  readonly canEdit = computed(() => {
    const s = this.lockState();
    return this.doc()?.capabilities?.canEdit === true && s === 'held';
  });

  readonly lockedByOther = computed(() => {
    const d = this.doc();
    if (!d?.lock?.isLocked) return false;
    const ls = this.lockState();
    return ls !== 'held' && ls !== 'acquiring';
  });

  loadDocument(
    fileId: string,
    getElement: () => HTMLElement | null,
    options?: EditorInitOptions,
  ): void {
    this.teardown();
    this.loading.set(true);
    this.docsApi.get(fileId).subscribe({
      next: async (res) => {
        this.doc.set(res.data.document);
        this.originalContent.set(res.data.document.content ?? '');
        this.loading.set(false);

        if (res.data.document.capabilities.canEdit) {
          await this.lockService.acquire(fileId);
        } else {
          this.lockService.lockState.set('readonly');
        }

        setTimeout(() => {
          const el = getElement();
          if (el) this.initEditor(el, res.data.document.content, fileId, options);
        }, 0);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  private initEditor(
    element: HTMLElement,
    content: string,
    fileId: string,
    options?: EditorInitOptions,
  ): void {
    this.zone.runOutsideAngular(() => {
      const tableExtensions = options?.withTable
        ? [Table.configure({ resizable: false }), TableRow, TableHeader, TableCell]
        : [];

      this.editor = new Editor({
        element,
        extensions: [
          StarterKit,
          ResizableImage.configure({ allowBase64: false }),
          Link.configure({ openOnClick: false }),
          TaskList,
          TaskItem.configure({ nested: true }),
          ...tableExtensions,
          Markdown.configure({ transformPastedText: true }),
          Placeholder.configure({ placeholder: 'Начните печатать...' }),
        ],
        content: '',
        editable: this.canEdit(),
        onUpdate: ({ editor }) => {
          this.zone.run(() => {
            this.editorEmpty.set(editor.isEmpty);
            this.updateActiveMarks(editor);
            if (this.canEdit()) {
              this.saveStatus.set('unsaved');
            }
          });
        },
        onSelectionUpdate: ({ editor }) => {
          this.zone.run(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sel = editor.state.selection as any;
            const imgNode = sel.node?.type?.name === 'image' ? sel.node : null;
            if (imgNode) {
              this.isImageSelected.set(true);
              const w: string | null = imgNode.attrs['width'] ?? null;
              this.selectedImgWidth.set(w);
              this.imgWidthPx.set(w ?? '');
            } else {
              this.isImageSelected.set(false);
              this.selectedImgWidth.set(null);
              this.imgWidthPx.set('');
            }
            this.isInTable.set(editor.isActive('table'));
            this.updateActiveMarks(editor);
          });
        },
      });

      if (content) {
        this.editor.commands.setContent(content);
        this.zone.run(() => this.editorEmpty.set(this.editor?.isEmpty ?? true));
      }

      this.periodicSaveTimer = setInterval(() => {
        this.zone.run(() => {
          if (this.canEdit() && this.saveStatus() === 'unsaved' && !this.conflictError()) {
            this.save(fileId);
          }
        });
      }, this.AUTO_SAVE_INTERVAL);
    });
  }

  save(fileId: string): void {
    if (!this.editor || !this.doc()) return;
    const etag = this.doc()!.etag;
    if (!etag) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: string = (this.editor.storage as any)['markdown']?.getMarkdown?.() ?? '';

    this.conflictError.set(false);
    this.saveStatus.set('saving');
    this.docsApi.save(fileId, raw, etag).subscribe({
      next: res => {
        this.doc.update(d => d ? { ...d, etag: res.data.etag, updatedAt: res.data.updatedAt } : d);
        this.saveStatus.set('saved');
      },
      error: err => {
        if (err?.status === 409) {
          this.saveStatus.set('error');
          this.conflictError.set(true);
        } else if (err?.status === 413) {
          this.saveStatus.set('quota');
        } else {
          this.saveStatus.set('error');
        }
      },
    });
  }

  revert(): void {
    if (!confirm('Отменить все изменения и вернуться к исходному содержимому?')) return;
    if (!this.editor) return;
    this.editor.commands.setContent(this.originalContent());
    this.saveStatus.set('saved');
  }

  cmd(command: string): void {
    if (!this.editor || !this.canEdit()) return;
    const chain = this.editor.chain().focus();
    (chain as unknown as Record<string, () => unknown>)[command]?.();
    chain.run();
  }

  cmdHeading(level: 1 | 2 | 3): void {
    if (!this.editor || !this.canEdit()) return;
    this.editor.chain().focus().toggleHeading({ level }).run();
  }

  insertImage(img: ImageAsset): void {
    if (!this.editor) return;
    this.editor
      .chain()
      .focus()
      .setImage({ src: img.embedUrl, alt: img.fileName, title: img.fileName })
      .run();
  }

  async reacquire(fileId: string): Promise<void> {
    await this.lockService.reacquire(fileId);
    if (this.lockState() === 'held') {
      this.editor?.setEditable(true);
      // Mark unsaved so periodic timer will flush any content written during the lock gap
      this.saveStatus.set('unsaved');
    }
  }

  flushOnDestroy(fileId: string): Observable<void> {
    if (!this.editor || !this.doc()) return of(undefined);
    const etag = this.doc()!.etag;
    if (!etag) return of(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: string = (this.editor.storage as any)['markdown']?.getMarkdown?.() ?? '';
    return this.docsApi.save(fileId, raw, etag).pipe(
      tap(res => this.doc.update(d => d ? { ...d, etag: res.data.etag, updatedAt: res.data.updatedAt } : d)),
      map(() => undefined),
      catchError(() => of(undefined)),
    );
  }

  setImgWidth(width: number | null): void {
    if (!this.editor || !this.canEdit()) return;
    const w = width ? String(width) : null;
    this.editor.chain().focus().updateAttributes('image', { width: w }).run();
    this.selectedImgWidth.set(w);
    this.imgWidthPx.set(w ?? '');
  }

  onImgWidthChange(event: Event): void {
    const val = Math.round(+(event.target as HTMLInputElement).value);
    if (val >= 40 && val <= 2000) this.setImgWidth(val);
  }

  private updateActiveMarks(editor: Editor): void {
    const s = new Set<string>();
    for (const m of ['bold', 'italic', 'strike', 'code', 'bulletList', 'orderedList', 'taskList', 'blockquote', 'codeBlock']) {
      if (editor.isActive(m)) s.add(m);
    }
    if (editor.isActive('heading', { level: 1 })) s.add('h1');
    if (editor.isActive('heading', { level: 2 })) s.add('h2');
    if (editor.isActive('heading', { level: 3 })) s.add('h3');
    this.activeMarks.set(s);
  }

  teardown(): void {
    if (this.periodicSaveTimer !== null) {
      clearInterval(this.periodicSaveTimer);
      this.periodicSaveTimer = null;
    }
    this.editor?.destroy();
    this.editor = null;
  }
}
