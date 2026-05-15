import {
  Component, inject, signal, computed, OnInit, ChangeDetectionStrategy,
} from '@angular/core';
import { forkJoin, Observable, of, from, switchMap } from 'rxjs';
import { HttpClient, HttpEventType, HttpEvent } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { OrganizationApiService } from '../../../../core/api/organization-api.service';
import { SharedFoldersApiService } from '../../../../core/api/shared-folders-api.service';
import { FilesApiService, FileFilter } from '../../../../core/api/files-api.service';
import { TariffApiService } from '../../../../core/api/tariff-api.service';
import { FileUploadService } from '../../../files/services/file-upload.service';
import { VideoThumbnailService } from '../../../files/services/video-thumbnail.service';
import { UrlFilesApiService } from '../../../../core/api/url-files-api.service';
import {
  FolderTreeNode, SharedFolder, FileListItem, SharedFolderFileItem,
  Tag, TariffUsage, FileTypeGroup, LinkPreview, InitUploadRequest,
} from '../../../../shared/models/api.models';

const PLAN_FILE_LIMITS: Record<string, number> = {
  free:   50  * 1024 * 1024,
  silver: 100 * 1024 * 1024,
  gold:   150 * 1024 * 1024,
};
import { SharedFolderAccessDialogComponent } from '../../../shared-folders/dialogs/access/shared-folder-access-dialog.component';
import { ThreadCommentsComponent } from '../../../../shared/components/thread-comments/thread-comments.component';
import { AuthStateService } from '../../../../core/auth/auth-state.service';

interface Breadcrumb {
  label: string;
  localFolderId: string | null;
  sharedFolderId: string | null;
}

type AnyFile = FileListItem | SharedFolderFileItem;

@Component({
  selector: 'app-folders-tree',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, ReactiveFormsModule, TranslateModule, SharedFolderAccessDialogComponent, ThreadCommentsComponent],
  templateUrl: './folders-tree.component.html',
  styleUrl: './folders-tree.component.scss',
  host: {},
})
export class FoldersTreeComponent implements OnInit {
  private readonly orgApi      = inject(OrganizationApiService);
  private readonly sfApi       = inject(SharedFoldersApiService);
  private readonly filesApi    = inject(FilesApiService);
  private readonly tariffApi    = inject(TariffApiService);
  private readonly uploadSvc    = inject(FileUploadService);
  private readonly urlFilesApi  = inject(UrlFilesApiService);
  private readonly thumbnailSvc = inject(VideoThumbnailService);
  private readonly http         = inject(HttpClient);
  private readonly router       = inject(Router);
  private readonly route        = inject(ActivatedRoute);
  private readonly fb           = inject(FormBuilder);
  private readonly authState    = inject(AuthStateService);

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
  readonly sfLoading      = signal(false);
  readonly sharedFolders  = signal<SharedFolder[]>([]);
  readonly sfSubfolders   = signal<SharedFolder[]>([]);
  readonly sfSubsLoading  = signal(false);

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

  // ── Local folder private notes / shared folder discussion ────────────────
  readonly folderNotesOpen = signal(false);

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

  // ── Leave shared folder ───────────────────────────────────────────────────
  readonly leaveTarget  = signal<{ id: string; name: string } | null>(null);
  readonly leaveError   = signal<string | null>(null);
  readonly leaving      = signal(false);

  // ── Dropdown menu ─────────────────────────────────────────────────────────
  readonly openMenuId = signal<string | null>(null);

  // ── Access dialog ─────────────────────────────────────────────────────────
  readonly sfAccessFolderId   = signal<string | null>(null);
  readonly sfAccessFolderName = signal('');

  // ── Upload state ──────────────────────────────────────────────────────────
  readonly uploadState = this.uploadSvc.state;

  // ── Shared folder upload state ────────────────────────────────────────────
  readonly sfUploadPhase    = signal<'idle' | 'uploading' | 'done' | 'error'>('idle');
  readonly sfUploadProgress = signal(0);
  readonly sfUploadError    = signal<string | null>(null);

