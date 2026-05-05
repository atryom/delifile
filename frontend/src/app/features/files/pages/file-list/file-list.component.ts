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
import { FileListItem, FileTypeGroup, Tag, FolderTreeNode, LinkPreview } from '../../../../shared/models/api.models';

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

  readonly files              = signal<FileListItem[]>([]);
  readonly loading            = signal(false);
  readonly page               = signal(1);
  readonly totalPages         = signal(1);
  readonly activeFilter       = signal<FileFilter>('all');
  readonly isDragOver         = signal(false);
  readonly uploadState        = this.uploadService.state;
  readonly uploadDone         = computed(() => this.uploadState().phase === 'done');
  readonly tags               = signal<Tag[]>([]);
  readonly flatFolders        = signal<{ id: string; name: string }[]>([]);
  readonly activeTagId        = signal<string>('');
  readonly activeFolderId     = signal<string>('');
  readonly activeTypeGroup    = signal<string>('');
  readonly sortBy             = signal<'date' | 'extension' | 'size'>('date');
  readonly sortOrder          = signal<'asc' | 'desc'>('desc');
  readonly availableTypeGroups = signal<FileTypeGroup[]>([]);

  readonly previewing   = signal(false);
  readonly savingLink   = signal(false);
  readonly linkPreview  = signal<LinkPreview | null>(null);
  readonly linkError    = signal<string | null>(null);

  searchQuery = '';
  private searchTimer?: ReturnType<typeof setTimeout>;

  readonly linkForm = this.fb.group({ url: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]] });

  readonly filters = [
    { key: 'all' as FileFilter,       label: 'files.list.filter_all' },
    { key: 'mine' as FileFilter,      label: 'files.list.filter_my' },
    { key: 'received' as FileFilter,  label: 'files.list.filter_received' },
    { key: 'favorites' as FileFilter, label: 'files.list.filter_favorites' },
  ];

  readonly typeGroups = [
    { key: 'image' as FileTypeGroup,    label: 'files.list.type_image',    icon: '🖼️' },
    { key: 'video' as FileTypeGroup,    label: 'files.list.type_video',    icon: '🎬' },
    { key: 'audio' as FileTypeGroup,    label: 'files.list.type_audio',    icon: '🎵' },
    { key: 'document' as FileTypeGroup, label: 'files.list.type_document', icon: '📄' },
    { key: 'archive' as FileTypeGroup,  label: 'files.list.type_archive',  icon: '🗜️' },
    { key: 'link' as FileTypeGroup,     label: 'files.list.type_link',     icon: '🔗' },
    { key: 'other' as FileTypeGroup,    label: 'files.list.type_other',    icon: '📎' },
  ];

  readonly visibleTypeGroups = computed(() =>
    this.typeGroups.filter(g => this.availableTypeGroups().includes(g.key))
  );

  readonly emptyMessage = computed(() => {
    const q = this.searchQuery;
    if (q) return this.translate.instant('files.list.empty_search', { q });
    const f = this.activeFilter();
    if (f === 'received')  return this.translate.instant('files.list.empty_shared');
    if (f === 'favorites') return this.translate.instant('files.list.empty_favorites');
    if (f === 'all')       return this.translate.instant('files.list.empty_all');
    return this.translate.instant('files.list.empty_default');
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
    this.activeTypeGroup.set('');
    this.page.set(1);
    this.loadFiles();
  }

  setTypeGroup(key: string): void {
    this.activeTypeGroup.set(this.activeTypeGroup() === key ? '' : key);
    this.page.set(1);
    this.loadFiles();
  }

  onSortByChange(event: Event): void {
    this.sortBy.set((event.target as HTMLSelectElement).value as 'date' | 'extension' | 'size');
    this.page.set(1);
    this.loadFiles();
  }

  onSortOrderChange(event: Event): void {
    this.sortOrder.set((event.target as HTMLSelectElement).value as 'asc' | 'desc');
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
    const tagId     = this.activeTagId() || undefined;
    const folderId  = this.activeFolderId() || undefined;
    const typeGroup = this.activeTypeGroup() || undefined;

    this.filesApi.list(
      this.activeFilter(),
      this.page(),
      this.searchQuery || undefined,
      {
        tag_id: tagId,
        folder_id: folderId,
        file_type_group: typeGroup,
        sort_by: this.sortBy(),
        sort_order: this.sortOrder(),
        per_page: 10,
      }
    ).subscribe({
      next: (res) => {
        this.files.set(res.data.items);
        const p = res.data.pagination;
        this.totalPages.set(Math.ceil(p.total / p.per_page) || 1);
        if (p.available_type_groups) {
          this.availableTypeGroups.set(p.available_type_groups);
        }
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
  resetUpload(): void { this.uploadService.reset(); }

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
