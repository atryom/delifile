import {
  Component, inject, signal, computed, OnInit, ChangeDetectionStrategy,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { OrganizationApiService } from '../../../../core/api/organization-api.service';
import { SharedFoldersApiService } from '../../../../core/api/shared-folders-api.service';
import { FilesApiService, FileFilter } from '../../../../core/api/files-api.service';
import { TariffApiService } from '../../../../core/api/tariff-api.service';
import { FileUploadService } from '../../../files/services/file-upload.service';
import { UrlFilesApiService } from '../../../../core/api/url-files-api.service';
import {
  FolderTreeNode, SharedFolder, FileListItem, SharedFolderFileItem,
  Tag, TariffUsage, FileTypeGroup, LinkPreview,
} from '../../../../shared/models/api.models';
import { SharedFolderAccessDialogComponent } from '../../../shared-folders/dialogs/access/shared-folder-access-dialog.component';

interface Breadcrumb {
  label: string;
  localFolderId: string | null;
  sharedFolderId: string | null;
}

type AnyFile = FileListItem | SharedFolderFileItem;

@Component({
  selector: 'app-folders-tree',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, ReactiveFormsModule, SharedFolderAccessDialogComponent],
  templateUrl: './folders-tree.component.html',
  styleUrl: './folders-tree.component.scss',
  host: { '[class.theme-dark]': 'theme() === "dark"' },
})
export class FoldersTreeComponent implements OnInit {
  private readonly orgApi      = inject(OrganizationApiService);
  private readonly sfApi       = inject(SharedFoldersApiService);
  private readonly filesApi    = inject(FilesApiService);
  private readonly tariffApi   = inject(TariffApiService);
  private readonly uploadSvc   = inject(FileUploadService);
  private readonly urlFilesApi = inject(UrlFilesApiService);
  private readonly router      = inject(Router);
  private readonly route       = inject(ActivatedRoute);
  private readonly fb          = inject(FormBuilder);

  // ── Theme ─────────────────────────────────────────────────────────────────
  readonly theme = signal<'light' | 'dark'>('light');

  // ── Tab & navigation ─────────────────────────────────────────────────────
  readonly activeTab             = signal<'local' | 'shared'>('local');
  readonly breadcrumbs           = signal<Breadcrumb[]>([]);
  readonly currentLocalFolderId  = signal<string | null>(null);
  readonly currentSharedFolderId = signal<string | null>(null);

  // ── View mode ─────────────────────────────────────────────────────────────
  readonly viewMode = signal<'table' | 'grid'>('table');

  // ── Local folder tree ─────────────────────────────────────────────────────
  readonly treeLoading = signal(true);
  readonly fullTree    = signal<FolderTreeNode[]>([]);

  readonly currentSubFolders = computed<FolderTreeNode[]>(() => {
    const cid = this.currentLocalFolderId();
    if (cid === null) return this.fullTree();
    return this.findNodeById(this.fullTree(), cid)?.children ?? [];
  });

  // ── Shared folders ────────────────────────────────────────────────────────
  readonly sfLoading     = signal(false);
  readonly sharedFolders = signal<SharedFolder[]>([]);

  // ── Files ─────────────────────────────────────────────────────────────────
  readonly files        = signal<AnyFile[]>([]);
  readonly filesLoading = signal(false);
  readonly page         = signal(1);
  readonly totalPages   = signal(1);

  // ── Filters ───────────────────────────────────────────────────────────────
  readonly activeFilter        = signal<FileFilter>('all');
  readonly tags                = signal<Tag[]>([]);
  readonly activeTagId         = signal<string>('');
  readonly sortBy              = signal<'date' | 'extension' | 'size'>('date');
  readonly sortOrder           = signal<'asc' | 'desc'>('desc');
  readonly activeTypeGroup     = signal<string>('');
  readonly availableTypeGroups = signal<FileTypeGroup[]>([]);
  searchQuery = '';
  private searchTimer?: ReturnType<typeof setTimeout>;

  // ── Storage ───────────────────────────────────────────────────────────────
  readonly usage = signal<TariffUsage | null>(null);