  // ── Multi-select ──────────────────────────────────────────────────────────
  readonly selectedFileIds   = signal<ReadonlySet<string>>(new Set<string>());
  readonly selectedCount     = computed(() => this.selectedFileIds().size);
  readonly allFilesSelected  = computed(() => {
    const files = this.files();
    if (files.length === 0) return false;
    return files.every(f => this.selectedFileIds().has(f.id));
  });
  readonly someFilesSelected = computed(
    () => this.selectedCount() > 0 && !this.allFilesSelected()
  );
  readonly selectedCountLabel = computed(() => {
    const n = this.selectedCount();
    const word = n === 1 ? 'файл' : n >= 2 && n <= 4 ? 'файла' : 'файлов';
    return `Выделено ${n} ${word}`;
  });

  // ── Bulk action ───────────────────────────────────────────────────────────
  readonly bulkAction = signal<'tag' | 'move' | 'delete' | ''>('');

  // ── Tag dialog ────────────────────────────────────────────────────────────
  readonly tagDialogOpen      = signal(false);
  readonly tagDialogTargetIds = signal<string[]>([]);
  readonly tagDialogTagId     = signal<string>('');
  readonly applyingTag        = signal(false);
  readonly creatingTag        = signal(false);
  newTagInputValue            = '';
  readonly tagDialogCountText = computed(() => {
    const n = this.tagDialogTargetIds().length;
    return n === 1 ? '1 файл' : n >= 2 && n <= 4 ? `${n} файла` : `${n} файлов`;
  });

  // ── Move dialog ───────────────────────────────────────────────────────────
  readonly moveDialogOpen      = signal(false);
  readonly moveDialogTargetIds = signal<string[]>([]);
  readonly moveDialogFolderId  = signal<string | null>(null);
  readonly movingFiles         = signal(false);
  readonly moveDialogCountText = computed(() => {
    const n = this.moveDialogTargetIds().length;
    return n === 1 ? '1 файл' : n >= 2 && n <= 4 ? `${n} файла` : `${n} файлов`;
  });

  // ── Bulk delete ───────────────────────────────────────────────────────────
  readonly bulkDeleteDialogOpen = signal(false);
  readonly deletingBulk         = signal(false);

