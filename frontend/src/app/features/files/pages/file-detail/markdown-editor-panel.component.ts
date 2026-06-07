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
} from '@angular/core';
import { DocumentLockService } from '../../services/document-lock.service';
import { MarkdownEditorService } from '../../services/markdown-editor.service';
import { ImagePickerComponent } from '../markdown-editor/image-picker.component';

@Component({
  selector: 'app-markdown-editor-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MarkdownEditorService],
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

    <!-- Sticky: header bar + toolbars -->
    <div class="ep-sticky-top">
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
          >Сбросить</button>
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

    @if (!collapsed()) {
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
          <button type="button" class="ep-tb-btn ep-tb-text ep-tb-bold" [class.active]="activeMarks().has('bold')"
            (click)="cmd('toggleBold')" aria-label="Жирный" title="Жирный (Ctrl+B)">B</button>
          <button type="button" class="ep-tb-btn ep-tb-text ep-tb-italic" [class.active]="activeMarks().has('italic')"
            (click)="cmd('toggleItalic')" aria-label="Курсив" title="Курсив (Ctrl+I)"><em>I</em></button>
          <button type="button" class="ep-tb-btn ep-tb-text ep-tb-strike" [class.active]="activeMarks().has('strike')"
            (click)="cmd('toggleStrike')" aria-label="Зачёркнутый" title="Зачёркнутый"><s>S</s></button>
          <button type="button" class="ep-tb-btn" [class.active]="activeMarks().has('code')"
            (click)="cmd('toggleCode')" aria-label="Код" title="Инлайн-код">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
          </button>

          <span class="ep-sep" aria-hidden="true"></span>

          <!-- Headings -->
          <button type="button" class="ep-tb-btn ep-tb-text" [class.active]="activeMarks().has('h1')"
            (click)="cmdHeading(1)" aria-label="Заголовок 1" title="Заголовок 1">H1</button>
          <button type="button" class="ep-tb-btn ep-tb-text" [class.active]="activeMarks().has('h2')"
            (click)="cmdHeading(2)" aria-label="Заголовок 2" title="Заголовок 2">H2</button>
          <button type="button" class="ep-tb-btn ep-tb-text" [class.active]="activeMarks().has('h3')"
            (click)="cmdHeading(3)" aria-label="Заголовок 3" title="Заголовок 3">H3</button>

          <span class="ep-sep" aria-hidden="true"></span>

          <!-- Lists -->
          <button type="button" class="ep-tb-btn" [class.active]="activeMarks().has('bulletList')"
            (click)="cmd('toggleBulletList')" aria-label="Маркированный список" title="Маркированный список">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>
          </button>
          <button type="button" class="ep-tb-btn" [class.active]="activeMarks().has('orderedList')"
            (click)="cmd('toggleOrderedList')" aria-label="Нумерованный список" title="Нумерованный список">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4" stroke-width="1.8"/><path d="M4 10h2" stroke-width="1.8"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" stroke-width="1.8"/></svg>
          </button>
          <button type="button" class="ep-tb-btn" [class.active]="activeMarks().has('taskList')"
            (click)="cmd('toggleTaskList')" aria-label="Список задач" title="Список задач">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="6" height="6" rx="1"/><path d="M5 8l1.5 1.5L9 6"/><line x1="13" y1="8" x2="21" y2="8"/><rect x="3" y="14" width="6" height="6" rx="1"/><line x1="13" y1="17" x2="21" y2="17"/></svg>
          </button>

          <span class="ep-sep" aria-hidden="true"></span>

          <!-- Block elements -->
          <button type="button" class="ep-tb-btn" [class.active]="activeMarks().has('blockquote')"
            (click)="cmd('toggleBlockquote')" aria-label="Цитата" title="Цитата">
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.757-2-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>
          </button>
          <button type="button" class="ep-tb-btn" [class.active]="activeMarks().has('codeBlock')"
            (click)="cmd('toggleCodeBlock')" aria-label="Блок кода" title="Блок кода">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m9 9-3 3 3 3"/><path d="m15 9 3 3-3 3"/></svg>
          </button>

          <span class="ep-sep" aria-hidden="true"></span>

          <!-- Таблица -->
          <button type="button" class="ep-tb-btn" [class.active]="isInTable()"
            (click)="insertTable()" aria-label="Вставить таблицу" title="Вставить таблицу 3×3">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>
            </svg>
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

      <!-- Table context bar (visible when cursor is inside a table) -->
      @if (canEdit() && isInTable()) {
        <div class="ep-table-bar" role="toolbar" aria-label="Управление таблицей">
          <span class="ep-table-bar-label">Строки:</span>
          <button type="button" class="ep-tb-btn" (click)="tableCmd('addRowBefore')" aria-label="Строка выше" title="Строка выше">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>
          </button>
          <button type="button" class="ep-tb-btn" (click)="tableCmd('addRowAfter')" aria-label="Строка ниже" title="Строка ниже">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>
          </button>
          <button type="button" class="ep-tb-btn ep-tb-btn--danger" (click)="tableCmd('deleteRow')" aria-label="Удалить строку" title="Удалить строку">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
          <span class="ep-sep" aria-hidden="true"></span>
          <span class="ep-table-bar-label">Столбцы:</span>
          <button type="button" class="ep-tb-btn" (click)="tableCmd('addColumnBefore')" aria-label="Столбец слева" title="Столбец слева">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5"/><path d="m12 5-7 7 7 7"/></svg>
          </button>
          <button type="button" class="ep-tb-btn" (click)="tableCmd('addColumnAfter')" aria-label="Столбец справа" title="Столбец справа">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="m12 19 7-7-7-7"/></svg>
          </button>
          <button type="button" class="ep-tb-btn ep-tb-btn--danger" (click)="tableCmd('deleteColumn')" aria-label="Удалить столбец" title="Удалить столбец">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
          <span class="ep-sep" aria-hidden="true"></span>
          <button type="button" class="ep-tb-btn ep-tb-btn--danger ep-tb-text" (click)="tableCmd('deleteTable')" aria-label="Удалить таблицу" title="Удалить таблицу">
            ✕ таблицу
          </button>
        </div>
      }
    } <!-- /@if !collapsed -->
    </div> <!-- /ep-sticky-top -->

    <!-- Editor body — клик в пустое пространство ниже текста тоже фокусирует редактор -->
    @if (!collapsed()) {
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
    }

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

  private readonly editorSvc = inject(MarkdownEditorService);
  readonly lockService        = this.editorSvc.lockService;

  // Forward service state to component surface for template + test access
  readonly doc              = this.editorSvc.doc;
  readonly loading          = this.editorSvc.loading;
  readonly saveStatus       = this.editorSvc.saveStatus;
  readonly originalContent  = this.editorSvc.originalContent;
  readonly conflictError    = this.editorSvc.conflictError;
  readonly isImageSelected  = this.editorSvc.isImageSelected;
  readonly selectedImgWidth = this.editorSvc.selectedImgWidth;
  readonly imgWidthPx       = this.editorSvc.imgWidthPx;
  readonly isInTable        = this.editorSvc.isInTable;
  readonly lockState        = this.editorSvc.lockState;
  readonly canEdit          = this.editorSvc.canEdit;
  readonly lockedByOther    = this.editorSvc.lockedByOther;
  readonly activeMarks      = this.editorSvc.activeMarks;

  readonly collapsed       = signal(false);
  readonly showImagePicker = signal(false);

  readonly saveStatusLabel = computed(() => {
    switch (this.saveStatus()) {
      case 'saved':   return 'Сохранено';
      case 'unsaved': return 'Не сохранено';
      case 'saving':  return 'Сохраняем...';
      case 'quota':   return 'Превышена квота хранилища';
      case 'error':   return 'Ошибка сохранения';
    }
  });

  // Forwarded for test compatibility
  get editor() { return this.editorSvc.editor; }
  set editor(e: typeof this.editorSvc.editor) { this.editorSvc.editor = e; }

  get periodicSaveTimer() { return this.editorSvc.periodicSaveTimer; }
  set periodicSaveTimer(v: ReturnType<typeof setInterval> | null) { this.editorSvc.periodicSaveTimer = v; }

  private readonly onBeforeUnload = (): void => {
    if (this.saveStatus() === 'unsaved' && this.canEdit() && !this.conflictError()) {
      this.save();
    }
  };

  constructor() {
    effect(() => {
      this.editorSvc.editor?.setEditable(this.canEdit());
    });
    effect(() => {
      const trigger = this.refreshTrigger();
      if (trigger > 0) {
        this.lockService.reset();
        this.editorSvc.loadDocument(
          this.fileId(),
          () => this.editorEl?.nativeElement ?? null,
          { withTable: true },
        );
      }
    });
  }

  ngOnInit(): void {
    window.addEventListener('beforeunload', this.onBeforeUnload);
    this.editorSvc.loadDocument(
      this.fileId(),
      () => this.editorEl?.nativeElement ?? null,
      { withTable: true },
    );
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    window.removeEventListener('beforeunload', this.onBeforeUnload);
    const wasUnsaved = this.saveStatus() === 'unsaved' && !this.conflictError();
    const wasEditable = this.canEdit() || this.lockState() === 'held';
    const lockWasHeld = this.lockState() === 'held';
    const fileId = this.fileId();

    if (wasUnsaved && wasEditable && lockWasHeld) {
      // Flush save first, release lock in callback to prevent server rejecting
      // save with LOCK_REQUIRED if release reaches server before save does.
      this.editorSvc.flushOnDestroy(fileId).subscribe({
        complete: () => this.lockService.release(fileId),
      });
    } else {
      if (wasUnsaved && wasEditable) {
        this.save();
      }
      if (lockWasHeld) {
        this.lockService.release(fileId);
      }
    }

    this.editorSvc.teardown();
    this.lockService.reset();
  }

  save(): void    { this.editorSvc.save(this.fileId()); }
  revert(): void  { this.editorSvc.revert(); }

  cmd(command: string): void            { this.editorSvc.cmd(command); }
  cmdHeading(level: 1 | 2 | 3): void   { this.editorSvc.cmdHeading(level); }
  setImgWidth(w: number | null): void   { this.editorSvc.setImgWidth(w); }
  onImgWidthChange(e: Event): void      { this.editorSvc.onImgWidthChange(e); }

  openImagePicker(): void { this.showImagePicker.set(true); }

  onImageSelected(img: import('../../../../shared/models/api.models').ImageAsset): void {
    this.showImagePicker.set(false);
    this.editorSvc.insertImage(img);
  }

  async reacquire(): Promise<void> {
    await this.editorSvc.reacquire(this.fileId());
  }

  onBodyClick(e: MouseEvent): void {
    if (!this.editorSvc.editor || !this.canEdit()) return;
    const target = e.target as HTMLElement;
    if (!target.closest('.ProseMirror')) {
      this.editorSvc.editor.commands.focus('end');
    }
  }

  insertTable(): void {
    if (!this.editorSvc.editor || !this.canEdit()) return;
    this.editorSvc.editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }

  tableCmd(command: string): void {
    if (!this.editorSvc.editor || !this.canEdit()) return;
    const chain = this.editorSvc.editor.chain().focus();
    (chain as unknown as Record<string, () => unknown>)[command]?.();
    chain.run();
  }

  close(): void { this.closed.emit(); }
}