  // ── Create folder ─────────────────────────────────────────────────────────
  readonly creating = signal(false);
  createNameValue = '';

  // ── Rename ────────────────────────────────────────────────────────────────
  readonly renamingId   = signal<string | null>(null);
  readonly renameType   = signal<'local' | 'shared'>('local');
  renameNameValue = '';

  // ── Delete ────────────────────────────────────────────────────────────────
  readonly deleteTarget      = signal<{ id: string; name: string; kind: 'local-folder' | 'shared-folder' | 'file' } | null>(null);
  readonly forceDeleteTarget = signal<{ id: string; name: string } | null>(null);
  readonly deleteError       = signal<string | null>(null);
  readonly deleting          = signal(false);

  // ── Dropdown menu ─────────────────────────────────────────────────────────
  readonly openMenuId = signal<string | null>(null);

  // ── Access dialog ─────────────────────────────────────────────────────────
  readonly sfAccessFolderId   = signal<string | null>(null);
  readonly sfAccessFolderName = signal('');

  // ── Upload state ──────────────────────────────────────────────────────────
  readonly uploadState = this.uploadSvc.state;

  // ── Add modal ─────────────────────────────────────────────────────────────
  readonly addModalOpen = signal(false);
  readonly addModalTab  = signal<'file' | 'link'>('file');
  readonly isDragOver   = signal(false);
  readonly linkPreview  = signal<LinkPreview | null>(null);
  readonly linkError    = signal<string | null>(null);
  readonly previewing   = signal(false);
  readonly savingLink   = signal(false);