  // ── Flattened local folder tree (for move dialog) ─────────────────────────
  readonly flattenedFolders = computed(() => this.flattenTree(this.fullTree(), 0));

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
    return this.sfSubfolders().length === 0 && this.files().length === 0;
  });

  readonly showFilesArea = computed(() =>
    this.activeTab() === 'local' || this.currentSharedFolderId() !== null
  );

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    const qp  = this.route.snapshot.queryParamMap;
    const tab: 'local' | 'shared' = qp.get('tab') === 'shared' ? 'shared' : 'local';
    const deepSharedId = qp.get('shared_folder_id');
    const tagId = qp.get('tag_id');

    if (tagId) this.activeTagId.set(tagId);

    this.activeTab.set(tab);
    this.breadcrumbs.set([{
      label: tab === 'local' ? 'Локальные' : 'Общие',
      localFolderId: null,
      sharedFolderId: null,
    }]);
    this.loadLocal();
    this.loadTags();
    this.loadUsage();

    if (tab === 'shared' && deepSharedId) {
      this.sfLoading.set(true);
      this.sfApi.list().subscribe({
        next: (res) => {
          this.sharedFolders.set(res.data.items);
          this.sfLoading.set(false);
          const target = res.data.items.find(f => f.id === deepSharedId);
          if (target) this.navigateIntoSharedFolder(target);
        },
        error: () => this.sfLoading.set(false),
      });
    } else {
      this.loadShared();
      if (tab === 'local') this.loadFiles();
    }
  }

  // ── Tab switch ────────────────────────────────────────────────────────────
  setTab(tab: 'local' | 'shared'): void {
    if (this.activeTab() === tab) return;
    this.activeTab.set(tab);
    this.currentLocalFolderId.set(null);
    this.currentSharedFolderId.set(null);
    this.sfSubfolders.set([]);
    this.folderNotesOpen.set(false);
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
    this.folderNotesOpen.set(false);
    this.resetFiltersKeepTag();
    this.loadFiles();
    if (crumb.sharedFolderId) {
      this.loadSfSubfolders(crumb.sharedFolderId);
    } else {
      this.sfSubfolders.set([]);
    }
  }

  // ── Folder navigation ─────────────────────────────────────────────────────
  navigateIntoLocalFolder(folder: FolderTreeNode): void {
    this.currentLocalFolderId.set(folder.id);
    this.folderNotesOpen.set(false);
    this.breadcrumbs.update(c => [...c, {
      label: folder.name,
      localFolderId: folder.id,
      sharedFolderId: null,
    }]);
    this.closeMenu();
    this.resetFiltersKeepTag();
    this.loadFiles();
  }

  navigateIntoSharedFolder(folder: SharedFolder): void {
    this.currentSharedFolderId.set(folder.id);
    this.folderNotesOpen.set(false);
    this.breadcrumbs.update(c => [...c, {
      label: folder.name,
      localFolderId: null,
      sharedFolderId: folder.id,
    }]);
    this.closeMenu();
    this.resetFiltersKeepTag();
    this.loadSharedFolderFiles(folder.id);
    this.loadSfSubfolders(folder.id);
  }

  isSharedFolderOwner(): boolean {
    const sfId = this.currentSharedFolderId();
    if (!sfId) return false;
    return this.sharedFolders().find(f => f.id === sfId)?.is_owner ?? false;
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
        folder_id:       this.currentLocalFolderId(),
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

  private loadSfSubfolders(sfId: string): void {
    this.sfSubsLoading.set(true);
    this.sfApi.getSubfolders(sfId).subscribe({
      next: (res) => { this.sfSubfolders.set(res.data.items); this.sfSubsLoading.set(false); },
      error: () => { this.sfSubfolders.set([]); this.sfSubsLoading.set(false); },
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
    this.clearSelection();
  }

  private resetFiltersKeepTag(): void {
    this.activeFilter.set('all');
    this.activeTypeGroup.set('');
    this.sortBy.set('date');
    this.sortOrder.set('desc');
    this.searchQuery = '';
    this.page.set(1);
    this.totalPages.set(1);
    this.availableTypeGroups.set([]);
    this.clearSelection();
  }

  goToPage(p: number): void {
    this.page.set(p);
    this.clearSelection();
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
      const parentId = this.currentSharedFolderId();
      if (parentId) {
        this.sfApi.createSubfolder(parentId, name).subscribe({
          next: () => { this.cancelCreate(); this.loadSfSubfolders(parentId); },
          error: (err) => alert(err.message ?? 'Ошибка создания папки'),
        });
      } else {
        this.sfApi.create(name).subscribe({
          next: () => { this.cancelCreate(); this.loadShared(); },
          error: (err) => alert(err.message ?? 'Ошибка создания папки'),
        });
      }
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
      const sfId = this.currentSharedFolderId();
      if (sfId) {
        this.sfApi.removeFile(sfId, target.id).subscribe({
          next: () => { this.deleting.set(false); this.deleteTarget.set(null); this.loadFiles(); },
          error: (err) => { this.deleting.set(false); this.deleteError.set(err.message ?? 'Ошибка'); },
        });
      } else {
        this.filesApi.delete(target.id).subscribe({
          next: () => { this.deleting.set(false); this.deleteTarget.set(null); this.loadFiles(); },
          error: (err) => { this.deleting.set(false); this.deleteError.set(err.message ?? 'Ошибка'); },
        });
      }
    }
  }

  // ── Leave shared folder ───────────────────────────────────────────────────
  confirmLeaveSharedFolder(folder: SharedFolder): void {
    this.leaveTarget.set({ id: folder.id, name: folder.name });
    this.leaveError.set(null);
    this.closeMenu();
  }

  cancelLeave(): void { this.leaveTarget.set(null); this.leaveError.set(null); }

  executeLeave(): void {
    const target = this.leaveTarget();
    if (!target || this.leaving()) return;
    this.leaving.set(true);
    this.leaveError.set(null);
    this.sfApi.leaveFolder(target.id).subscribe({
      next: () => {
        this.leaving.set(false);
        this.leaveTarget.set(null);
        this.currentSharedFolderId.set(null);
        this.sfSubfolders.set([]);
        this.files.set([]);
        this.loadShared();
        this.breadcrumbs.set([{ label: 'Общие', localFolderId: null, sharedFolderId: null }]);
      },
      error: (err) => { this.leaving.set(false); this.leaveError.set(err.message ?? 'Ошибка'); },
    });
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
    const sfId = this.currentSharedFolderId();
    if (this.activeTab() === 'shared' && sfId) {
      this.router.navigate(['/files', file.id], {
        queryParams: { from: 'shared-folder', folder_id: sfId },
      });
    } else {
      this.router.navigate(['/files', file.id]);
    }
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
    this.sfUploadPhase.set('idle');
    this.sfUploadProgress.set(0);
    this.sfUploadError.set(null);
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
      this.uploadToSharedFolder(file, sfId);
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

  private uploadToSharedFolder(file: File, sfId: string): void {
    const plan = this.authState.plan() ?? 'free';
    const limitBytes = PLAN_FILE_LIMITS[plan] ?? PLAN_FILE_LIMITS['free'];
    if (file.size > limitBytes) {
      const mb = Math.round(limitBytes / 1024 / 1024);
      this.sfUploadError.set(`Размер файла превышает лимит тарифа (${mb} МБ)`);
      this.sfUploadPhase.set('error');
      return;
    }

    this.sfUploadPhase.set('uploading');
    this.sfUploadProgress.set(0);
    this.sfUploadError.set(null);

    const isVideo = file.type.startsWith('video/');
    const prep$: Observable<{ file: File; blob: Blob; objectUrl: string } | null> = isVideo
      ? from(this.thumbnailSvc.generateFromFile(file).catch(() => null))
      : of(null);

    prep$.pipe(
      switchMap((thumb) => {
        const req: InitUploadRequest = {
          original_name: file.name,
          size: file.size,
          mime_type: file.type || 'application/octet-stream',
        };
        if (thumb) {
          req.thumbnail_name = thumb.file.name;
          req.thumbnail_size = thumb.blob.size;
          req.thumbnail_mime = 'image/jpeg';
        }
        return this.sfApi.initUpload(sfId, req).pipe(
          switchMap((initRes) => {
            if (initRes.result !== 'success') throw new Error(initRes.message);
            const fileId = initRes.data.file.id;
            const thumbInfo = initRes.data.thumbnail;

            const thumbUpload$: Observable<unknown> = thumb && thumbInfo
              ? this.http.put(thumbInfo.url, thumb.blob, { headers: thumbInfo.headers, withCredentials: false })
              : of(null);

            return thumbUpload$.pipe(
              switchMap(() => this.http.put(initRes.data.upload.url, file, {
                headers: initRes.data.upload.headers,
                reportProgress: true,
                observe: 'events',
                withCredentials: false,
              }) as Observable<HttpEvent<unknown>>),
              switchMap((evt) => {
                if (evt.type === HttpEventType.UploadProgress) {
                  const pe = evt as { loaded: number; total?: number };
                  this.sfUploadProgress.set(pe.total ? Math.round(100 * pe.loaded / pe.total) : 0);
                }
                if (evt.type !== HttpEventType.Response) return of(null);
                return this.sfApi.completeUpload(sfId, fileId, thumbInfo?.key);
              }),
            );
          }),
        );
      }),
    ).subscribe({
      next: (res) => {
        if (!res) return;
        this.sfUploadPhase.set('done');
        this.closeAddModal();
        this.loadFiles();
      },
      error: (err: Error) => {
        this.sfUploadError.set(err.message ?? 'Ошибка загрузки');
        this.sfUploadPhase.set('error');
      },
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

  // ── Multi-select ──────────────────────────────────────────────────────────
  toggleFileSelection(id: string): void {
    const next = new Set(this.selectedFileIds());
    if (next.has(id)) next.delete(id); else next.add(id);
    this.selectedFileIds.set(next);
  }

  toggleAllFiles(): void {
    const files = this.files();
    if (files.every(f => this.selectedFileIds().has(f.id))) {
      this.selectedFileIds.set(new Set());
    } else {
      this.selectedFileIds.set(new Set(files.map(f => f.id)));
    }
  }

  clearSelection(): void { this.selectedFileIds.set(new Set()); }

  // ── Bulk action ───────────────────────────────────────────────────────────
  onBulkActionChange(event: Event): void {
    this.bulkAction.set((event.target as HTMLSelectElement).value as 'tag' | 'move' | 'delete' | '');
  }

  openBulkAction(): void {
    const action = this.bulkAction();
    const ids = [...this.selectedFileIds()];
    if (!action || ids.length === 0) return;
    if (action === 'tag') {
      this.tagDialogTargetIds.set(ids);
      this.tagDialogTagId.set('');
      this.tagDialogOpen.set(true);
    } else if (action === 'move') {
      this.moveDialogTargetIds.set(ids);
      this.moveDialogFolderId.set(null);
      this.moveDialogOpen.set(true);
    } else {
      this.bulkDeleteDialogOpen.set(true);
    }
  }

  // ── Tag dialog ────────────────────────────────────────────────────────────
  openTagDialogForFile(file: AnyFile): void {
    this.tagDialogTargetIds.set([file.id]);
    this.tagDialogTagId.set('');
    this.tagDialogOpen.set(true);
    this.closeMenu();
  }

  onTagDialogChange(event: Event): void {
    this.tagDialogTagId.set((event.target as HTMLSelectElement).value);
  }

  executeBulkTag(): void {
    const tagId = this.tagDialogTagId();
    const ids   = this.tagDialogTargetIds();
    if (!tagId || ids.length === 0 || this.applyingTag()) return;
    this.applyingTag.set(true);
    forkJoin(ids.map(id => this.orgApi.attachTags(id, [tagId]))).subscribe({
      next: () => {
        this.applyingTag.set(false);
        this.tagDialogOpen.set(false);
        this.clearSelection();
        this.loadFiles();
      },
      error: () => { this.applyingTag.set(false); },
    });
  }

  createAndAssignTag(): void {
    const name = this.newTagInputValue.trim();
    if (!name || this.creatingTag()) return;
    this.creatingTag.set(true);
    this.orgApi.createTag(name).subscribe({
      next: (res) => {
        const newTag = res.data.tag;
        this.tags.update(tags => [...tags, newTag]);
        this.tagDialogTagId.set(newTag.id);
        this.newTagInputValue = '';
        this.creatingTag.set(false);
      },
      error: () => { this.creatingTag.set(false); },
    });
  }

  // ── Move dialog ───────────────────────────────────────────────────────────
  openMoveDialogForFile(file: AnyFile): void {
    this.moveDialogTargetIds.set([file.id]);
    this.moveDialogFolderId.set(null);
    this.moveDialogOpen.set(true);
    this.closeMenu();
  }

  executeBulkMove(): void {
    const folderId = this.moveDialogFolderId();
    const ids      = this.moveDialogTargetIds();
    if (ids.length === 0 || this.movingFiles()) return;
    this.movingFiles.set(true);
    forkJoin(ids.map(id => this.filesApi.moveFolder(id, folderId))).subscribe({
      next: () => {
        this.movingFiles.set(false);
        this.moveDialogOpen.set(false);
        const movedSet = new Set(ids);
        this.files.update(fs => fs.filter(f => !movedSet.has(f.id)));
        this.clearSelection();
        this.loadLocal();
      },
      error: () => { this.movingFiles.set(false); },
    });
  }

  // ── Bulk delete ───────────────────────────────────────────────────────────
  executeBulkDelete(): void {
    const ids = [...this.selectedFileIds()];
    if (ids.length === 0 || this.deletingBulk()) return;
    this.deletingBulk.set(true);
    forkJoin(ids.map(id => this.filesApi.delete(id))).subscribe({
      next: () => {
        this.deletingBulk.set(false);
        this.bulkDeleteDialogOpen.set(false);
        this.clearSelection();
        this.loadFiles();
      },
      error: () => { this.deletingBulk.set(false); },
    });
  }

  // ── Flatten folder tree ───────────────────────────────────────────────────
  private flattenTree(nodes: FolderTreeNode[], depth: number): { folder: FolderTreeNode; depth: number }[] {
    const result: { folder: FolderTreeNode; depth: number }[] = [];
    for (const node of nodes) {
      result.push({ folder: node, depth });
      result.push(...this.flattenTree(node.children, depth + 1));
    }
    return result;
  }

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
    return (file as { display_name?: string | null }).display_name || file.original_name;
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
