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
  NgZone,
} from '@angular/core';
import { Router } from '@angular/router';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { ResizableImage } from './resizable-image.extension';
import { Link } from '@tiptap/extension-link';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Markdown } from 'tiptap-markdown';
import { DocumentsApiService } from '../../../../core/api/documents-api.service';
import { DocumentLockService, LockState } from '../../services/document-lock.service';
import { Document as DocModel, ImageAsset } from '../../../../shared/models/api.models';
import { ImagePickerComponent } from './image-picker.component';

type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

@Component({
  selector: 'app-markdown-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
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

      <header class="md-editor-header">
        <div class="md-editor-title">
          <h1 class="md-editor-filename">{{ doc()?.fileName ?? '...' }}</h1>
        </div>
        <div class="md-editor-actions">
          <span class="md-save-status" [attr.aria-live]="'polite'">{{ saveStatusLabel() }}</span>
          @if (canEdit()) {
            <button
              type="button"
              class="md-btn md-btn--primary"
              [disabled]="saveStatus() === 'saving' || lockState() !== 'held'"
              (click)="save()"
            >Сохранить</button>
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

  private readonly docsApi = inject(DocumentsApiService);
  readonly lockService     = inject(DocumentLockService);
  private readonly router  = inject(Router);
  private readonly zone    = inject(NgZone);

  editor: Editor | null = null;

  constructor() {
    effect(() => {
      this.editor?.setEditable(this.canEdit());
    });
  }

  readonly doc         = signal<DocModel | null>(null);
  readonly loading         = signal(true);
  readonly saveStatus      = signal<SaveStatus>('saved');
  readonly showImagePicker = signal(false);
  readonly isImageSelected = signal(false);
  readonly selectedImgWidth = signal<string | null>(null);
  readonly imgWidthPx       = signal('');

  readonly lockState  = this.lockService.lockState;
  readonly canEdit    = computed(() => {
    const s = this.lockState();
    return this.doc()?.capabilities?.canEdit === true && s === 'held';
  });

  readonly lockedByOther = computed(() => {
    const d = this.doc();
    if (!d?.lock?.isLocked) return false;
    const lockState = this.lockState();
    return lockState !== 'held' && lockState !== 'acquiring';
  });

  readonly saveStatusLabel = computed(() => {
    switch (this.saveStatus()) {
      case 'saved':   return 'Сохранено';
      case 'unsaved': return 'Есть несохранённые изменения';
      case 'saving':  return 'Сохраняем...';
      case 'error':   return 'Ошибка сохранения';
    }
  });

  ngOnInit(): void {
    this.loadDocument();
  }

  ngAfterViewInit(): void {
    // Editor will be created after document loads
  }

  ngOnDestroy(): void {
    const id = this.id();
    if (this.lockState() === 'held') {
      this.lockService.release(id);
    }
    this.editor?.destroy();
    this.lockService.reset();
  }

  private loadDocument(): void {
    this.docsApi.get(this.id()).subscribe({
      next: async (res) => {
        this.doc.set(res.data.document);
        this.loading.set(false);

        // Acquire lock BEFORE creating editor so canEdit() is settled.
        // Always try — backend returns 201 for same-user re-acquisition (e.g. after
        // page refresh), 423 only when another user genuinely holds the lock.
        if (res.data.document.capabilities.canEdit) {
          await this.lockService.acquire(this.id());
        } else {
          this.lockService.lockState.set('readonly');
        }

        // Init editor after view has updated (loading spinner replaced by editorEl)
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
        onUpdate: () => {
          this.zone.run(() => {
            if (this.canEdit()) {
              this.saveStatus.set('unsaved');
            }
          });
        },
        onSelectionUpdate: ({ editor }) => {
          this.zone.run(() => {
            const sel = editor.state.selection as unknown as { node?: { type?: { name?: string }; attrs?: Record<string, unknown> } };
            const imgNode = sel.node?.type?.name === 'image' ? sel.node : null;
            if (imgNode) {
              this.isImageSelected.set(true);
              const w = (imgNode.attrs?.['width'] as string | null) ?? null;
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

      // Set markdown content via Tiptap-markdown storage
      if (content) {
        this.editor.commands.setContent(content);
      }
    });
  }

  save(): void {
    if (!this.editor || !this.doc()) return;

    const etag = this.doc()!.etag;
    if (!etag) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: string = (this.editor.storage as any)['markdown']?.getMarkdown?.() ?? '';

    if (!raw.trim()) {
      this.saveStatus.set('saved');
      return;
    }

    this.saveStatus.set('saving');
    this.docsApi.save(this.id(), raw, etag).subscribe({
      next: res => {
        this.doc.update(d => d ? { ...d, etag: res.data.etag, updatedAt: res.data.updatedAt } : d);
        this.saveStatus.set('saved');
      },
      error: err => {
        if (err?.status === 409) {
          this.saveStatus.set('error');
          alert('Документ был изменён другим пользователем. Перезагрузите страницу.');
        } else {
          this.saveStatus.set('error');
        }
      },
    });
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
      .setImage({ src: img.assetUrl, alt: img.fileName, title: img.fileName })
      .run();
  }

  async reacquire(): Promise<void> {
    await this.lockService.reacquire(this.id());
    if (this.lockState() === 'held') {
      this.editor?.setEditable(true);
    }
  }

  takeover(): void {
    this.lockService.takeover(this.id()).then(ok => {
      if (ok) {
        this.editor?.setEditable(true);
      }
    });
  }

  setImgWidth(width: number | null): void {
    if (!this.editor) return;
    const { state, dispatch } = this.editor.view;
    const { selection } = state;
    const attrs = width ? { width: String(width) } : { width: null };
    dispatch(state.tr.setNodeMarkup(selection.from, undefined, {
      ...(state.doc.nodeAt(selection.from)?.attrs ?? {}),
      ...attrs,
    }));
    this.selectedImgWidth.set(attrs.width);
    this.imgWidthPx.set(attrs.width ?? '');
    this.saveStatus.set('unsaved');
  }

  onImgWidthChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value.trim();
    const px = val ? parseInt(val, 10) : null;
    if (px && px > 0) {
      this.setImgWidth(px);
    } else if (!val) {
      this.setImgWidth(null);
    }
  }

  goBack(): void {
    this.router.navigate(['/files']);
  }
}
