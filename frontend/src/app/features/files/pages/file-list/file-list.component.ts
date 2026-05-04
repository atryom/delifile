import {
  Component, inject, signal, computed, OnInit, ChangeDetectionStrategy,
} from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FilesApiService, FileFilter } from '../../../../core/api/files-api.service';
import { FileUploadService } from '../../services/file-upload.service';
import { UrlFilesApiService } from '../../../../core/api/url-files-api.service';
import { OrganizationApiService } from '../../../../core/api/organization-api.service';
import { FileListItem, Tag, FolderTreeNode, LinkPreview } from '../../../../shared/models/api.models';

@Component({
  selector: 'app-file-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, FormsModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './file-list.component.html',
  styleUrl: './file-list.component.scss',
})
export class FileListComponent implements OnInit {
  private readonly filesApi      = inject(FilesApiService);
  private readonly uploadService = inject(FileUploadService);
  private readonly urlFilesApi   = inject(UrlFilesApiService);
  private readonly orgApi        = inject(OrganizationApiService);
  private readonly router        = inject(Router);
  private readonly route         = inject(ActivatedRoute);
  private readonly translate     = inject(TranslateService);
  private readonly fb            = inject(FormBuilder);

  readonly files        = signal<FileListItem[]>([]);
  readonly loading      = signal(false);
  readonly page         = signal(1);
  readonly totalPages   = signal(1);
  readonly activeFilter = signal<FileFilter>('mine');
  readonly isDragOver   = signal(false);
  readonly uploadState  = this.uploadService.state;
  readonly uploadDone   = computed(() => this.uploadState().phase === 'done');
  readonly tags         = signal<Tag[]>([]);
  readonly flatFolders  = signal<{ id: string; name: string }[]>([]);
  readonly activeTagId  = signal<string>('');
  readonly activeFolderId = signal<string>('');

  readonly previewing   = signal(false);
  readonly savingLink   = signal(false);
  readonly linkPreview  = signal<LinkPreview | null>(null);
  readonly linkError    = signal<string | null>(null);

  searchQuery = '';
  private searchTimer?: ReturnType<typeof setTimeout>;

  readonly linkForm = this.fb.group({ url: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]] });

  readonly filters = [
    { key: 'mine' as FileFilter,      label: 'files.list.filter_my' },
    { key: 'received' as FileFilter,  label: 'files.list.filter_received' },
    { key: 'favorites' as FileFilter, label: 'files.list.filter_favorites' },
  ];

  readonly emptyMessage = computed(() => {
    const q = this.searchQuery;
    if (q) return this.translate.instant('files.list.empty_search', { q });
    return this.activeFilter() === 'received'
      ? this.translate.instant('files.list.empty_shared')
      : this.activeFilter() === 'favorites'
      ? this.translate.instant('files.list.empty_favorites')
      : this.translate.instant('files.list.empty_default');
  });

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;
    if (qp.get('tag_id'))    this.activeTagId.set(qp.get('tag_id')!);
    if (qp.get('folder_id')) this.activeFolderId.set(qp.get('folder_id')!);

    this.loadFilters();
    this.loadFiles();
  }

  private loadFilters(): void {
    this.orgApi.getTags().subscribe(res => this.tags.set(res.data.items));
    this.orgApi.getFolderTree().subscribe(res => {
      const flat: { id: string; name: string }[] = [];
      this.flattenFolders(res.data.items, flat, '');
      this.flatFolders.set(flat);
    });
  }

  private flattenFolders(nodes: FolderTreeNode[], out: { id: string; name: string }[], prefix: string): void {
    for (const n of nodes) {
      out.push({ id: n.id, name: prefix + n.name });
      if (n.children?.length) this.flattenFolders(n.children, out, prefix + n.name + ' / ');
    }
  }

  onTagFilter(event: Event): void {
    this.activeTagId.set((event.target as HTMLSelectElement).value);
    this.page.set(1);
    this.loadFiles();
  }

  onFolderFilter(event: Event): void {
    this.activeFolderId.set((event.target as HTMLSelectElement).value);
    this.page.set(1);
    this.loadFiles();
  }

  setFilter(f: FileFilter): void {
    this.activeFilter.set(f);
    this.page.set(1);
    this.loadFiles();
  }

  onSearchChange(_: string): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.page.set(1); this.loadFiles(); }, 350);
  }

  goToPage(p: number): void { this.page.set(p); this.loadFiles(); }

  loadFiles(): void {
    this.loading.set(true);
    const tagId    = this.activeTagId() || undefined;
    const folderId = this.activeFolderId() || undefined;

    this.filesApi.list(this.activeFilter(), this.page(), this.searchQuery || undefined, { tag_id: tagId, folder_id: folderId }).subscribe({
      next: (res) => {
        this.files.set(res.data.items);
        const p = res.data.pagination;
        this.totalPages.set(Math.ceil(p.total / p.per_page) || 1);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openFile(file: FileListItem): void {
    this.router.navigate(['/files', file.id]);
  }

  quickDownload(file: FileListItem, e: Event): void {
    e.stopPropagation();
    this.filesApi.download(file.id).subscribe(res => window.open(res.data.url, '_blank'));
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
      next: () => {
        this.savingLink.set(false);
        this.linkForm.reset();
        this.linkPreview.set(null);
        this.loadFiles();
      },
      error: (err) => {
        this.savingLink.set(false);
        this.linkError.set(err.message ?? this.translate.instant('files.add_link.error'));
      },
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
    this.uploadService.upload(file).subscribe({ next: () => this.loadFiles() });
  }

  cancelUpload(): void {
    const id = this.uploadState().fileId;
    if (id) this.uploadService.cancel(id);
  }

  dismissUpload(): void { this.uploadService.reset(); }

  readonly phaseLabel = computed(() => {
    const p = this.uploadState().phase;
    return p === 'init'       ? this.translate.instant('files.upload.preparing')
         : p === 'uploading'  ? this.translate.instant('files.upload.uploading')
         : p === 'completing' ? this.translate.instant('files.upload.finalizing')
         : '';
  });

  // ─── Helpers ──────────────────────────────────────────────────────────────

  formatSize(bytes: number): string {
    if (bytes < 1024)        return `${bytes} B`;
    if (bytes < 1024 ** 2)   return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3)   return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  }

  mimeIcon(mime: string): string {
    if (mime.startsWith('image/'))        return '🖼️';
    if (mime.startsWith('video/'))        return '🎬';
    if (mime.startsWith('audio/'))        return '🎵';
    if (mime.includes('pdf'))             return '📄';
    if (mime.includes('zip') || mime.includes('tar') || mime.includes('gz')) return '🗜️';
    if (mime.includes('word') || mime.includes('document')) return '📝';
    if (mime.includes('spreadsheet') || mime.includes('excel')) return '📊';
    return '📎';
  }
}
