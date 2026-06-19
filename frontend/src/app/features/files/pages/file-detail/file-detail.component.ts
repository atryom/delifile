import { Component, inject, signal, computed, OnInit, OnDestroy, input, ChangeDetectionStrategy } from '@angular/core';
import { forkJoin } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FilesApiService } from '../../../../core/api/files-api.service';
import { DocumentsApiService } from '../../../../core/api/documents-api.service';
import { OrganizationApiService } from '../../../../core/api/organization-api.service';
import { SharedFoldersApiService } from '../../../../core/api/shared-folders-api.service';
import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { FileCard, FileVersion, ShareLink, FileAccess, ActivityLog, Tag, SharedFolder, TaskStatus } from '../../../../shared/models/api.models';
import { formatSize } from '../../../../shared/utils/format';
import { canViewInBrowser, isPlainTextFile } from '../../../../shared/utils/file';
import { ShareContactDialogComponent } from '../../dialogs/share-contact/share-contact-dialog.component';
import { CreateLinkDialogComponent } from '../../dialogs/create-link/create-link-dialog.component';
import { AddToSharedFolderDialogComponent } from '../../dialogs/add-to-shared-folder/add-to-shared-folder-dialog.component';
import { AddVersionDialogComponent } from '../../dialogs/add-version/add-version-dialog.component';
import { ThreadCommentsComponent } from '../../../../shared/components/thread-comments/thread-comments.component';
import { MarkdownEditorPanelComponent } from './markdown-editor-panel.component';
import { FileUpdatesService } from '../../../../core/services/file-updates.service';

interface FolderMoveItem { folder: SharedFolder; depth: number; }

