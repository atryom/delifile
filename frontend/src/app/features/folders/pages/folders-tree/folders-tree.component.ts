import {
  Component, inject, signal, computed, OnInit, ChangeDetectionStrategy, viewChild, ElementRef,
} from '@angular/core';
import { forkJoin } from 'rxjs';
import { DatePipe } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { OrganizationApiService } from '../../../../core/api/organization-api.service';
import { SharedFoldersApiService } from '../../../../core/api/shared-folders-api.service';
import { FilesApiService, FileFilter } from '../../../../core/api/files-api.service';
import { FileUploadService } from '../../../files/services/file-upload.service';
import { UrlFilesApiService } from '../../../../core/api/url-files-api.service';
import { DocumentsApiService } from '../../../../core/api/documents-api.service';
import {
  SharedFolder, FileListItem, SharedFolderFileItem,
  Tag, FileTypeGroup, LinkPreview,
} from '../../../../shared/models/api.models';
import { SharedFolderAccessDialogComponent } from '../../../shared-folders/dialogs/access/shared-folder-access-dialog.component';
import { ThreadCommentsComponent } from '../../../../shared/components/thread-comments/thread-comments.component';
import { formatSize } from '../../../../shared/utils/format';
import { classifyMimeType } from '../../../../shared/utils/file';

interface SharedFolderMoveItem { folder: SharedFolder; depth: number; }

function buildSharedFolderMoveTree(folders: SharedFolder[]): SharedFolderMoveItem[] {
  const result: SharedFolderMoveItem[] = [];
  function walk(parentId: string | null, depth: number): void {
    for (const f of folders) {
      if ((f.parent_id ?? null) === parentId) {
        result.push({ folder: f, depth });
        walk(f.id, depth + 1);
      }
    }
  }
  walk(null, 0);
  const placed = new Set(result.map(r => r.folder.id));
  for (const f of folders) {
    if (!placed.has(f.id)) result.push({ folder: f, depth: 0 });
  }
  return result;
}

interface Breadcrumb {
  label: string;
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
  private readonly uploadSvc    = inject(FileUploadService);
  private readonly urlFilesApi  = inject(UrlFilesApiService);
  private readonly router       = inject(Router);
  private readonly route        = inject(ActivatedRoute);
  private readonly fb           = inject(FormBuilder);
  private readonly docsApi      = inject(DocumentsApiService);

  readonly creatingDoc    = signal(false);
  readonly showNoteInput  = signal(false);
  noteCreateValue         = '';
  private readonly noteNameInputEl = viewChild<ElementRef<HTMLInputElement>>('noteNameInput');

  // ── Navigation ─────────────────────────────────────────────────────────────
  readonly breadcrumbs           = signal<Breadcrumb[]>([]);
  readonly currentSharedFolderId = signal<string | null>(null);

  // ── View mode ─────────────────────────────────────────────────────────────
  readonly viewMode = signal<'table' | 'grid'>('table');

  // ── Filters panel ─────────────────────────────────────────────────────────
  readonly filtersOpen         = signal(false);
  readonly activeFiltersCount  = computed(() => {
    let n = 0;
    if (this.activeFilter()    !== 'all')  n++;
    if (this.activeTagId())                n++;
    if (this.sortBy()          !== 'date') n++;
    if (this.sortOrder()       !== 'desc') n++;
    if (this.activeTypeGroup())            n++;
    return n;
  });

  // ── Shared folders ────────────────────────────────────────────────────────
  readonly sfLoading      = signal(false);
  readonly sharedFolders  = signal<SharedFolder[]>([]);
  readonly sfSubfolders   = signal<SharedFolder[]>([]);
  readonly sfSubsLoading  = signal(false);

  // ── Files ─────────────────────────────────────────────────────────────────
  private readonly rawFiles = signal<AnyFile[]>([]);
  readonly filesLoading     = signal(false);
  readonly page             = signal(1);
  readonly totalPages       = signal(1);

  // Client-side filtering for shared folder files (is_owner); personal root files are filtered server-side
  readonly files = computed<AnyFile[]>(() => {
    const raw = this.rawFiles();
    if (this.currentSharedFolderId() === null) return raw;
    const f = this.activeFilter();
    if (f === 'mine')     return raw.filter(file => (file as SharedFolderFileItem).is_owner === true);
    if (f === 'received') return raw.filter(file => (file as SharedFolderFileItem).is_owner !== true);
    return raw;
  });

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

  // ── Shared folder discussion ──────────────────────────────────────────────
  readonly folderNotesOpen = signal(false);

  // ── Create folder ─────────────────────────────────────────────────────────
  readonly creating = signal(false);
  createNameValue = '';
  private readonly createNameInput = viewChild<ElementRef<HTMLInputElement>>('createNameInput');

