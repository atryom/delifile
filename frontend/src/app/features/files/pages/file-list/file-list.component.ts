import {
  Component, inject, signal, computed, OnInit, effect, ChangeDetectionStrategy, viewChild, ElementRef,
} from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FilesApiService } from '../../../../core/api/files-api.service';
import { formatSize } from '../../../../shared/utils/format';
import { DocumentsApiService } from '../../../../core/api/documents-api.service';
import { FileUploadService } from '../../services/file-upload.service';
import { UrlFilesApiService } from '../../../../core/api/url-files-api.service';
import { FileTypeIconComponent } from '../../../../shared/components/file-type-icon/file-type-icon.component';
import { FileListItem, FileCard, LinkPreview } from '../../../../shared/models/api.models';
import { FileUpdatesService } from '../../../../core/services/file-updates.service';
import { CreateFileRequestDialogComponent } from '../../../file-requests/dialogs/create-file-request/create-file-request-dialog.component';

@Component({
  selector: 'app-file-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, FormsModule, ReactiveFormsModule, TranslateModule, FileTypeIconComponent, CreateFileRequestDialogComponent],
  templateUrl: './file-list.component.html',
  styleUrl: './file-list.component.scss',
})
export class FileListComponent implements OnInit {
  private readonly filesApi      = inject(FilesApiService);
  private readonly docsApi       = inject(DocumentsApiService);
  private readonly uploadService = inject(FileUploadService);
  private readonly urlFilesApi   = inject(UrlFilesApiService);
  private readonly translate     = inject(TranslateService);
  private readonly router        = inject(Router);
  private readonly fb            = inject(FormBuilder);
  private readonly fileUpdates   = inject(FileUpdatesService);

  constructor() {
    effect(() => {
      const update = this.fileUpdates.lastRename();
      if (!update) return;
      this.recentFiles.update(list =>
        list.map(f => f.id === update.id ? { ...f, display_name: update.display_name, original_name: update.original_name } : f)
      );
    });
  }

  readonly creatingDoc   = signal(false);
  readonly showNoteInput = signal(false);
  noteCreateValue        = '';
  private readonly noteNameInputRef = viewChild<ElementRef<HTMLInputElement>>('noteNameInput');

  readonly recentFiles    = signal<FileListItem[]>([]);
  readonly recentLoading  = signal(false);
  readonly newlyAddedFile = signal<FileCard | null>(null);
  newFileDescription      = '';

  readonly isDragOver           = signal(false);
  readonly uploadState          = this.uploadService.state;
  readonly showFileRequestDialog = signal(false);

  readonly previewing        = signal(false);
  readonly savingLink        = signal(false);
  readonly linkPreview       = signal<LinkPreview | null>(null);
  readonly linkError         = signal<string | null>(null);
  readonly savingDescription = signal(false);

  readonly linkForm = this.fb.group({
    url: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]],
  });

  readonly uploadInProgress = computed(() => {
    const p = this.uploadState().phase;
    return p !== 'idle' && p !== 'done' && p !== 'error';
  });

  readonly phaseLabel = computed(() => {
    const p = this.uploadState().phase;
    return p === 'init'       ? this.translate.instant('files.upload.preparing')
         : p === 'uploading'  ? this.translate.instant('files.upload.uploading')
         : p === 'completing' ? this.translate.instant('files.upload.finalizing')
         : '';
  });

  ngOnInit(): void {
    this.loadRecentFiles();
  }

  loadRecentFiles(): void {
    this.recentLoading.set(true);
    this.filesApi.list('all', 1, undefined, {
      sort_by: 'date', sort_order: 'desc', per_page: 10,
    }).subscribe({
      next: (res) => { this.recentFiles.set(res.data.items); this.recentLoading.set(false); },
      error: () => this.recentLoading.set(false),
    });
  }

  // ─── Upload ───────────────────────────────────────────────────────────────

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) this.startUpload(input.files[0]);
    input.value = '';
  }

  onDragOver(e: DragEvent): void { e.preventDefault(); this.isDragOver.set(true); }
  onDragLeave(): void { this.isDragOver.set(false); }
  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.isDragOver.set(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) this.startUpload(file);
  }

  private startUpload(file: File): void {
    this.uploadService.upload(file).subscribe({
      next: () => {
        const fileId = this.uploadState().fileId;
        if (fileId) {
          this.filesApi.get(fileId).subscribe(res => {
            this.newlyAddedFile.set(res.data.file);
            this.newFileDescription = res.data.file.description ?? '';
            this.loadRecentFiles();
          });
        }
        this.uploadService.reset();
      },
    });
  }

  cancelUpload(): void {
    const id = this.uploadState().fileId;
    if (id) this.uploadService.cancel(id);
  }

  resetUpload(): void { this.uploadService.reset(); }

  startNoteCreate(): void {
    this.showNoteInput.set(true);
    this.noteCreateValue = '';
    setTimeout(() => this.noteNameInputRef()?.nativeElement.focus(), 0);
  }

  cancelNoteCreate(): void {
    this.showNoteInput.set(false);
    this.noteCreateValue = '';
  }

  saveNoteCreate(): void {
    const name = this.noteCreateValue.trim();
    if (!name) return;
    this.showNoteInput.set(false);
    this.creatingDoc.set(true);
    this.docsApi.create(name).subscribe({
      next: res => {
        this.creatingDoc.set(false);
        this.router.navigate(['/files', res.data.document.id], { queryParams: { editor: 'expanded' } });
      },
      error: () => this.creatingDoc.set(false),
    });
  }

  fileRoute(file: FileListItem): string[] {
    return ['/files', file.id];
  }

  openFile(file: FileListItem): void {
    this.router.navigate(this.fileRoute(file));
  }

  // ─── Add Link ─────────────────────────────────────────────────────────────

  previewLink(): void {
    const url = this.linkForm.getRawValue().url!;
    this.previewing.set(true);
    this.linkPreview.set(null);
    this.linkError.set(null);
    this.urlFilesApi.preview(url).subscribe({
      next: (res) => { this.linkPreview.set(res.data.preview); this.previewing.set(false); },
      error: () => { this.previewing.set(false); this.linkError.set('Не удалось получить превью'); },
    });
  }

  saveLink(): void {
    if (this.linkForm.invalid || this.savingLink()) return;
    this.savingLink.set(true);
    this.linkError.set(null);
    this.urlFilesApi.create(this.linkForm.getRawValue().url!).subscribe({
      next: (res) => {
        this.newlyAddedFile.set(res.data.file);
        this.newFileDescription = res.data.file.description ?? '';
        this.linkForm.reset();
        this.linkPreview.set(null);
        this.savingLink.set(false);
        this.loadRecentFiles();
      },
      error: (err) => {
        this.savingLink.set(false);
        this.linkError.set(err.message ?? this.translate.instant('files.add_link.error'));
      },
    });
  }

  // ─── Newly added file ─────────────────────────────────────────────────────

  saveDescription(): void {
    const file = this.newlyAddedFile();
    if (!file || this.savingDescription()) return;
    this.savingDescription.set(true);
    this.filesApi.updateDescription(file.id, this.newFileDescription || null).subscribe({
      next: () => this.savingDescription.set(false),
      error: () => this.savingDescription.set(false),
    });
  }

  dismissNewlyAdded(): void { this.newlyAddedFile.set(null); }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  formatSize(bytes: number): string { return formatSize(bytes, 'en'); }
}