function buildFolderMoveTree(folders: SharedFolder[]): FolderMoveItem[] {
  const result: FolderMoveItem[] = [];
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

@Component({
  selector: 'app-file-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, FormsModule, ShareContactDialogComponent, CreateLinkDialogComponent, AddToSharedFolderDialogComponent, AddVersionDialogComponent, TranslateModule, ThreadCommentsComponent, MarkdownEditorPanelComponent],
  templateUrl: './file-detail.component.html',
  styleUrl: './file-detail.component.scss',
  host: { '(document:click)': 'closeAccessPopup()' },
})
export class FileDetailComponent implements OnInit, OnDestroy {
  readonly id = input.required<string>();

  private readonly filesApi  = inject(FilesApiService);
  private readonly docsApi   = inject(DocumentsApiService);
  private readonly http      = inject(HttpClient);
  private readonly orgApi    = inject(OrganizationApiService);
  private readonly sfApi     = inject(SharedFoldersApiService);
  private readonly router    = inject(Router);
  private readonly route     = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);
  readonly authState         = inject(AuthStateService);
  private readonly fileUpdates = inject(FileUpdatesService);

  private backFolderId: string | null = null;
  readonly backLink = signal<{ commands: string[]; queryParams?: Record<string,string> }>({ commands: ['/folders'] });

  readonly file          = signal<FileCard | null>(null);
  readonly loading       = signal(false);
  readonly actionPending = signal(false);
  readonly feedback      = signal<string | null>(null);
  readonly links         = signal<ShareLink[]>([]);
  readonly accesses      = signal<FileAccess[]>([]);
  readonly accessPopupId = signal<string | null>(null);
  readonly activity      = signal<ActivityLog[]>([]);

  descriptionDraft = '';
  readonly showShareDialog             = signal(false);
  readonly showLinkDialog              = signal(false);
  readonly showAddToSharedFolderDialog = signal(false);
  readonly showAddVersionDialog        = signal(false);
  readonly addToMyFilesLoading         = signal(false);
  readonly savingDescription           = signal(false);
  readonly savingFolder                = signal(false);

  readonly allTags         = signal<Tag[]>([]);
  readonly tagSearch       = signal('');
  readonly tagSearchQuery  = signal('');
  readonly showTagPicker   = signal(false);
  readonly filteredTags    = signal<Tag[]>([]);
  readonly creatingTag     = signal(false);
  private tagPickerHovered = false;

  // ─── Comments state ───────────────────────────────────────────────────────────

  readonly showComments           = signal(true);
  readonly commentUnreadCount     = signal(0);
  readonly showActivity           = signal(false);
  readonly showVersions           = signal(false);
  readonly contextSharedFolderId  = signal<string | null>(null);

  // ─── Folder picker (tree move dialog) ────────────────────────────────────────
  readonly showFolderPickerDialog   = signal(false);
  readonly folderPickerList         = signal<SharedFolder[]>([]);
  readonly folderPickerTree         = computed(() => buildFolderMoveTree(this.folderPickerList()));
  readonly folderPickerLoading      = signal(false);
  readonly folderPickerSelectedId   = signal<string | null>(null);
  readonly folderPickerHasSelection = signal(false);
  readonly folderPickerMoving       = signal(false);
  readonly resolvedFolderName       = signal<string | null>(null);

  readonly descriptionEditorOpen  = signal(false);
  readonly editorPanelOpen        = signal(false);
  readonly editorExpanded         = signal(false);
  readonly editorRefreshTrigger   = signal(0);

  // ─── Read-only text preview (.txt, .log, .csv, …) ─────────────────────────────
  readonly isTextFile = computed<boolean>(() => {
    const f = this.file();
    return !!f && isPlainTextFile(f.mime_type, f.original_name, f.content_kind);
  });
  readonly textContent = signal<string | null>(null);
  readonly textLoading = signal(false);
  readonly textError   = signal(false);

  // ─── Versioning state ────────────────────────────────────────────────────────

  readonly selectedVersionId = signal<string | null>(null);

  readonly selectedVersion = computed<FileVersion | null>(() => {
    const versions = this.file()?.versions ?? [];
    const id = this.selectedVersionId();
    if (!id || versions.length === 0) return null;
    return versions.find(v => v.id === id) ?? null;
  });

  readonly displayTitle = computed<string>(() => {
    const f = this.file();
    if (!f) return '';
    const v = this.selectedVersion();
    if (v) return v.original_name;
    if (f.content_kind === 'url_file') {
      return f.display_name ?? f.link_title ?? f.original_name;
    }
    const name = f.display_name ?? f.original_name;
    if (f.mime_type === 'text/markdown') return name.replace(/\.md$/i, '');
    return name;
  });

  readonly displaySize = computed<number>(() => {
    return this.selectedVersion()?.size ?? this.file()?.size ?? 0;
  });

  readonly displayPreviewUrl = computed<string | null>(() => {
    const v = this.selectedVersion();
    if (v?.preview_url) return v.preview_url;
    return this.file()?.preview_url ?? null;
  });

  // Per-version edit state
  readonly editingVersionId = signal<string | null>(null);
  versionLabelDraft   = '';
  versionCommentDraft = '';
  readonly savingVersion = signal(false);

  // Display name edit (versions-only feature)
  displayNameDraft = '';
  readonly savingDisplayName = signal(false);

  // Inline title rename
  readonly renamingTitle  = signal(false);
  renameDraft             = '';
  readonly savingRename   = signal(false);

  // ─── Task state ──────────────────────────────────────────────────────────────

  readonly isTask        = computed(() => this.file()?.is_task ?? false);
  readonly taskStatus    = computed(() => this.file()?.task_status ?? null);
  readonly taskAssignee  = computed(() => this.file()?.task_assigned_user ?? null);
  readonly canEditTask   = computed(() => {
    const f = this.file();
    const u = this.authState.user();
    if (!f || !u) return false;
    return f.is_owner || (f.task_assigned_user?.id === Number(u.id));
  });
  readonly savingTask    = signal(false);
  taskStartDraft         = '';
  taskDueDraft           = '';

  readonly taskStatuses: { value: TaskStatus; labelKey: string }[] = [
    { value: 'template',     labelKey: 'tasks.status.template' },
    { value: 'in_progress',  labelKey: 'tasks.status.in_progress' },
    { value: 'under_review', labelKey: 'tasks.status.under_review' },
    { value: 'completed',    labelKey: 'tasks.status.completed' },
  ];

  ngOnInit(): void {
    const fromParam = this.route.snapshot.queryParamMap.get('from');
    const folderIdParam = this.route.snapshot.queryParamMap.get('folder_id');
    if (fromParam === 'shared-folder' && folderIdParam) {
      this.backFolderId = folderIdParam;
      this.backLink.set({ commands: ['/folders'], queryParams: { tab: 'shared', shared_folder_id: folderIdParam } });
      this.contextSharedFolderId.set(folderIdParam);
      this.sfApi.listAll().subscribe({
        next: res => {
          const found = res.data.items.find(f => f.id === folderIdParam);
          if (found) this.resolvedFolderName.set(found.name);
        },
        error: () => {},
      });
    }

    const editorParam = this.route.snapshot.queryParamMap.get('editor');
    if (editorParam === 'expanded') {
      this.editorPanelOpen.set(true);
      this.editorExpanded.set(true);
    }

    this.loadFile();
    this._startAccessPolling();
    this.orgApi.getTags().subscribe((r) => this.allTags.set(r.data.items));
  }

  loadFile(): void {
    this.loading.set(true);
    this.filesApi.get(this.id()).subscribe({
      next: (res) => {
        this.file.set(res.data.file);
        this.descriptionDraft = res.data.file.description ?? '';
        this.descriptionEditorOpen.set(!!(res.data.file.description));
        this.taskStartDraft = res.data.file.task_start_date ? this.toDatetimeLocal(res.data.file.task_start_date) : '';
        this.taskDueDraft   = res.data.file.task_due_date   ? this.toDatetimeLocal(res.data.file.task_due_date)   : '';
        this.displayNameDraft = res.data.file.display_name ?? '';
        this.loading.set(false);
        if (res.data.file.mime_type === 'text/markdown') {
          this.editorPanelOpen.set(true);
        } else if (isPlainTextFile(res.data.file.mime_type, res.data.file.original_name, res.data.file.content_kind)) {
          this.loadTextContent();
        }
        // When file lives in a shared folder and we didn't arrive from that folder via URL param,
        // set the back link and context so the folder picker knows the current location.
        const fromParam = this.route.snapshot.queryParamMap.get('from');
        if (!fromParam && res.data.file.folder_id) {
          const folderId = res.data.file.folder_id;
          this.backLink.set({ commands: ['/folders'], queryParams: { tab: 'shared', shared_folder_id: folderId } });
          if (!this.contextSharedFolderId()) {
            this.contextSharedFolderId.set(folderId);
          }
          if (!this.resolvedFolderName()) {
            this.sfApi.listAll().subscribe({
              next: r => {
                const found = r.data.items.find(f => f.id === folderId);
                if (found) this.resolvedFolderName.set(found.name);
              },
              error: () => {},
            });
          }
        }
        // Select last active version by default; fall back to first inactive if none active
        const versions = res.data.file.versions ?? [];
        if (versions.length > 0) {
          const activeVersions = versions.filter(v => v.is_active);
          const defaultVersion = activeVersions.length > 0
            ? activeVersions[activeVersions.length - 1]
            : versions[0];
          this.selectedVersionId.set(defaultVersion.id);
        } else {
          this.selectedVersionId.set(null);
        }
        this.loadSidePanels();
      },
      error: () => this.loading.set(false),
    });
  }

  loadSidePanels(): void {
    this.filesApi.listLinks(this.id()).subscribe({ next: (r) => this.links.set(r.data.items), error: () => {} });
    if (this.file()?.is_owner) {
      this.filesApi.accesses(this.id()).subscribe({ next: (r) => this.accesses.set(r.data.items), error: () => {} });
    }
    this.filesApi.activity(this.id()).subscribe({ next: (r) => this.activity.set(r.data.items), error: () => {} });
  }

  download(): void {
    const file = this.file();
    const fileName = file?.original_name;
    const selectedId = this.selectedVersionId();
    const versions   = file?.versions ?? [];
    const hasVersions = file?.has_versions;

    if (hasVersions && selectedId && versions.length > 0) {
      const latest = versions[versions.length - 1];
      if (selectedId !== latest.id) {
        this.filesApi.downloadVersion(this.id(), selectedId).subscribe((res) => {
          this.triggerDownload(res.data.url, fileName);
        });
        return;
      }
    }

    this.filesApi.download(this.id()).subscribe((res) => {
      this.triggerDownload(res.data.url, fileName);
    });
  }

  private triggerDownload(url: string, name?: string): void {
    const a = document.createElement('a');
    a.href = url;
    if (name) a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  openInBrowser(): void {
    const f = this.file();
    if (!f?.view_url) return;
    // Fetch as blob to avoid Chrome Safe Browsing warning on S3 domain
    this.http.get(f.view_url, { responseType: 'blob', withCredentials: false }).subscribe({
      next: (blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const win = window.open(blobUrl, '_blank');
        // Revoke after tab has had time to load
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
        if (!win) URL.revokeObjectURL(blobUrl);
      },
    });
  }

  canViewInBrowser(): boolean {
    const f = this.file();
    if (!f) return false;
    return canViewInBrowser(f.mime_type, f.view_url, f.content_kind);
  }

  saveDescription(): void {
    if (this.savingDescription()) return;
    const desc = this.descriptionDraft.trim() || null;
    this.savingDescription.set(true);
    this.filesApi.updateDescription(this.id(), desc).subscribe({
      next: (res) => {
        this.file.update(f => f ? { ...f, description: res.data.description } : f);
        if (!res.data.description) this.descriptionEditorOpen.set(false);
        this.savingDescription.set(false);
        this.showFeedback(this.translate.instant('files.detail.description_saved'));
      },
      error: () => this.savingDescription.set(false),
    });
  }

  copyUrlLink(): void {
    const url = this.file()?.link_url ?? '';
    navigator.clipboard.writeText(url).then(() =>
      this.showFeedback(this.translate.instant('files.detail.link_copied'))
    );
  }

  refreshLinkPreview(): void {
    if (this.actionPending()) return;
    this.actionPending.set(true);
    this.http.post<any>(`/api/v1/files/${this.id()}/refresh-link-preview`, {}).subscribe({
      next: (res) => {
        this.file.set(res.data.file);
        this.actionPending.set(false);
        this.showFeedback('Превью обновлено');
      },
      error: () => this.actionPending.set(false),
    });
  }

  togglePin(): void {
    if (!this.file()) return;
    this.actionPending.set(true);
    const isPinned = this.file()!.is_pinned;
    const req = isPinned ? this.filesApi.unpin(this.id()) : this.filesApi.pin(this.id());
    req.subscribe({
      next: () => {
        this.file.update((f) => f ? { ...f, is_pinned: !isPinned } : f);
        this.showFeedback(isPinned ? 'Откреплено' : 'Закреплено вверху списка');
        this.actionPending.set(false);
      },
      error: () => this.actionPending.set(false),
    });
  }

  toggleFavorite(): void {
    if (!this.file()) return;
    this.actionPending.set(true);
    const isFav = this.file()!.is_favorite;
    const req = isFav ? this.filesApi.unfavorite(this.id()) : this.filesApi.favorite(this.id());
    req.subscribe({
      next: () => {
        this.file.update((f) => f ? { ...f, is_favorite: !isFav } : f);
        this.showFeedback(isFav
          ? this.translate.instant('files.detail.removed_favorite')
          : this.translate.instant('files.detail.added_favorite'));
        this.actionPending.set(false);
      },
      error: () => this.actionPending.set(false),
    });
  }

  deleteFile(): void {
    const f = this.file();
    const confirmMsg = f?.is_owner
      ? this.translate.instant('files.detail.confirm_delete', { name: f.original_name })
      : `Убрать «${f?.original_name}» из ваших файлов?`;
    if (!confirm(confirmMsg)) return;
    this.actionPending.set(true);
    this.filesApi.delete(this.id()).subscribe({
      next: () => this.router.navigate(['/folders']),
      error: () => this.actionPending.set(false),
    });
  }

  readonly tagExactMatch = (): boolean => {
    const q = this.tagSearchQuery().toLowerCase();
    return this.filteredTags().some((t) => t.name.toLowerCase() === q) ||
      (this.file()?.tags ?? []).some((t) => t.name.toLowerCase() === q);
  };

  openTagPicker(): void {
    this.tagSearchQuery.set('');
    this.tagSearch.set('');
    this.filterTags('');
    this.showTagPicker.set(true);
  }

  closeTagPicker(): void {
    this.showTagPicker.set(false);
    this.tagSearchQuery.set('');
  }

  onTagInputBlur(): void {
    if (!this.tagPickerHovered) {
      setTimeout(() => this.closeTagPicker(), 150);
    }
  }

  onTagPickerMouseLeave(): void {
    this.tagPickerHovered = false;
  }

  onTagSearch(e: Event): void {
    const q = (e.target as HTMLInputElement).value;
    this.tagSearchQuery.set(q);
    this.filterTags(q);
    this.tagPickerHovered = true;
  }

  private filterTags(q: string): void {
    const current = new Set(this.file()?.tags.map((t) => t.id) ?? []);
    const lower = q.toLowerCase();
    this.filteredTags.set(
      this.allTags().filter((t) => !current.has(t.id) && t.name.toLowerCase().includes(lower))
    );
  }

  addTag(tag: Tag): void {
    this.closeTagPicker();
    this.orgApi.attachTags(this.id(), [tag.id]).subscribe({
      next: () => {
        this.file.update((f) => f ? { ...f, tags: [...f.tags, tag] } : f);
      },
      error: () => {},
    });
  }

  createAndAddTag(): void {
    const name = this.tagSearchQuery().trim();
    if (!name || this.creatingTag()) return;
    this.creatingTag.set(true);
    this.orgApi.createTag(name).subscribe({
      next: (res) => {
        const newTag = res.data.tag;
        this.allTags.update((tags) => [...tags, newTag]);
        this.creatingTag.set(false);
        this.addTag(newTag);
      },
      error: () => { this.creatingTag.set(false); },
    });
  }

  removeTag(tag: Tag): void {
    this.orgApi.detachTags(this.id(), [tag.id]).subscribe({
      next: () => {
        this.file.update((f) => f ? { ...f, tags: f.tags.filter((t) => t.id !== tag.id) } : f);
      },
      error: () => {},
    });
  }

  openFolderPicker(): void {
    this.folderPickerSelectedId.set(null);
    this.folderPickerHasSelection.set(false);
    this.showFolderPickerDialog.set(true);
    this.folderPickerLoading.set(true);
    this.sfApi.listAll().subscribe({
      next: res => {
        this.folderPickerList.set(res.data.items.filter(f => !f.is_personal_root));
        this.folderPickerLoading.set(false);
        const currentId = this.contextSharedFolderId();
        if (currentId) {
          const found = res.data.items.find(f => f.id === currentId);
          if (found) this.resolvedFolderName.set(found.name);
        }
      },
      error: () => this.folderPickerLoading.set(false),
    });
  }

  confirmFolderMove(): void {
    if (!this.folderPickerHasSelection() || this.folderPickerMoving()) return;

    const newFolderId = this.folderPickerSelectedId();
    const oldFolderId = this.contextSharedFolderId();

    if (oldFolderId === newFolderId) {
      this.showFolderPickerDialog.set(false);
      return;
    }

    this.folderPickerMoving.set(true);
    const fileId = this.id();

    if (newFolderId === null) {
      if (!oldFolderId) {
        this.folderPickerMoving.set(false);
        this.showFolderPickerDialog.set(false);
        return;
      }
      this.sfApi.removeFile(oldFolderId, fileId).subscribe({
        next: () => {
          this.contextSharedFolderId.set(null);
          this.resolvedFolderName.set(null);
          this.folderPickerMoving.set(false);
          this.showFolderPickerDialog.set(false);
          this.backLink.set({ commands: ['/folders'] });
          this.showFeedback('Файл перемещён');
        },
        error: () => this.folderPickerMoving.set(false),
      });
      return;
    }

    const newFolderName = this.folderPickerList().find(f => f.id === newFolderId)?.name ?? null;

    const finish = () => {
      this.contextSharedFolderId.set(newFolderId);
      this.resolvedFolderName.set(newFolderName);
      this.folderPickerMoving.set(false);
      this.showFolderPickerDialog.set(false);
      this.backLink.set({ commands: ['/folders'], queryParams: { tab: 'shared', shared_folder_id: newFolderId } });
      this.showFeedback('Файл перемещён');
    };

    // addFile(move=true) first sets folder_id = target, then removeFile won't clear it
    const add$ = this.sfApi.addFile(newFolderId, fileId, true);
    const op$ = oldFolderId
      ? add$.pipe(switchMap(() => this.sfApi.removeFile(oldFolderId, fileId)))
      : add$;
    op$.subscribe({
      next: () => finish(),
      error: () => this.folderPickerMoving.set(false),
    });
  }

  copyLink(url: string): void {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() =>
        this.showFeedback(this.translate.instant('files.detail.link_copied'))
      );
    } else {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        document.execCommand('copy');
        this.showFeedback(this.translate.instant('files.detail.link_copied'));
      } finally {
        document.body.removeChild(ta);
      }
    }
  }

  disableLink(link: ShareLink): void {
    this.filesApi.disableLink(link.id).subscribe(() => {
      this.links.update((ls) => ls.map((l) => l.id === link.id ? { ...l, status: 'disabled' } : l));
    });
  }

  onShared(): void {
    this.showShareDialog.set(false);
    this.showFeedback(this.translate.instant('files.detail.access_granted'));
    setTimeout(() => this.loadSidePanels(), 300);
  }

  private linkWasCreated = false;

  onLinkDialogClosed(): void {
    this.showLinkDialog.set(false);
    if (this.linkWasCreated) {
      this.linkWasCreated = false;
      this.loadSidePanels();
    }
  }

  onLinkCreated(): void {
    this.linkWasCreated = true;
    this.showLinkDialog.set(false);
    this.showFeedback(this.translate.instant('files.detail.link_created'));
    this.loadSidePanels();
  }

  onVersionUploaded(): void {
    this.showAddVersionDialog.set(false);
    this.loadFile();
    this.showFeedback(this.translate.instant('files.versions.version_added'));
  }

  selectVersion(versionId: string): void {
    this.selectedVersionId.set(versionId);
  }

  startEditVersion(version: FileVersion): void {
    this.editingVersionId.set(version.id);
    this.versionLabelDraft   = version.version_label ?? '';
    this.versionCommentDraft = version.comment ?? '';
  }

  cancelEditVersion(): void {
    this.editingVersionId.set(null);
  }

  saveVersion(version: FileVersion): void {
    if (this.savingVersion()) return;
    this.savingVersion.set(true);
    const patch = {
      version_label: this.versionLabelDraft.trim() || null,
      comment: this.versionCommentDraft.trim() || null,
    };
    this.filesApi.updateVersion(this.id(), version.id, patch).subscribe({
      next: (res) => {
        this.file.update(f => f ? {
          ...f,
          versions: f.versions.map(v => v.id === version.id ? res.data.version : v),
        } : f);
        this.savingVersion.set(false);
        this.editingVersionId.set(null);
        this.showFeedback(this.translate.instant('files.versions.version_saved'));
      },
      error: () => this.savingVersion.set(false),
    });
  }

  toggleVersionActive(version: FileVersion): void {
    this.filesApi.updateVersion(this.id(), version.id, { is_active: !version.is_active }).subscribe({
      next: (res) => {
        this.file.update(f => f ? {
          ...f,
          versions: f.versions.map(v => v.id === version.id ? res.data.version : v),
        } : f);
      },
      error: () => {},
    });
  }

  startRename(): void {
    const f = this.file();
    if (!f || !f.is_owner) return;
    this.renameDraft = f.content_kind === 'url_file'
      ? (f.display_name ?? f.link_title ?? f.original_name)
      : (f.display_name ?? f.original_name);
    this.renamingTitle.set(true);
  }

  cancelRename(): void {
    this.renamingTitle.set(false);
  }

  commitRename(): void {
    if (this.savingRename()) return;
    const f = this.file();
    if (!f) return;
    const name = this.renameDraft.trim();
    const current = f.content_kind === 'url_file'
      ? (f.display_name ?? f.link_title ?? f.original_name)
      : (f.display_name ?? f.original_name);
    if (!name || name === current) {
      this.renamingTitle.set(false);
      return;
    }
    this.savingRename.set(true);
    this.filesApi.rename(f.id, name).subscribe({
      next: (res) => {
        this.file.update(prev => prev ? {
          ...prev,
          display_name: res.data.display_name,
          original_name: res.data.original_name,
        } : prev);
        this.fileUpdates.notifyRenamed({ id: f.id, display_name: res.data.display_name, original_name: res.data.original_name });
        this.savingRename.set(false);
        this.renamingTitle.set(false);
        this.showFeedback(this.translate.instant('files.detail.renamed'));
      },
      error: (err) => {
        this.savingRename.set(false);
        this.renamingTitle.set(false);
        const msg = err?.error?.message ?? 'Нет доступа к переименованию';
        this.showFeedback(msg);
      },
    });
  }

  saveDisplayName(): void {
    if (this.savingDisplayName()) return;
    this.savingDisplayName.set(true);
    const name = this.displayNameDraft.trim() || null;
    this.filesApi.updateDisplayName(this.id(), name).subscribe({
      next: (res) => {
        this.file.update(f => f ? { ...f, display_name: res.data.display_name } : f);
        this.savingDisplayName.set(false);
        this.showFeedback(this.translate.instant('files.versions.display_name_saved'));
      },
      error: () => this.savingDisplayName.set(false),
    });
  }

  showFeedback(msg: string): void {
    this.feedback.set(msg);
    setTimeout(() => this.feedback.set(null), 3000);
  }

  readonly formatSize = formatSize;

  mimeIcon(mime: string): string {
    if (mime?.startsWith('image/')) return '🖼️';
    if (mime?.startsWith('video/')) return '🎬';
    if (mime?.startsWith('audio/')) return '🎵';
    if (mime?.includes('pdf'))      return '📄';
    return '📎';
  }

  canAddVersion(): boolean {
    const f = this.file();
    return !!(f?.is_owner && f?.content_kind !== 'url_file');
  }

  versionDisplayLabel(v: FileVersion): string {
    return v.version_label ? `v${v.version_label}` : `v${v.version_number}`;
  }

  toggleAccessPopup(id: string, event: Event): void {
    event.stopPropagation();
    this.accessPopupId.set(this.accessPopupId() === id ? null : id);
  }

  closeAccessPopup(): void {
    this.accessPopupId.set(null);
  }

  revokeAccess(access: FileAccess): void {
    const name = access.user?.name ?? access.user?.email ?? 'пользователя';
    if (!confirm(`Забрать доступ у ${name}?`)) return;
    this.executeRevoke(access);
  }

  private executeRevoke(access: FileAccess, isRetry = false): void {
    const ref = access.contact_id ?? String(access.user!.id);
    const isMarkdown = this.file()?.mime_type === 'text/markdown';
    this.filesApi.revokeContactAccess(this.id(), ref).subscribe({
      next: () => {
        this.accesses.update(list => list.filter(a => a.id !== access.id));
        if (isMarkdown) {
          this.editorRefreshTrigger.update(n => n + 1);
        }
      },
      error: (err) => {
        const isLocked = err?.status === 423
          || err?.error?.message?.toLowerCase().includes('locked');
        if (!isRetry && isLocked && isMarkdown) {
          this.docsApi.takeover(this.id()).subscribe({
            next: () => this.executeRevoke(access, true),
            error: () => {},
          });
        }
      },
    });
  }

  toggleAccessEdit(access: FileAccess): void {
    const newValue = !access.can_edit;
    this.filesApi.updateAccess(this.id(), access.id, newValue).subscribe({
      next: (res) => {
        const updated: FileAccess = res.data?.access ?? { ...access, can_edit: newValue };
        this.accesses.update(list => list.map(a => a.id === access.id ? updated : a));
      },
      error: () => {},
    });
  }

  // ─── Task management ─────────────────────────────────────────────────────────

  toggleTaskMode(): void {
    if (this.savingTask()) return;
    const current = this.isTask();
    this.savingTask.set(true);
    this.filesApi.updateTask(this.id(), { is_task: !current }).subscribe({
      next: (res) => {
        this.file.set(res.data.file);
        if (res.data.file.task_start_date) this.taskStartDraft = this.toDatetimeLocal(res.data.file.task_start_date);
        if (res.data.file.task_due_date)   this.taskDueDraft   = this.toDatetimeLocal(res.data.file.task_due_date);
        this.savingTask.set(false);
      },
      error: () => this.savingTask.set(false),
    });
  }

  updateTaskStatus(status: TaskStatus): void {
    if (this.savingTask()) return;
    this.savingTask.set(true);
    this.filesApi.updateTask(this.id(), { task_status: status }).subscribe({
      next: (res) => { this.file.set(res.data.file); this.savingTask.set(false); },
      error: () => this.savingTask.set(false),
    });
  }

  updateTaskDates(): void {
    if (this.savingTask()) return;
    this.savingTask.set(true);
    const start = this.taskStartDraft ? new Date(this.taskStartDraft).toISOString() : null;
    const due   = this.taskDueDraft   ? new Date(this.taskDueDraft).toISOString()   : null;
    this.filesApi.updateTask(this.id(), { task_start_date: start, task_due_date: due }).subscribe({
      next: (res) => { this.file.set(res.data.file); this.savingTask.set(false); },
      error: () => this.savingTask.set(false),
    });
  }

  updateTaskAssignee(userId: number | null): void {
    if (this.savingTask()) return;
    this.savingTask.set(true);
    this.filesApi.updateTask(this.id(), { task_assigned_user_id: userId }).subscribe({
      next: (res) => { this.file.set(res.data.file); this.savingTask.set(false); },
      error: () => this.savingTask.set(false),
    });
  }

  // ─── Editor URL sync ─────────────────────────────────────────────────────────

  toggleEditorPanel(): void {
    const open = !this.editorPanelOpen();
    this.editorPanelOpen.set(open);
    if (!open) this.editorExpanded.set(false);
    this.syncEditorUrl();
  }

  closeEditor(): void {
    this.editorPanelOpen.set(false);
    this.editorExpanded.set(false);
    this.syncEditorUrl();
  }

  private loadTextContent(): void {
    this.textLoading.set(true);
    this.textError.set(false);
    this.textContent.set(null);
    this.filesApi.getTextContent(this.id()).subscribe({
      next: (res) => { this.textContent.set(res.data.content); this.textLoading.set(false); },
      error: () => { this.textError.set(true); this.textLoading.set(false); },
    });
  }

  toggleEditorExpanded(): void {
    this.editorExpanded.set(!this.editorExpanded());
    this.syncEditorUrl();
  }

  private syncEditorUrl(): void {
    const params: Record<string, string> = {};
    const qp = this.route.snapshot.queryParamMap;
    const keep = ['from', 'folder_id', 'shared_folder_id'];
    for (const k of keep) { const v = qp.get(k); if (v) params[k] = v; }
    if (this.editorExpanded()) params['editor'] = 'expanded';
    this.router.navigate([], { relativeTo: this.route, queryParams: params, replaceUrl: true });
  }

  // ─── Access polling (refreshes pending accesses) ─────────────────────────────

  private _accessPollTimer?: ReturnType<typeof setInterval>;

  private _startAccessPolling(): void {
    this._accessPollTimer = setInterval(() => {
      if (this.accesses().some(a => a.is_pending)) {
        this.filesApi.accesses(this.id()).subscribe(r => this.accesses.set(r.data.items));
      }
    }, 15_000);
  }

  refreshAccesses(): void {
    this.filesApi.accesses(this.id()).subscribe(r => this.accesses.set(r.data.items));
  }

  ngOnDestroy(): void {
    clearInterval(this._accessPollTimer);
  }

  private toDatetimeLocal(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  addToMyFiles(): void {
    if (this.addToMyFilesLoading()) return;
    this.addToMyFilesLoading.set(true);
    this.sfApi.addFileToMyFiles(this.id()).subscribe({
      next: () => {
        this.addToMyFilesLoading.set(false);
        this.file.update(f => f ? { ...f, folder_id: null } : f);
        this.showFeedback(this.translate.instant('shared_folders.add_to_my_files_done'));
      },
      error: () => this.addToMyFilesLoading.set(false),
    });
  }
}