  readonly linkForm = this.fb.group({
    url: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]],
  });

  // ── Filter definitions ────────────────────────────────────────────────────
  private readonly localFilters: { key: FileFilter; label: string }[] = [
    { key: 'all',       label: 'Все' },
    { key: 'mine',      label: 'Мои Файлы' },
    { key: 'received',  label: 'Полученные' },
    { key: 'favorites', label: 'Избранные' },
  ];

  private readonly sharedRootFilters: { key: FileFilter; label: string }[] = [
    { key: 'all',      label: 'Все' },
    { key: 'mine',     label: 'Мои' },
    { key: 'received', label: 'Полученные' },
  ];

  readonly currentFilters = computed(() =>
    this.activeTab() === 'local' ? this.localFilters : this.sharedRootFilters
  );

  // ── Type groups ───────────────────────────────────────────────────────────
  readonly typeGroups: { key: FileTypeGroup; label: string }[] = [
    { key: 'image',    label: 'Изображения' },
    { key: 'video',    label: 'Видео' },
    { key: 'audio',    label: 'Аудио' },
    { key: 'document', label: 'Документы' },
    { key: 'archive',  label: 'Архивы' },
    { key: 'link',     label: 'Ссылки' },
    { key: 'other',    label: 'Прочее' },
  ];

  readonly visibleTypeGroups = computed(() =>
    this.typeGroups.filter(g => this.availableTypeGroups().includes(g.key))
  );

  // ── Derived state ─────────────────────────────────────────────────────────
  readonly storageText = computed(() => {
    const u = this.usage();
    if (!u) return '—';
    const used  = (u.storage_used_bytes  / (1024 * 1024 * 1024)).toFixed(2);
    const limit = (u.storage_limit_bytes / (1024 * 1024 * 1024)).toFixed(1);
    return `${used} / ${limit}`;
  });

  readonly filteredSharedFolders = computed<SharedFolder[]>(() => {
    const all = this.sharedFolders();
    const f   = this.activeFilter();
    if (f === 'mine')     return all.filter(s => s.is_owner);
    if (f === 'received') return all.filter(s => !s.is_owner);
    return all;
  });

  readonly isLoading = computed(() =>
    this.treeLoading() || this.filesLoading() || this.sfLoading()
  );

  readonly isEmpty = computed(() => {
    if (this.isLoading()) return false;
    if (this.activeTab() === 'local') {
      return this.currentSubFolders().length === 0 && this.files().length === 0;
    }
    if (this.currentSharedFolderId() === null) {
      return this.filteredSharedFolders().length === 0;
    }
    return this.files().length === 0;
  });

  readonly showFilesArea = computed(() =>
    this.activeTab() === 'local' || this.currentSharedFolderId() !== null
  );

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    const tab: 'local' | 'shared' =
      this.route.snapshot.queryParamMap.get('tab') === 'shared' ? 'shared' : 'local';
    this.activeTab.set(tab);
    this.breadcrumbs.set([{
      label: tab === 'local' ? 'Локальные' : 'Общие',
      localFolderId: null,
      sharedFolderId: null,
    }]);
    this.loadLocal();
    this.loadShared();
    this.loadTags();
    this.loadUsage();
    if (tab === 'local') this.loadFiles();
  }

  // ── Tab switch ────────────────────────────────────────────────────────────
  setTab(tab: 'local' | 'shared'): void {
    if (this.activeTab() === tab) return;
    this.activeTab.set(tab);
    this.currentLocalFolderId.set(null);
    this.currentSharedFolderId.set(null);
    this.breadcrumbs.set([{
      label: tab === 'local' ? 'Локальные' : 'Общие',
      localFolderId: null,
      sharedFolderId: null,
    }]);
    this.resetFilters();
    this.files.set([]);
    if (tab === 'local') this.loadFiles();
  }

  // ── Breadcrumb navigation ─────────────────────────────────────────────────
  navigateToBreadcrumb(index: number): void {
    const crumb = this.breadcrumbs()[index];
    this.breadcrumbs.set(this.breadcrumbs().slice(0, index + 1));
    this.currentLocalFolderId.set(crumb.localFolderId);
    this.currentSharedFolderId.set(crumb.sharedFolderId);
    this.resetFilters();
    this.loadFiles();
  }

  // ── Folder navigation ─────────────────────────────────────────────────────
  navigateIntoLocalFolder(folder: FolderTreeNode): void {
    this.currentLocalFolderId.set(folder.id);
    this.breadcrumbs.update(c => [...c, {
      label: folder.name,
      localFolderId: folder.id,
      sharedFolderId: null,
    }]);
    this.closeMenu();
    this.resetFilters();
    this.loadFiles();
  }

  navigateIntoSharedFolder(folder: SharedFolder): void {
    this.currentSharedFolderId.set(folder.id);
    this.breadcrumbs.update(c => [...c, {
      label: folder.name,
      localFolderId: null,
      sharedFolderId: folder.id,
    }]);
    this.closeMenu();
    this.resetFilters();
    this.loadSharedFolderFiles(folder.id);
  }

  // ── Data loading ──────────────────────────────────────────────────────────
  private loadLocal(): void {
    this.treeLoading.set(true);
    this.orgApi.getFolderTree().subscribe({
      next: (res) => { this.fullTree.set(res.data.items); this.treeLoading.set(false); },
      error: () => this.treeLoading.set(false),
    });
  }

  private loadShared(): void {
    this.sfLoading.set(true);
    this.sfApi.list().subscribe({
      next: (res) => { this.sharedFolders.set(res.data.items); this.sfLoading.set(false); },
      error: () => this.sfLoading.set(false),
    });
  }

  private loadTags(): void {
    this.orgApi.getTags().subscribe({
      next: (res) => this.tags.set(res.data.items),
      error: () => {},
    });
  }

  private loadUsage(): void {
    this.tariffApi.getUsage().subscribe({
      next: (res) => this.usage.set(res.data),
      error: () => {},
    });
  }

  loadFiles(): void {
    const sfId = this.currentSharedFolderId();
    if (this.activeTab() === 'shared') {
      if (sfId === null) { this.files.set([]); return; }
      this.loadSharedFolderFiles(sfId);
      return;
    }
    this.filesLoading.set(true);
    this.filesApi.list(
      this.activeFilter(),
      this.page(),
      this.searchQuery || undefined,
      {
        tag_id:          this.activeTagId()          || undefined,
        folder_id:       this.currentLocalFolderId() || undefined,
        file_type_group: this.activeTypeGroup()      || undefined,
        sort_by:         this.sortBy(),
        sort_order:      this.sortOrder(),
        per_page:        20,
      }
    ).subscribe({
      next: (res) => {
        this.files.set(res.data.items);
        const p = res.data.pagination;
        this.totalPages.set(Math.ceil(p.total / p.per_page) || 1);
        if (p.available_type_groups) this.availableTypeGroups.set(p.available_type_groups);
        this.filesLoading.set(false);
      },
      error: () => this.filesLoading.set(false),
    });
  }

  private loadSharedFolderFiles(sfId: string): void {
    this.filesLoading.set(true);
    this.sfApi.listFiles(sfId, this.page()).subscribe({
      next: (res) => {
        this.files.set(res.data.items);
        const p = res.data.pagination;
        this.totalPages.set(Math.ceil(p.total / p.per_page) || 1);
        this.filesLoading.set(false);
      },
      error: () => this.filesLoading.set(false),
    });
  }

  // ── Filter handlers ───────────────────────────────────────────────────────
  setFilter(f: FileFilter): void {
    this.activeFilter.set(f);
    this.page.set(1);
    this.loadFiles();
  }

  onTagFilter(event: Event): void {
    this.activeTagId.set((event.target as HTMLSelectElement).value);
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

  setTypeGroup(key: string): void {
    this.activeTypeGroup.set(this.activeTypeGroup() === key ? '' : key);
    this.page.set(1);
    this.loadFiles();
  }

  onSearchChange(_: string): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.page.set(1); this.loadFiles(); }, 350);
  }

  private resetFilters(): void {
    this.activeFilter.set('all');
    this.activeTagId.set('');
    this.activeTypeGroup.set('');
    this.sortBy.set('date');
    this.sortOrder.set('desc');
    this.searchQuery = '';
    this.page.set(1);
    this.totalPages.set(1);
    this.availableTypeGroups.set([]);
  }

  goToPage(p: number): void {
    this.page.set(p);
    this.loadFiles();
  }

  // ── Create folder ─────────────────────────────────────────────────────────
  startCreate(event?: Event): void {
    event?.stopPropagation();
    this.creating.set(true);
    this.createNameValue = '';
    this.cancelRename();
    this.closeMenu();
  }

  cancelCreate(): void {
    this.creating.set(false);
    this.createNameValue = '';
  }

  saveCreate(): void {
    const name = this.createNameValue.trim();
    if (!name) return;
    if (this.activeTab() === 'local') {
      this.orgApi.createFolder({ name, parent_id: this.currentLocalFolderId() }).subscribe({
        next: () => { this.cancelCreate(); this.loadLocal(); },
        error: (err) => alert(err.message ?? 'Ошибка создания папки'),
      });
    } else {
      this.sfApi.create(name).subscribe({
        next: () => { this.cancelCreate(); this.loadShared(); },
        error: (err) => alert(err.message ?? 'Ошибка создания папки'),
      });
    }
  }

  // ── Rename ────────────────────────────────────────────────────────────────
  startRename(id: string, type: 'local' | 'shared', name: string): void {
    this.renamingId.set(id);
    this.renameType.set(type);
    this.renameNameValue = name;
    this.cancelCreate();
    this.closeMenu();
  }

  cancelRename(): void { this.renamingId.set(null); }

  saveRename(id: string, type: 'local' | 'shared'): void {
    const name = this.renameNameValue.trim();
    if (!name) { this.cancelRename(); return; }
    if (type === 'local') {
      this.orgApi.updateFolder(id, { name }).subscribe({
        next: () => { this.cancelRename(); this.loadLocal(); },
        error: (err) => alert(err.message ?? 'Ошибка'),
      });
    } else {
      this.sfApi.update(id, name).subscribe({
        next: () => { this.cancelRename(); this.loadShared(); },
        error: (err) => alert(err.message ?? 'Ошибка'),
      });
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  confirmDeleteLocalFolder(folder: FolderTreeNode): void {
    this.deleteTarget.set({ id: folder.id, name: folder.name, kind: 'local-folder' });
    this.deleteError.set(null);
    this.closeMenu();
  }

  confirmDeleteSharedFolder(folder: SharedFolder): void {
    this.deleteTarget.set({ id: folder.id, name: folder.name, kind: 'shared-folder' });
    this.deleteError.set(null);
    this.closeMenu();
  }

  confirmDeleteFile(file: AnyFile): void {
    this.deleteTarget.set({ id: file.id, name: file.original_name, kind: 'file' });
    this.deleteError.set(null);
    this.closeMenu();
  }

  cancelDelete(): void {
    this.deleteTarget.set(null);
    this.deleteError.set(null);
  }

  executeDelete(): void {
    const target = this.deleteTarget();
    if (!target || this.deleting()) return;
    this.deleting.set(true);
    this.deleteError.set(null);

    if (target.kind === 'local-folder') {
      this.orgApi.deleteFolder(target.id, false).subscribe({
        next: () => { this.deleting.set(false); this.deleteTarget.set(null); this.loadLocal(); },
        error: (err) => {
          this.deleting.set(false);
          if (err.data?.code === 'HAS_FILES') {
            this.forceDeleteTarget.set({ id: target.id, name: target.name });
            this.deleteTarget.set(null);
          } else {
            this.deleteError.set(err.message ?? 'Ошибка');
          }
        },
      });
    } else if (target.kind === 'shared-folder') {
      this.sfApi.delete(target.id).subscribe({
        next: () => { this.deleting.set(false); this.deleteTarget.set(null); this.loadShared(); },
        error: (err) => { this.deleting.set(false); this.deleteError.set(err.message ?? 'Ошибка'); },
      });
    } else {
      this.filesApi.delete(target.id).subscribe({
        next: () => { this.deleting.set(false); this.deleteTarget.set(null); this.loadFiles(); },
        error: (err) => { this.deleting.set(false); this.deleteError.set(err.message ?? 'Ошибка'); },
      });
    }
  }

  forceDeleteLocalFolder(): void {
    const target = this.forceDeleteTarget();
    if (!target || this.deleting()) return;
    this.deleting.set(true);
    this.orgApi.deleteFolder(target.id, true).subscribe({
      next: () => { this.deleting.set(false); this.forceDeleteTarget.set(null); this.loadLocal(); },
      error: (err) => { this.deleting.set(false); this.deleteError.set(err.message ?? 'Ошибка'); },
    });
  }

  // ── Dropdown menu ─────────────────────────────────────────────────────────
  toggleMenu(id: string, event: Event): void {
    event.stopPropagation();
    this.openMenuId.set(this.openMenuId() === id ? null : id);
  }

  closeMenu(): void { this.openMenuId.set(null); }

  // ── File actions ──────────────────────────────────────────────────────────
  openFileDetail(file: AnyFile): void {
    this.router.navigate(['/files', file.id]);
    this.closeMenu();
  }

  downloadFile(file: AnyFile): void {
    if (file.content_kind === 'url_file') {
      if (file.link_url) window.open(file.link_url, '_blank', 'noopener');
      this.closeMenu();
      return;
    }
    this.filesApi.download(file.id).subscribe({
      next: (res) => {
        const a = document.createElement('a');
        a.href = res.data.url;
        a.download = file.original_name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      },
      error: () => {},
    });
    this.closeMenu();
  }

  favoriteFile(file: AnyFile): void {
    this.filesApi.favorite(file.id).subscribe({ error: () => {} });
    this.closeMenu();
  }

  // ── Add modal ─────────────────────────────────────────────────────────────
  openAddModal(event?: Event): void {
    event?.stopPropagation();
    this.addModalOpen.set(true);
    this.addModalTab.set('file');
    this.linkForm.reset();
    this.linkPreview.set(null);
    this.linkError.set(null);
    this.uploadSvc.reset();
    this.closeMenu();
  }

  closeAddModal(): void {
    this.addModalOpen.set(false);
    this.linkPreview.set(null);
    this.linkError.set(null);
    this.uploadSvc.reset();
  }

  // ── Upload ────────────────────────────────────────────────────────────────
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;
    input.value = '';
    this.uploadFile(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.uploadFile(file);
  }

  private uploadFile(file: File): void {
    const sfId = this.currentSharedFolderId();
    if (this.activeTab() === 'shared' && sfId) {
      this.router.navigate(['/shared-folders'], { queryParams: { folder_id: sfId } });
      this.closeAddModal();
      return;
    }
    this.uploadSvc.upload(file).subscribe({
      next: (fileId) => {
        const folderId = this.currentLocalFolderId();
        const done = () => { this.closeAddModal(); this.loadFiles(); };
        if (folderId) {
          this.filesApi.moveFolder(fileId, folderId).subscribe({ next: done, error: done });
        } else {
          done();
        }
      },
      error: () => {},
    });
  }

  // ── Link save ─────────────────────────────────────────────────────────────
  previewLink(): void {
    const url = this.linkForm.getRawValue().url!;
    if (!url) return;
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
    const url = this.linkForm.getRawValue().url!;
    this.savingLink.set(true);
    this.linkError.set(null);

    const sfId = this.currentSharedFolderId();
    if (this.activeTab() === 'shared' && sfId) {
      const preview = this.linkPreview();
      const previewArg = preview ? {
        title: preview.title ?? null,
        image_url: preview.image_url ?? null,
        site_name: preview.site_name ?? null,
      } : null;
      this.sfApi.addUrlFile(sfId, url, previewArg).subscribe({
        next: () => { this.savingLink.set(false); this.closeAddModal(); this.loadFiles(); },
        error: (err) => { this.savingLink.set(false); this.linkError.set(err.message ?? 'Ошибка'); },
      });
      return;
    }

    this.urlFilesApi.create(url).subscribe({
      next: (res) => {
        this.savingLink.set(false);
        const fileId   = res.data.file.id;
        const folderId = this.currentLocalFolderId();
        const done = () => { this.closeAddModal(); this.loadFiles(); };
        if (folderId) {
          this.filesApi.moveFolder(fileId, folderId).subscribe({ next: done, error: done });
        } else {
          done();
        }
      },
      error: (err) => { this.savingLink.set(false); this.linkError.set(err.message ?? 'Ошибка'); },
    });
  }

  // ── Access dialog ─────────────────────────────────────────────────────────
  openAccessDialog(folder: SharedFolder): void {
    this.sfAccessFolderId.set(folder.id);
    this.sfAccessFolderName.set(folder.name);
    this.closeMenu();
  }

  closeAccessDialog(): void { this.sfAccessFolderId.set(null); }

  // ── Utilities ─────────────────────────────────────────────────────────────
  formatSize(bytes: number): string {
    if (!bytes || bytes === 0) return '—';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) return (mb / 1024).toFixed(1) + ' ГБ';
    if (mb >= 1)    return mb.toFixed(1) + ' МБ';
    return (bytes / 1024).toFixed(1) + ' КБ';
  }

  fileIconType(file: AnyFile): string {
    if (file.content_kind === 'url_file') return 'link';
    const mime = file.mime_type ?? '';
    if (mime.startsWith('image/'))  return 'image';
    if (mime.startsWith('video/'))  return 'video';
    if (mime.startsWith('audio/'))  return 'audio';
    if (mime.includes('pdf'))       return 'pdf';
    if (mime.includes('spreadsheet') || mime.includes('excel'))       return 'xlsx';
    if (mime.includes('presentation') || mime.includes('powerpoint')) return 'pptx';
    if (mime.includes('zip') || mime.includes('rar') || mime.includes('tar') || mime.includes('gzip')) return 'archive';
    return 'file';
  }

  fileDisplayName(file: AnyFile): string {
    if (file.content_kind === 'url_file') return file.link_title || file.original_name;
    return file.original_name;
  }

  private findNodeById(nodes: FolderTreeNode[], id: string): FolderTreeNode | null {
    for (const node of nodes) {
      if (node.id === id) return node;
      const found = this.findNodeById(node.children, id);
      if (found) return found;
    }
    return null;
  }
}