  // ── Rename ────────────────────────────────────────────────────────────────
  readonly renamingId   = signal<string | null>(null);
  readonly renameType   = signal<'local' | 'shared'>('shared');
  renameNameValue = '';

  // ── Delete ────────────────────────────────────────────────────────────────
  readonly deleteTarget = signal<{ id: string; name: string; kind: 'shared-folder' | 'file' } | null>(null);
  readonly deleteError  = signal<string | null>(null);
  readonly deleting     = signal(false);

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

  readonly sharedFoldersMoveList = signal<SharedFolder[]>([]);
  readonly sharedFoldersMoveTree = computed(() => buildSharedFolderMoveTree(this.sharedFoldersMoveList()));

  // ── Bulk delete ───────────────────────────────────────────────────────────
  readonly bulkDeleteDialogOpen = signal(false);
  readonly deletingBulk         = signal(false);

  // ── Add modal ─────────────────────────────────────────────────────────────
  readonly addModalOpen = signal(false);
  readonly addModalTab  = signal<'file' | 'link' | 'note'>('file');
  readonly isDragOver   = signal(false);
  readonly linkPreview  = signal<LinkPreview | null>(null);
  readonly linkError    = signal<string | null>(null);
  readonly previewing   = signal(false);
  readonly savingLink   = signal(false);

