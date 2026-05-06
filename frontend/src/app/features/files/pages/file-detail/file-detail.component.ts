import { Component, inject, signal, OnInit, input, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FilesApiService } from '../../../../core/api/files-api.service';
import { OrganizationApiService } from '../../../../core/api/organization-api.service';
import { FileCard, ShareLink, FileAccess, ActivityLog, Tag, FolderTreeNode } from '../../../../shared/models/api.models';
import { ShareContactDialogComponent } from '../../dialogs/share-contact/share-contact-dialog.component';
import { CreateLinkDialogComponent } from '../../dialogs/create-link/create-link-dialog.component';

@Component({
  selector: 'app-file-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, FormsModule, ShareContactDialogComponent, CreateLinkDialogComponent, TranslateModule],
  templateUrl: './file-detail.component.html',
  styleUrl: './file-detail.component.scss',
})
export class FileDetailComponent implements OnInit {
  readonly id = input.required<string>();

  private readonly filesApi  = inject(FilesApiService);
  private readonly orgApi    = inject(OrganizationApiService);
  private readonly router    = inject(Router);
  private readonly translate = inject(TranslateService);

  readonly file          = signal<FileCard | null>(null);
  readonly loading       = signal(false);
  readonly actionPending = signal(false);
  readonly feedback      = signal<string | null>(null);
  readonly links         = signal<ShareLink[]>([]);
  readonly accesses      = signal<FileAccess[]>([]);
  readonly activity      = signal<ActivityLog[]>([]);

  readonly editingDescription = signal(false);
  descriptionDraft = '';
  readonly showShareDialog = signal(false);
  readonly showLinkDialog  = signal(false);

  readonly allTags         = signal<Tag[]>([]);
  readonly tagSearch       = signal('');
  readonly tagSearchQuery  = signal('');
  readonly showTagPicker   = signal(false);
  readonly filteredTags    = signal<Tag[]>([]);
  readonly creatingTag     = signal(false);
  private tagPickerHovered = false;

  readonly allFolders    = signal<FolderTreeNode[]>([]);
  readonly flatFolders   = signal<{ id: string; name: string; indent: string }[]>([]);
  readonly showFolderPicker = signal(false);

  readonly currentFolderName = signal<string | null>(null);

  ngOnInit(): void {
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
        this.loading.set(false);
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

  openDescriptionEdit(): void {
    this.descriptionDraft = this.file()?.description ?? '';
    this.editingDescription.set(true);
  }

  saveDescription(): void {
    const desc = this.descriptionDraft.trim() || null;
    this.filesApi.updateDescription(this.id(), desc).subscribe({
      next: (res) => {
        this.file.update(f => f ? { ...f, description: res.data.description } : f);
        this.editingDescription.set(false);
        this.showFeedback(this.translate.instant('files.detail.description_saved'));
      },
      error: () => this.editingDescription.set(false),
    });
  }

  cancelDescriptionEdit(): void {
    this.editingDescription.set(false);
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

  togglePin(): void {
    if (!this.file()) return;
    this.actionPending.set(true);
    const isPinned = this.file()!.is_pinned;
    const req = isPinned ? this.filesApi.unpin(this.id()) : this.filesApi.pin(this.id());
    req.subscribe({
      next: () => {
        this.file.update((f) => f ? { ...f, is_pinned: !isPinned } : f);
        this.showFeedback(isPinned
          ? this.translate.instant('files.detail.unpinned')
          : this.translate.instant('files.detail.file_pinned'));
        this.actionPending.set(false);
      },
      error: () => this.actionPending.set(false),
    });
  }

  deleteFile(): void {
    if (!confirm(this.translate.instant('files.detail.confirm_delete', { name: this.file()?.original_name }))) return;
    this.actionPending.set(true);
    this.filesApi.delete(this.id()).subscribe({
      next: () => this.router.navigate(['/files']),
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
    this.showFolderPicker.set(true);
  }

  onFolderSelect(e: Event): void {
    const folderId = (e.target as HTMLSelectElement).value || null;
    this.showFolderPicker.set(false);
    this.filesApi.moveFolder(this.id(), folderId).subscribe({
      next: () => {
        this.file.update((f) => f ? { ...f, folder_id: folderId } : f);
        this.currentFolderName.set(
          folderId ? (this.flatFolders().find((f) => f.id === folderId)?.name ?? null) : null
        );
        this.showFeedback(this.translate.instant('files.detail.folder'));
      },
      error: () => {},
    });
  }

  removeFromFolder(): void {
    this.filesApi.moveFolder(this.id(), null).subscribe({
      next: () => {
        this.file.update((f) => f ? { ...f, folder_id: null } : f);
        this.currentFolderName.set(null);
        this.showFeedback(this.translate.instant('files.detail.remove_from_folder'));
      },
      error: () => {},
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

  private showFeedback(msg: string): void {
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
}
