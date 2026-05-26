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
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router } from '@angular/router';
import { DocumentLockService } from '../../services/document-lock.service';
import { MarkdownEditorService } from '../../services/markdown-editor.service';
import { ImagePickerComponent } from './image-picker.component';

@Component({
  selector: 'app-markdown-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MarkdownEditorService],
  imports: [ImagePickerComponent],
  template: `
    <div class="md-editor-shell">

      <!-- Lock lost banner -->
      @if (lockState() === 'lost_takeover') {
        <div class="md-banner md-banner--warning" role="alert">
          Документ забран пользователем <strong>{{ lockService.takenOverBy() }}</strong>. Вы в режиме просмотра.
        </div>
      }
      @if (lockState() === 'lost_expired') {
        <div class="md-banner md-banner--info" role="alert">
          Сессия редактирования истекла.
          <button type="button" class="md-banner-action" (click)="reacquire()">Продолжить редактирование</button>
        </div>
      }

      <!-- Locked by someone banner -->
      @if (lockedByOther()) {
        <div class="md-banner md-banner--warning" role="alert">
          Документ редактирует <strong>{{ doc()?.lock?.lockedBy?.name }}</strong>.
          @if (doc()?.capabilities?.canTakeOverLock) {
            <button type="button" class="md-banner-action" (click)="takeover()">Забрать документ</button>
          }
        </div>
      }

      @if (conflictError()) {
        <div class="md-banner md-banner--warning" role="alert">
          Документ был изменён другим пользователем. Перезагрузите страницу, чтобы получить актуальную версию.
          <button type="button" class="md-banner-action" (click)="goBack()">Назад</button>
        </div>
      }

      <header class="md-editor-header">
        <div class="md-editor-title">
          <h1 class="md-editor-filename">{{ doc()?.fileName ?? '...' }}</h1>
        </div>
        <div class="md-editor-actions">
          <span class="md-save-status" [attr.aria-live]="'polite'">{{ saveStatusLabel() }}</span>
          @if (canEdit()) {
            <button
              type="button"
              class="md-btn"
              (click)="revert()"
            >Сбросить</button>
          }
          <button type="button" class="md-btn" (click)="goBack()">Назад</button>
        </div>
      </header>

      @if (canEdit()) {
        <div class="md-toolbar" role="toolbar" aria-label="Форматирование">
          <button type="button" [class.active]="editor?.isActive('bold')"
            (click)="cmd('toggleBold')" aria-label="Жирный">B</button>
          <button type="button" [class.active]="editor?.isActive('italic')"
            (click)="cmd('toggleItalic')" aria-label="Курсив"><em>I</em></button>
          <button type="button" [class.active]="editor?.isActive('strike')"
            (click)="cmd('toggleStrike')" aria-label="Зачёркнутый"><s>S</s></button>
          <button type="button" [class.active]="editor?.isActive('code')"
            (click)="cmd('toggleCode')" aria-label="Код">&#x3C;&#x3E;</button>
          <span class="md-toolbar-sep" aria-hidden="true"></span>
          <button type="button" [class.active]="editor?.isActive('heading', {level:1})"
            (click)="cmdHeading(1)" aria-label="Заголовок 1">H1</button>
          <button type="button" [class.active]="editor?.isActive('heading', {level:2})"
            (click)="cmdHeading(2)" aria-label="Заголовок 2">H2</button>
          <button type="button" [class.active]="editor?.isActive('heading', {level:3})"
            (click)="cmdHeading(3)" aria-label="Заголовок 3">H3</button>
          <span class="md-toolbar-sep" aria-hidden="true"></span>
          <button type="button" [class.active]="editor?.isActive('bulletList')"
            (click)="cmd('toggleBulletList')" aria-label="Маркированный список">•–</button>
          <button type="button" [class.active]="editor?.isActive('orderedList')"
            (click)="cmd('toggleOrderedList')" aria-label="Нумерованный список">1.</button>
          <button type="button" [class.active]="editor?.isActive('taskList')"
            (click)="cmd('toggleTaskList')" aria-label="Список задач">☑</button>
          <button type="button" [class.active]="editor?.isActive('blockquote')"
            (click)="cmd('toggleBlockquote')" aria-label="Цитата">"</button>
          <button type="button" [class.active]="editor?.isActive('codeBlock')"
            (click)="cmd('toggleCodeBlock')" aria-label="Блок кода">&#123; &#125;</button>
          <span class="md-toolbar-sep" aria-hidden="true"></span>
          <button type="button" (click)="cmd('undo')" aria-label="Отменить">↩</button>
          <button type="button" (click)="cmd('redo')" aria-label="Повторить">↪</button>
          @if (doc()?.capabilities?.canInsertImages) {
            <span class="md-toolbar-sep" aria-hidden="true"></span>
            <button type="button" (click)="openImagePicker()" aria-label="Вставить изображение">🖼</button>
          }
        </div>
      }

      @if (isImageSelected() && canEdit()) {
        <div class="md-img-bar" role="toolbar" aria-label="Размер изображения">
          <span class="md-img-bar-label">Ширина:</span>
          <button type="button" class="md-btn md-btn--img-preset" (click)="setImgWidth(200)">S</button>
          <button type="button" class="md-btn md-btn--img-preset" (click)="setImgWidth(400)">M</button>
          <button type="button" class="md-btn md-btn--img-preset" (click)="setImgWidth(640)">L</button>
          <button type="button" class="md-btn md-btn--img-preset" (click)="setImgWidth(null)">100%</button>
          <input
            type="number"
            class="md-img-width-input"
            aria-label="Ширина в пикселях"
            [value]="imgWidthPx()"
            min="10"
            max="2000"
            (change)="onImgWidthChange($event)"
          >
          <span class="md-img-bar-px">px</span>
        </div>
      }

      <div class="md-editor-body">
        @if (loading()) {
          <div class="md-state" aria-live="polite">Загрузка документа...</div>
        } @else {
          <div
            #editorEl
            class="md-editor-content"
            [attr.aria-label]="'Содержимое документа'"
            [attr.aria-readonly]="!canEdit()"
          ></div>
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
  styleUrl: './markdown-editor.component.scss',
})
export class MarkdownEditorComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly id = input.required<string>();

  @ViewChild('editorEl') editorEl!: ElementRef<HTMLElement>;

  private readonly editorSvc  = inject(MarkdownEditorService);
  readonly lockService         = this.editorSvc.lockService;
  private readonly router      = inject(Router);

  // Forward service state to component surface for template + test access
  readonly doc              = this.editorSvc.doc;
  readonly loading          = this.editorSvc.loading;
  readonly saveStatus       = this.editorSvc.saveStatus;
  readonly originalContent  = this.editorSvc.originalContent;
  readonly conflictError    = this.editorSvc.conflictError;
  readonly isImageSelected  = this.editorSvc.isImageSelected;
  readonly selectedImgWidth = this.editorSvc.selectedImgWidth;
  readonly imgWidthPx       = this.editorSvc.imgWidthPx;
  readonly lockState        = this.editorSvc.lockState;
  readonly canEdit          = this.editorSvc.canEdit;
  readonly lockedByOther    = this.editorSvc.lockedByOther;

  readonly showImagePicker = signal(false);

  readonly saveStatusLabel = computed(() => {
    switch (this.saveStatus()) {
      case 'saved':   return 'Сохранено';
      case 'unsaved': return 'Есть несохранённые изменения';
      case 'saving':  return 'Сохраняем...';
      case 'quota':   return 'Превышена квота хранилища';
      case 'error':   return 'Ошибка сохранения';
    }
  });

  // Forwarded for test compatibility (tests access via (component as any).editor / .periodicSaveTimer)
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
  }

  ngOnInit(): void {
    window.addEventListener('beforeunload', this.onBeforeUnload);
    this.editorSvc.loadDocument(this.id(), () => this.editorEl?.nativeElement ?? null);
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    window.removeEventListener('beforeunload', this.onBeforeUnload);
    const wasUnsaved = this.saveStatus() === 'unsaved' && !this.conflictError();
    const wasEditable = this.canEdit() || this.lockState() === 'held';
    if (wasUnsaved && wasEditable) {
      this.save();
    }
    if (this.lockState() === 'held') {
      this.lockService.release(this.id());
    }
    this.editorSvc.teardown();
    this.lockService.reset();
  }

  save(): void    { this.editorSvc.save(this.id()); }
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
    await this.editorSvc.reacquire(this.id());
  }

  takeover(): void {
    this.lockService.takeover(this.id()).then(ok => {
      if (ok) this.editorSvc.editor?.setEditable(true);
    });
  }

  goBack(): void { this.router.navigate(['/files']); }
}
