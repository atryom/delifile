import { Component, inject, signal, computed, OnInit, input, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FilesApiService } from '../../../../core/api/files-api.service';
import { DocumentsApiService } from '../../../../core/api/documents-api.service';
import { OrganizationApiService } from '../../../../core/api/organization-api.service';
import { SharedFoldersApiService } from '../../../../core/api/shared-folders-api.service';
import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { FileCard, FileVersion, ShareLink, FileAccess, ActivityLog, Tag, FolderTreeNode } from '../../../../shared/models/api.models';
import { ShareContactDialogComponent } from '../../dialogs/share-contact/share-contact-dialog.component';
import { CreateLinkDialogComponent } from '../../dialogs/create-link/create-link-dialog.component';
import { AddToSharedFolderDialogComponent } from '../../dialogs/add-to-shared-folder/add-to-shared-folder-dialog.component';
import { AddVersionDialogComponent } from '../../dialogs/add-version/add-version-dialog.component';
import { ThreadCommentsComponent } from '../../../../shared/components/thread-comments/thread-comments.component';
import { MarkdownEditorPanelComponent } from './markdown-editor-panel.component';

@Component({
  selector: 'app-file-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, FormsModule, ShareContactDialogComponent, CreateLinkDialogComponent, AddToSharedFolderDialogComponent, AddVersionDialogComponent, TranslateModule, ThreadCommentsComponent, MarkdownEditorPanelComponent],
  templateUrl: './file-detail.component.html',
  styleUrl: './file-detail.component.scss',
})
export class FileDetailComponent implements OnInit {
  readonly id = input.required<string>();