  readonly linkForm = this.fb.group({
    url: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]],
  });

  // ── Filter definitions ────────────────────────────────────────────────────
  private readonly sharedRootFilters: { key: FileFilter; label: string }[] = [
    { key: 'all',      label: 'Все' },
    { key: 'mine',     label: 'Мои' },
    { key: 'received', label: 'Полученные' },
  ];

  readonly currentFilters = computed(() => this.sharedRootFilters);

  // ── Type groups ───────────────────────────────────────────────────────────
  readonly typeGroups: { key: FileTypeGroup; label: string }[] = [
    { key: 'image',    label: 'Изображения' },
    { key: 'video',    label: 'Видео' },
    { key: 'audio',    label: 'Аудио' },
    { key: 'document', label: 'Документы' },
    { key: 'archive',  label: 'Архивы' },
    { key: 'link',     label: 'Ссылки' },
    { key: 'note',     label: 'Заметки' },
    { key: 'other',    label: 'Прочее' },
  ];

  readonly visibleTypeGroups = computed(() =>
    this.typeGroups.filter(g => this.availableTypeGroups().includes(g.key))
  );

  // ── Derived state ─────────────────────────────────────────────────────────
  readonly filteredSharedFolders = computed<SharedFolder[]>(() => this.sharedFolders());

  readonly isLoading = computed(() => this.filesLoading() || this.sfLoading());

  readonly isEmpty = computed(() => {
    if (this.isLoading()) return false;
    if (this.currentSharedFolderId() === null) {
      return this.filteredSharedFolders().length === 0 && this.files().length === 0;
    }
    return this.sfSubfolders().length === 0 && this.files().length === 0;
  });

  readonly showFilesArea = computed(() => true);

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;
    const deepSharedId = qp.get('shared_folder_id');
    const tagId = qp.get('tag_id');

    if (tagId) this.activeTagId.set(tagId);

    this.breadcrumbs.set([{ label: 'Папки', sharedFolderId: null }]);
    this.loadTags();

    if (deepSharedId) {
      this.sfLoading.set(true);
      this.sfApi.listAll().subscribe({
        next: (res) => {
          this.sharedFolders.set(res.data.items.filter(f => !f.parent_id));
          this.sfLoading.set(false);
          this.restoreSharedFolderPath(res.data.items, deepSharedId);
        },
        error: () => { this.sfLoading.set(false); this.loadShared(); },
      });
    } else {
      this.loadShared();
      this.loadFiles();
    }
  }

  // ── Breadcrumb navigation ─────────────────────────────────────────────────
  navigateToBreadcrumb(index: number): void {
    const crumb = this.breadcrumbs()[index];
    this.breadcrumbs.set(this.breadcrumbs().slice(0, index + 1));
    this.currentSharedFolderId.set(crumb.sharedFolderId);
    this.folderNotesOpen.set(false);
    this.resetFiltersKeepTag();
    this.syncUrl();
    this.loadFiles();
    if (crumb.sharedFolderId) {
      this.loadSfSubfolders(crumb.sharedFolderId);
    } else {
      this.sfSubfolders.set([]);
    }
  }

  // ── Folder navigation ─────────────────────────────────────────────────────
  navigateIntoSharedFolder(folder: SharedFolder): void {
    this.currentSharedFolderId.set(folder.id);
    this.folderNotesOpen.set(false);
    this.breadcrumbs.update(c => [...c, { label: folder.name, sharedFolderId: folder.id }]);
    this.closeMenu();
    this.resetFiltersKeepTag();
    this.syncUrl();
    this.loadSharedFolderFiles(folder.id);
    this.loadSfSubfolders(folder.id);
  }

  isSharedFolderOwner(): boolean {
    const sfId = this.currentSharedFolderId();
    if (!sfId) return false;
    return this.sharedFolders().find(f => f.id === sfId)?.is_owner ?? false;
  }

  // ── URL sync ──────────────────────────────────────────────────────────────
  private syncUrl(): void {
    const sfId = this.currentSharedFolderId();
    const params: Record<string, string> = {};
    if (sfId) params['shared_folder_id'] = sfId;
    this.router.navigate([], { relativeTo: this.route, queryParams: params, replaceUrl: true });
  }

  // ── Data loading ──────────────────────────────────────────────────────────
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

  loadFiles(): void {
    const sfId = this.currentSharedFolderId();
    if (sfId !== null) {
      this.loadSharedFolderFiles(sfId);
      return;
    }
    // At root — personal files with no folder
    this.filesLoading.set(true);
    this.filesApi.list(
      this.activeFilter(),
      this.page(),
      this.searchQuery || undefined,
      {
        tag_id:          this.activeTagId()     || undefined,
        folder_id:       null,
        file_type_group: this.activeTypeGroup() || undefined,
        sort_by:         this.sortBy(),
        sort_order:      this.sortOrder(),
        per_page:        20,
      }
    ).subscribe({
      next: (res) => {
        this.rawFiles.set(res.data.items);
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
        this.rawFiles.set(res.data.items);
        const p = res.data.pagination;
        this.totalPages.set(Math.ceil(p.total / p.per_page) || 1);
        if (p.available_type_groups) this.availableTypeGroups.set(p.available_type_groups);
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
    // Inside a shared folder filtering is done client-side via computed; no server reload needed
    if (this.currentSharedFolderId() === null) {
      this.loadFiles();
    }
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

  resetAllFilters(): void {
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
    this.loadFiles();
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
    setTimeout(() => this.createNameInput()?.nativeElement.focus(), 0);
  }

  cancelCreate(): void {
    this.creating.set(false);
    this.createNameValue = '';
  }

  saveCreate(): void {
    const name = this.createNameValue.trim();
    if (!name) return;
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

  // ── Rename ────────────────────────────────────────────────────────────────
  startRename(id: string, type: 'local' | 'shared', name: string): void {
    this.renamingId.set(id);
    this.renameType.set(type);
    this.renameNameValue = name;
    this.cancelCreate();
    this.closeMenu();
  }

  cancelRename(): void { this.renamingId.set(null); }

  saveRename(id: string, _type: 'local' | 'shared'): void {
    const name = this.renameNameValue.trim();
    if (!name) { this.cancelRename(); return; }
    this.sfApi.update(id, name).subscribe({
      next: () => {
        this.cancelRename();
        const parentId = this.currentSharedFolderId();
        if (parentId) {
          this.loadSfSubfolders(parentId);
        } else {
          this.loadShared();
        }
      },
      error: (err) => alert(err.message ?? 'Ошибка'),
    });
  }

  // ── Delete ────────────────────────────────────────────────────────────────
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

    if (target.kind === 'shared-folder') {
      this.sfApi.delete(target.id).subscribe({
        next: () => {
          this.deleting.set(false);
          this.deleteTarget.set(null);
          const parentId = this.currentSharedFolderId();
          if (parentId) {
            this.loadSfSubfolders(parentId);
          } else {
            this.loadShared();
          }
        },
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
        this.rawFiles.set([]);
        this.loadShared();
        this.breadcrumbs.set([{ label: 'Папки', sharedFolderId: null }]);
      },
      error: (err) => { this.leaving.set(false); this.leaveError.set(err.message ?? 'Ошибка'); },
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
    if (sfId) {
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

  // ── Create document ───────────────────────────────────────────────────────
  startNoteCreate(event?: Event): void {
    event?.stopPropagation();
    this.showNoteInput.set(true);
    this.noteCreateValue = '';
    this.cancelCreate();
    this.closeMenu();
    setTimeout(() => this.noteNameInputEl()?.nativeElement.focus(), 0);
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
        const docId = res.data.document.id;
        const sfId  = this.currentSharedFolderId();
        const navigate = () => {
          this.creatingDoc.set(false);
          this.router.navigate(['/files', docId], { queryParams: { editor: 'expanded' } });
        };
        if (sfId) {
          this.sfApi.addFile(sfId, docId).subscribe({ next: navigate, error: navigate });
        } else {
          navigate();
        }
      },
      error: () => this.creatingDoc.set(false),
    });
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
    if (sfId) {
      this.uploadSvc.upload(file, { sharedFolderId: sfId }).subscribe({
        next: () => { this.closeAddModal(); this.loadFiles(); },
        error: () => {},
      });
      return;
    }
    this.uploadSvc.upload(file, undefined).subscribe({
      next: () => { this.closeAddModal(); this.loadFiles(); },
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

    if (sfId) {
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
      next: () => { this.savingLink.set(false); this.closeAddModal(); this.loadFiles(); },
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
      this.sfApi.listAll().subscribe({
        next: (res) => this.sharedFoldersMoveList.set(res.data.items),
        error: () => {},
      });
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
    this.sfApi.listAll().subscribe({
      next: (res) => this.sharedFoldersMoveList.set(res.data.items),
      error: () => {},
    });
  }

  executeBulkMove(): void {
    const targetFolderId = this.moveDialogFolderId();
    const ids            = this.moveDialogTargetIds();
    if (ids.length === 0 || this.movingFiles() || !targetFolderId) return;
    this.movingFiles.set(true);

    const sourceFolderId = this.currentSharedFolderId();
    if (sourceFolderId) {
      const ops = ids.flatMap(id => [
        this.sfApi.removeFile(sourceFolderId, id),
        this.sfApi.addFile(targetFolderId, id),
      ]);
      forkJoin(ops).subscribe({
        next: () => {
          this.movingFiles.set(false);
          this.moveDialogOpen.set(false);
          const movedSet = new Set(ids);
          this.rawFiles.update(fs => fs.filter(f => !movedSet.has(f.id)));
          this.clearSelection();
        },
        error: () => { this.movingFiles.set(false); },
      });
    } else {
      forkJoin(ids.map(id => this.sfApi.addFile(targetFolderId, id, true))).subscribe({
        next: () => {
          this.movingFiles.set(false);
          this.moveDialogOpen.set(false);
          const movedSet = new Set(ids);
          this.rawFiles.update(fs => fs.filter(f => !movedSet.has(f.id)));
          this.clearSelection();
        },
        error: () => { this.movingFiles.set(false); },
      });
    }
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

  // ── Utilities ─────────────────────────────────────────────────────────────
  readonly formatSize = formatSize;

  fileIconType(file: AnyFile): string {
    return classifyMimeType(file.content_kind, file.mime_type);
  }

  fileDisplayName(file: AnyFile): string {
    if (file.content_kind === 'url_file') return file.link_title || file.original_name;
    return (file as { display_name?: string | null }).display_name || file.original_name;
  }

  private restoreSharedFolderPath(allFolders: SharedFolder[], targetId: string): void {
    const path = this.findSharedFolderPath(allFolders, targetId);
    if (!path.length) { this.loadShared(); return; }

    const crumbs: Breadcrumb[] = [{ label: 'Папки', sharedFolderId: null }];
    for (const folder of path) {
      crumbs.push({ label: folder.name, sharedFolderId: folder.id });
    }
    this.breadcrumbs.set(crumbs);

    const target = path[path.length - 1];
    this.currentSharedFolderId.set(target.id);
    this.loadSharedFolderFiles(target.id);
    this.loadSfSubfolders(target.id);
  }

  private findSharedFolderPath(allFolders: SharedFolder[], targetId: string): SharedFolder[] {
    const byId = new Map(allFolders.map(f => [f.id, f]));
    const path: SharedFolder[] = [];
    let current = byId.get(targetId);
    while (current) {
      path.unshift(current);
      if (!current.parent_id) break;
      current = byId.get(current.parent_id);
    }
    return path;
  }

  // ── Privacy ───────────────────────────────────────────────────────────────
  toggleFilePrivacy(file: AnyFile): void {
    const folderId = this.currentSharedFolderId();
    if (!folderId) return;
    const current = (file as SharedFolderFileItem).is_private ?? false;
    const next = !current;
    this.sfApi.setFilePrivacy(folderId, file.id, next).subscribe({
      next: () => {
        this.rawFiles.update(list =>
          list.map(f => f.id === file.id ? { ...f, is_private: next } : f)
        );
      },
    });
    this.closeMenu();
  }

  toggleFolderPrivacy(folder: SharedFolder): void {
    const next = !folder.is_private;
    this.sfApi.setFolderPrivacy(folder.id, next).subscribe({
      next: (res) => {
        const updated = res.data?.folder;
        if (updated) {
          this.sfSubfolders.update(list => list.map(f => f.id === folder.id ? updated : f));
        }
      },
    });
    this.closeMenu();
  }
}
