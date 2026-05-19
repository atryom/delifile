import {
  Component,
  inject,
  signal,
  computed,
  effect,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  ViewChild,
  input,
  output,
  ChangeDetectionStrategy,
  NgZone,
} from '@angular/core';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { ResizableImage } from '../markdown-editor/resizable-image.extension';
import { Link } from '@tiptap/extension-link';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Markdown } from 'tiptap-markdown';
import { DocumentsApiService } from '../../../../core/api/documents-api.service';
import { DocumentLockService } from '../../services/document-lock.service';
import { Document as DocModel, ImageAsset } from '../../../../shared/models/api.models';
import { ImagePickerComponent } from '../markdown-editor/image-picker.component';

type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error' | 'quota';

@Component({
  selector: 'app-markdown-editor-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImagePickerComponent],
  host: { '[class.is-expanded]': 'expanded()' },
  template: `
    <!-- Lock status banners -->
    @if (lockState() === 'lost_takeover') {
      <div class="ep-banner ep-banner--warning" role="alert">
        Документ забран пользователем <strong>{{ lockService.takenOverBy() }}</strong>. Вы в режиме просмотра.
      </div>
    }
    @if (lockState() === 'lost_expired') {
      <div class="ep-banner ep-banner--info" role="alert">
        Сессия редактирования истекла.
        <button type="button" class="ep-banner-action" (click)="reacquire()">Продолжить редактирование</button>
      </div>
    }
    @if (lockedByOther()) {
      <div class="ep-banner ep-banner--warning" role="alert">
        Документ редактирует <strong>{{ doc()?.lock?.lockedBy?.name }}</strong>.
      </div>
    }
    @if (conflictError()) {
      <div class="ep-banner ep-banner--warning" role="alert">
        Документ был изменён другим пользователем — перезагрузите страницу для получения актуальной версии.
      </div>
    }

    <!-- Header bar -->
    <div class="ep-bar">
      <button
        type="button"
        class="ep-icon-btn"
        (click)="collapsed.set(!collapsed())"
        [attr.aria-expanded]="!collapsed()"
        [attr.aria-label]="collapsed() ? 'Развернуть редактор' : 'Свернуть редактор'"
      >
        @if (collapsed()) {
          <!-- chevron down -->
          <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
        } @else {
          <!-- chevron up -->
          <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>
        }
      </button>

      <span class="ep-title">{{ doc()?.fileName ?? 'Редактор' }}</span>
      @if (!canEdit() && lockState() !== 'acquiring') {
        <span class="ep-view-badge" role="status">Просмотр</span>
      }

      <div class="ep-bar-actions">
        <span class="ep-save-status" role="status" [attr.aria-live]="'polite'">{{ saveStatusLabel() }}</span>

        @if (canEdit() && !collapsed()) {
          <button
            type="button"
            class="ep-btn"
            (click)="revert()"
          >Отменить изменения</button>
        }

        <!-- Expand / minimize -->
        @if (!collapsed()) {
          <button
            type="button"
            class="ep-icon-btn"
            (click)="expandToggle.emit()"
            [attr.aria-label]="expanded() ? 'Свернуть на страницу' : 'На весь экран'"
            [title]="expanded() ? 'Свернуть на страницу' : 'На весь экран'"
          >
            @if (expanded()) {
              <!-- minimize-2 -->
              <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="21" y2="3"/><line x1="3" y1="21" x2="14" y2="10"/></svg>
            } @else {
              <!-- maximize-2 -->
              <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            }
          </button>
        }

        <button type="button" class="ep-icon-btn" (click)="close()" aria-label="Закрыть редактор" title="Закрыть редактор">
          <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>

    <!-- Collapsible: toolbar + body -->
    <div class="ep-collapse-body" [style.display]="collapsed() ? 'none' : ''">

      <!-- Toolbar -->
      @if (canEdit()) {
        <div class="ep-toolbar" role="toolbar" aria-label="Форматирование текста">

          <!-- History -->
          <button type="button" class="ep-tb-btn" (click)="cmd('undo')" aria-label="Отменить" title="Отменить (Ctrl+Z)">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7v6h6"/><path d="M21 17A9 9 0 0 0 6 5.7L3 8"/></svg>
          </button>
          <button type="button" class="ep-tb-btn" (click)="cmd('redo')" aria-label="Повторить" title="Повторить (Ctrl+Y)">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 15-5.7l3 2.7"/></svg>
          </button>

          <span class="ep-sep" aria-hidden="true"></span>

          <!-- Inline formatting -->
          <button type="button" class="ep-tb-btn ep-tb-text ep-tb-bold" [class.active]="editor?.isActive('bold')"
            (click)="cmd('toggleBold')" aria-label="Жирный" title="Жирный (Ctrl+B)">B</button>
          <button type="button" class="ep-tb-btn ep-tb-text ep-tb-italic" [class.active]="editor?.isActive('italic')"
            (click)="cmd('toggleItalic')" aria-label="Курсив" title="Курсив (Ctrl+I)"><em>I</em></button>
          <button type="button" class="ep-tb-btn ep-tb-text ep-tb-strike" [class.active]="editor?.isActive('strike')"
            (click)="cmd('toggleStrike')" aria-label="Зачёркнутый" title="Зачёркнутый"><s>S</s></button>
          <button type="button" class="ep-tb-btn" [class.active]="editor?.isActive('code')"
            (click)="cmd('toggleCode')" aria-label="Код" title="Инлайн-код">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
          </button>

          <span class="ep-sep" aria-hidden="true"></span>

          <!-- Headings -->
          <button type="button" class="ep-tb-btn ep-tb-text" [class.active]="editor?.isActive('heading', {level:1})"
            (click)="cmdHeading(1)" aria-label="Заголовок 1" title="Заголовок 1">H1</button>
          <button type="button" class="ep-tb-btn ep-tb-text" [class.active]="editor?.isActive('heading', {level:2})"
            (click)="cmdHeading(2)" aria-label="Заголовок 2" title="Заголовок 2">H2</button>
          <button type="button" class="ep-tb-btn ep-tb-text" [class.active]="editor?.isActive('heading', {level:3})"
            (click)="cmdHeading(3)" aria-label="Заголовок 3" title="Заголовок 3">H3</button>

          <span class="ep-sep" aria-hidden="true"></span>

          <!-- Lists -->
          <button type="button" class="ep-tb-btn" [class.active]="editor?.isActive('bulletList')"
            (click)="cmd('toggleBulletList')" aria-label="Маркированный список" title="Маркированный список">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>
          </button>
          <button type="button" class="ep-tb-btn" [class.active]="editor?.isActive('orderedList')"
            (click)="cmd('toggleOrderedList')" aria-label="Нумерованный список" title="Нумерованный список">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4" stroke-width="1.8"/><path d="M4 10h2" stroke-width="1.8"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" stroke-width="1.8"/></svg>
          </button>
          <button type="button" class="ep-tb-btn" [class.active]="editor?.isActive('taskList')"
            (click)="cmd('toggleTaskList')" aria-label="Список задач" title="Список задач">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="6" height="6" rx="1"/><path d="M5 8l1.5 1.5L9 6"/><line x1="13" y1="8" x2="21" y2="8"/><rect x="3" y="14" width="6" height="6" rx="1"/><line x1="13" y1="17" x2="21" y2="17"/></svg>
          </button>

          <span class="ep-sep" aria-hidden="true"></span>

          <!-- Block elements -->
          <button type="button" class="ep-tb-btn" [class.active]="editor?.isActive('blockquote')"
            (click)="cmd('toggleBlockquote')" aria-label="Цитата" title="Цитата">
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.757-2-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>
          </button>
          <button type="button" class="ep-tb-btn" [class.active]="editor?.isActive('codeBlock')"
            (click)="cmd('toggleCodeBlock')" aria-label="Блок кода" title="Блок кода">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m9 9-3 3 3 3"/><path d="m15 9 3 3-3 3"/></svg>
          </button>

          @if (doc()?.capabilities?.canInsertImages) {
            <span class="ep-sep" aria-hidden="true"></span>
            <button type="button" class="ep-tb-btn" (click)="openImagePicker()" aria-label="Вставить изображение" title="Вставить изображение">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            </button>
          }
        </div>
      }

      <!-- Image size bar (visible when an image node is selected) -->
      @if (canEdit() && isImageSelected()) {
        <div class="ep-img-bar" role="toolbar" aria-label="Размер изображения">
          <span class="ep-img-bar-label">Размер:</span>
          <button type="button" class="ep-tb-btn ep-tb-text" [class.active]="selectedImgWidth() === '200'" (click)="setImgWidth(200)" title="Малое — 200px">S</button>
          <button type="button" class="ep-tb-btn ep-tb-text" [class.active]="selectedImgWidth() === '400'" (click)="setImgWidth(400)" title="Среднее — 400px">M</button>
          <button type="button" class="ep-tb-btn ep-tb-text" [class.active]="selectedImgWidth() === '600'" (click)="setImgWidth(600)" title="Большое — 600px">L</button>
          <button type="button" class="ep-tb-btn" [class.active]="!selectedImgWidth()" (click)="setImgWidth(null)" title="Полная ширина">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12H19"/><path d="M15 8l4 4-4 4"/><path d="M9 16 5 12l4-4"/></svg>
          </button>
          <span class="ep-sep" aria-hidden="true"></span>
          <input
            type="number"
            class="ep-img-width-input"
            [value]="imgWidthPx()"
            (change)="onImgWidthChange($event)"
            (keydown.enter)="onImgWidthChange($event)"
            min="40"
            max="2000"
            placeholder="—"
            aria-label="Ширина изображения в пикселях"
          >
          <span class="ep-img-bar-px">px</span>
        </div>
      }

      <!-- Editor body — клик в пустое пространство ниже текста тоже фокусирует редактор -->
      <div class="ep-body" (click)="onBodyClick($event)">
        @if (loading()) {
          <div class="ep-state" aria-live="polite">Загрузка документа...</div>
        } @else {
          <div class="ep-prose-wrap">
            <div
              #editorEl
              class="ep-content"
              [attr.aria-label]="'Содержимое документа'"
              [attr.aria-readonly]="!canEdit()"
            ></div>
          </div>
        }
      </div>
    </div>

    @if (showImagePicker()) {
      <app-image-picker
        (selected)="onImageSelected($event)"
        (cancelled)="showImagePicker.set(false)"
      />
    }
  `,
  styleUrl: './markdown-editor-panel.component.scss',
})
export class MarkdownEditorPanelComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly fileId         = input.required<string>();
  readonly expanded       = input(false);
  readonly refreshTrigger = input(0);
  readonly closed         = output<void>();
  readonly expandToggle   = output<void>();

  @ViewChild('editorEl') editorEl!: ElementRef<HTMLElement>;

  private readonly docsApi = inject(DocumentsApiService);
  readonly lockService     = inject(DocumentLockService);
  private readonly zone    = inject(NgZone);

  editor: Editor | null = null;

  private periodicSaveTimer: ReturnType<typeof setInterval> | null = null;
  private readonly AUTO_SAVE_INTERVAL = 30_000;

  private readonly onBeforeUnload = (): void => {
    if (this.saveStatus() === 'unsaved' && this.canEdit() && !this.conflictError()) {
      this.save();
    }
  };

  constructor() {
    effect(() => {
      this.editor?.setEditable(this.canEdit());
    });
    effect(() => {
      const trigger = this.refreshTrigger();
      if (trigger > 0) {
        this.lockService.reset();
        this.loadDocument();
      }
    });
  }

  readonly doc              = signal<DocModel | null>(null);
  readonly loading          = signal(true);
  readonly saveStatus       = signal<SaveStatus>('saved');
  readonly originalContent  = signal<string>('');
  readonly collapsed        = signal(false);
  readonly editorEmpty      = signal(true);
  readonly showImagePicker  = signal(false);
  readonly conflictError    = signal(false);
  readonly isImageSelected  = signal(false);
  readonly selectedImgWidth = signal<string | null>(null);
  readonly imgWidthPx       = signal('');

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

  readonly saveStatusLabel = computed(() => {
    switch (this.saveStatus()) {
      case 'saved':   return 'Сохранено';
      case 'unsaved': return 'Не сохранено';
      case 'saving':  return 'Сохраняем...';
      case 'quota':   return 'Превышена квота хранилища';
      case 'error':   return 'Ошибка сохранения';
    }
  });

  ngOnInit(): void {
    window.addEventListener('beforeunload', this.onBeforeUnload);
    this.loadDocument();
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    window.removeEventListener('beforeunload', this.onBeforeUnload);
    if (this.saveStatus() === 'unsaved' && this.canEdit() && !this.conflictError()) {
      this.save();
    }
    if (this.lockState() === 'held') {
      this.lockService.release(this.fileId());
    }
    this.teardownEditor();
    this.lockService.reset();
  }

  private teardownEditor(): void {
    if (this.periodicSaveTimer !== null) {
      clearInterval(this.periodicSaveTimer);
      this.periodicSaveTimer = null;
    }
    this.editor?.destroy();
    this.editor = null;
  }

  private loadDocument(): void {
    this.teardownEditor();
    this.loading.set(true);
    this.docsApi.get(this.fileId()).subscribe({
      next: async (res) => {
        this.doc.set(res.data.document);
        this.originalContent.set(res.data.document.content ?? '');
        this.loading.set(false);

        if (res.data.document.capabilities.canEdit) {
          // Always try to acquire — backend returns 201 if same user re-acquires
          // their own lock (e.g. after page refresh), 423 if held by another user.
          await this.lockService.acquire(this.fileId());
        } else {
          this.lockService.lockState.set('readonly');
        }

        setTimeout(() => this.initEditor(res.data.document.content), 0);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  private initEditor(content: string): void {
    if (!this.editorEl) return;

    this.zone.runOutsideAngular(() => {
      this.editor = new Editor({
        element: this.editorEl.nativeElement,
        extensions: [
          StarterKit,
          ResizableImage.configure({ allowBase64: false }),
          Link.configure({ openOnClick: false }),
          TaskList,
          TaskItem.configure({ nested: true }),
          Markdown.configure({ transformPastedText: true }),
        ],
        content: '',
        editable: this.canEdit(),
        onUpdate: ({ editor }) => {
          this.zone.run(() => {
            this.editorEmpty.set(editor.isEmpty);
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
            this.save();
          }
        });
      }, this.AUTO_SAVE_INTERVAL);
    });
  }

  save(): void {
    if (!this.editor || !this.doc()) return;

    const etag = this.doc()!.etag;
    if (!etag) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: string = (this.editor.storage as any)['markdown']?.getMarkdown?.() ?? '';

    this.conflictError.set(false);
    this.saveStatus.set('saving');
    this.docsApi.save(this.fileId(), raw, etag).subscribe({
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

  openImagePicker(): void {
    this.showImagePicker.set(true);
  }

  onImageSelected(img: ImageAsset): void {
    this.showImagePicker.set(false);
    if (!this.editor) return;
    this.editor
      .chain()
      .focus()
      .setImage({ src: img.stableUrl, alt: img.fileName, title: img.fileName })
      .run();
  }

  async reacquire(): Promise<void> {
    await this.lockService.reacquire(this.fileId());
    if (this.lockState() === 'held') {
      this.editor?.setEditable(true);
    }
  }

  onBodyClick(e: MouseEvent): void {
    if (!this.editor || !this.canEdit()) return;
    const target = e.target as HTMLElement;
    // Если клик был НЕ внутри ProseMirror — фокусируем редактор в конец документа
    if (!target.closest('.ProseMirror')) {
      this.editor.commands.focus('end');
    }
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

  close(): void {
    this.closed.emit();
  }
}