  private readonly filesApi  = inject(FilesApiService);
  private readonly docsApi   = inject(DocumentsApiService);
  private readonly orgApi    = inject(OrganizationApiService);
  private readonly sfApi     = inject(SharedFoldersApiService);
  private readonly router    = inject(Router);
  private readonly route     = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);
  readonly authState         = inject(AuthStateService);

  private backFolderId: string | null = null;
  readonly backLink = signal<{ commands: string[]; queryParams?: Record<string,string> }>({ commands: ['/folders'] });

  readonly file          = signal<FileCard | null>(null);
  readonly loading       = signal(false);
  readonly actionPending = signal(false);
  readonly feedback      = signal<string | null>(null);
  readonly links         = signal<ShareLink[]>([]);
  readonly accesses      = signal<FileAccess[]>([]);
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

  readonly allFolders    = signal<FolderTreeNode[]>([]);
  readonly flatFolders   = signal<{ id: string; name: string; indent: string }[]>([]);
  readonly pendingFolderId = signal<string | null>(null);

  readonly currentFolderName = signal<string | null>(null);

  // ─── Comments state ───────────────────────────────────────────────────────────

  readonly showComments           = signal(true);
  readonly showActivity           = signal(false);
  readonly showVersions           = signal(false);
  readonly contextSharedFolderId  = signal<string | null>(null);
  readonly descriptionEditorOpen  = signal(false);
  readonly editorPanelOpen        = signal(false);
  readonly editorExpanded         = signal(false);
  readonly editorRefreshTrigger   = signal(0);

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
    return f.display_name ?? f.original_name;
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

  // Display name edit
  displayNameDraft = '';
  readonly savingDisplayName = signal(false);

  ngOnInit(): void {
    const fromParam = this.route.snapshot.queryParamMap.get('from');
    const folderIdParam = this.route.snapshot.queryParamMap.get('folder_id');
    if (fromParam === 'shared-folder' && folderIdParam) {
      this.backFolderId = folderIdParam;
      this.backLink.set({ commands: ['/folders'], queryParams: { tab: 'shared', shared_folder_id: folderIdParam } });
      this.contextSharedFolderId.set(folderIdParam);
    } else if (fromParam === 'local-folder' && folderIdParam) {
      this.backFolderId = folderIdParam;
      this.backLink.set({ commands: ['/folders'], queryParams: { folder_id: folderIdParam } });
    }

    const editorParam = this.route.snapshot.queryParamMap.get('editor');
    if (editorParam === 'expanded') {
      this.editorPanelOpen.set(true);
      this.editorExpanded.set(true);
    }

    this.loadFile();
    this.orgApi.getTags().subscribe((r) => this.allTags.set(r.data.items));
    this.orgApi.getFolderTree().subscribe((r) => {
      this.allFolders.set(r.data.items);
      this.flatFolders.set(this.flattenTree(r.data.items, 0));
    });
  }

  loadFile(): void {
    this.loading.set(true);
    this.filesApi.get(this.id()).subscribe({
      next: (res) => {
        this.file.set(res.data.file);
        this.descriptionDraft = res.data.file.description ?? '';
        this.descriptionEditorOpen.set(!!(res.data.file.description));
        this.pendingFolderId.set(res.data.file.folder_id ?? null);
        this.displayNameDraft = res.data.file.display_name ?? '';
        this.loading.set(false);
        if (res.data.file.mime_type === 'text/markdown') {
          this.editorPanelOpen.set(true);
        }
        // Direct link: set back to local folder if file belongs to one
        const fromParam = this.route.snapshot.queryParamMap.get('from');
        if (!fromParam && res.data.file.folder_id) {
          this.backLink.set({ commands: ['/folders'], queryParams: { folder_id: res.data.file.folder_id } });
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
        this.updateFolderName(res.data.file.folder_id);
      },
      error: () => this.loading.set(false),
    });
  }

  loadSidePanels(): void {
    this.filesApi.listLinks(this.id()).subscribe((r) => this.links.set(r.data.items));
    this.filesApi.accesses(this.id()).subscribe((r) => this.accesses.set(r.data.items));
    this.filesApi.activity(this.id()).subscribe((r) => this.activity.set(r.data.items));
  }

  private updateFolderName(folderId: string | null): void {
    if (!folderId) { this.currentFolderName.set(null); return; }
    const found = this.flatFolders().find((f) => f.id === folderId);
    if (found) { this.currentFolderName.set(found.name); return; }
    this.orgApi.getFolderTree().subscribe((r) => {
      this.allFolders.set(r.data.items);
      const flat = this.flattenTree(r.data.items, 0);
      this.flatFolders.set(flat);
      this.currentFolderName.set(flat.find((f) => f.id === folderId)?.name ?? null);
    });
  }

  private flattenTree(nodes: FolderTreeNode[], depth: number): { id: string; name: string; indent: string }[] {
    const result: { id: string; name: string; indent: string }[] = [];
    for (const node of nodes) {
      result.push({ id: node.id, name: node.name, indent: '  '.repeat(depth) });
      if (node.children?.length) {
        result.push(...this.flattenTree(node.children, depth + 1));
      }
    }
    return result;
  }

  download(): void {
    const selectedId = this.selectedVersionId();
    const versions   = this.file()?.versions ?? [];
    const hasVersions = this.file()?.has_versions;

    if (hasVersions && selectedId && versions.length > 0) {
      const latest = versions[versions.length - 1];
      if (selectedId !== latest.id) {
        this.filesApi.downloadVersion(this.id(), selectedId).subscribe((res) => {
          window.open(res.data.url, '_blank');
        });
        return;
      }
    }

    this.filesApi.download(this.id()).subscribe((res) => {
      window.open(res.data.url, '_blank');
    });
  }

  openInBrowser(): void {
    const url = this.file()?.view_url;
    if (url) window.open(url, '_blank');
  }

  canViewInBrowser(): boolean {
    const f = this.file();
    if (!f || f.content_kind === 'url_file') return false;
    const mime = f.mime_type ?? '';
    return !!f.view_url && (
      mime.startsWith('image/') ||
      mime.startsWith('video/') ||
      mime.startsWith('audio/') ||
      mime.includes('pdf')
    );
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

  onFolderSelect(e: Event): void {
    const folderId = (e.target as HTMLSelectElement).value || null;
    this.pendingFolderId.set(folderId);
    this.saveFolderSelection();
  }

  saveFolderSelection(): void {
    if (this.savingFolder()) return;
    const folderId = this.pendingFolderId();
    this.savingFolder.set(true);
    this.filesApi.moveFolder(this.id(), folderId).subscribe({
      next: () => {
        this.file.update((f) => f ? { ...f, folder_id: folderId } : f);
        this.currentFolderName.set(
          folderId ? (this.flatFolders().find((f) => f.id === folderId)?.name ?? null) : null
        );
        this.savingFolder.set(false);
        this.showFeedback(this.translate.instant('files.detail.folder_saved'));
      },
      error: () => this.savingFolder.set(false),
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
    this.loadSidePanels();
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

  formatSize(bytes: number): string {
    if (bytes < 1024)       return `${bytes} B`;
    if (bytes < 1024 ** 2)  return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3)  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  }

  mimeIcon(mime: string): string {
    if (mime?.startsWith('image/')) return '🖼️';
    if (mime?.startsWith('video/')) return '🎬';
    if (mime?.startsWith('audio/')) return '🎵';
    if (mime?.includes('pdf'))      return '📄';
    return '📎';
  }

  isSharedFolderOnly(): boolean {
    return !!(this.file()?.is_owner && this.file()?.shared_folder_only);
  }

  canAddVersion(): boolean {
    const f = this.file();
    return !!(f?.is_owner && f?.content_kind !== 'url_file');
  }

  versionDisplayLabel(v: FileVersion): string {
    return v.version_label ? `v${v.version_label}` : `v${v.version_number}`;
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

  addToMyFiles(): void {
    if (this.addToMyFilesLoading()) return;
    this.addToMyFilesLoading.set(true);
    this.sfApi.addFileToMyFiles(this.id()).subscribe({
      next: () => {
        this.addToMyFilesLoading.set(false);
        this.file.update(f => f ? { ...f, shared_folder_only: false } as typeof f : f);
        this.showFeedback(this.translate.instant('shared_folders.add_to_my_files_done'));
      },
      error: () => this.addToMyFilesLoading.set(false),
    });
  }
}
