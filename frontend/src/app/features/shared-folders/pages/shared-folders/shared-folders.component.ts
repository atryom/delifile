import {
  Component, inject, signal, computed, OnInit, ChangeDetectionStrategy, viewChild, ElementRef,
} from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { SharedFoldersApiService } from '../../../../core/api/shared-folders-api.service';
import { SharedFolderAccessDialogComponent } from '../../dialogs/access/shared-folder-access-dialog.component';
import { FilesApiService } from '../../../../core/api/files-api.service';
import { SharedFolder, SharedFolderFileItem, LinkPreview } from '../../../../shared/models/api.models';
import { UrlFilesApiService } from '../../../../core/api/url-files-api.service';
import { FileUploadService } from '../../../files/services/file-upload.service';
import { ThreadCommentsComponent } from '../../../../shared/components/thread-comments/thread-comments.component';
import { formatSize } from '../../../../shared/utils/format';
import { canViewInBrowser } from '../../../../shared/utils/file';

function mimeIcon(mime: string): string {
  if (!mime) return '📎';
  if (mime.startsWith('image/')) return '🖼️';
  if (mime.startsWith('video/')) return '🎬';
  if (mime.startsWith('audio/')) return '🎵';
  if (mime.includes('pdf')) return '📄';
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z')) return '🗜️';
  return '📎';
}

@Component({
  selector: 'app-shared-folders',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, FormsModule, ReactiveFormsModule, TranslateModule, SharedFolderAccessDialogComponent, ThreadCommentsComponent],
  templateUrl: './shared-folders.component.html',
  styleUrl: './shared-folders.component.scss',
})
export class SharedFoldersComponent implements OnInit {
  private readonly sfApi          = inject(SharedFoldersApiService);
  private readonly filesApi       = inject(FilesApiService);
  private readonly urlFilesApi    = inject(UrlFilesApiService);
  private readonly uploadSvc      = inject(FileUploadService);
  private readonly route          = inject(ActivatedRoute);
  private readonly router         = inject(Router);
  private readonly fb             = inject(FormBuilder);

  readonly folders         = signal<SharedFolder[]>([]);
  readonly foldersLoading  = signal(false);
  readonly selectedFolder  = signal<SharedFolder | null>(null);

  // Nested folder navigation
  readonly subfolders         = signal<SharedFolder[]>([]);
  readonly breadcrumb         = signal<SharedFolder[]>([]);
  readonly showCreateSubfolder = signal(false);
  readonly newSubfolderName   = signal('');
  readonly creatingSubfolder  = signal(false);
  private readonly subfolderNameInput = viewChild<ElementRef<HTMLInputElement>>('subfolderNameInput');

  readonly files           = signal<SharedFolderFileItem[]>([]);
  readonly filesLoading    = signal(false);
  readonly page            = signal(1);
  readonly totalPages      = signal(1);

  readonly uploadExpanded  = signal(false);
  readonly isDragOver      = signal(false);
  readonly uploadState     = this.uploadSvc.state;

  readonly previewing      = signal(false);
  readonly savingLink      = signal(false);
  readonly linkPreview     = signal<LinkPreview|null>(null);
  readonly linkError       = signal<string|null>(null);

  readonly accessDialogOpen    = signal(false);
  readonly discussionPanelOpen = signal(false);
  readonly leaveDialogOpen     = signal(false);
  readonly leavingFolder       = signal(false);
  readonly leaveError          = signal<string | null>(null);

  readonly searchQuery     = signal('');
  private searchTimer?: ReturnType<typeof setTimeout>;

  readonly linkForm = this.fb.group({ url: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]] });

  readonly canEdit = computed(() => {
    const f = this.selectedFolder();
    if (!f) return false;
    return f.is_owner || f.my_access_type === 'edit';
  });

  readonly mimeIcon  = mimeIcon;
  readonly formatSize = formatSize;

  ngOnInit(): void {
    this.loadFolders();
    const folderId = this.route.snapshot.queryParamMap.get('folder_id');
    if (folderId) {
      this.sfApi.list().subscribe((res) => {
        const found = res.data.items.find(f => f.id === folderId);
        if (found) this.selectFolder(found);
      });
    }
  }

  private loadFolders(): void {
    this.foldersLoading.set(true);
    this.sfApi.list().subscribe({
      next: (res) => { this.folders.set(res.data.items); this.foldersLoading.set(false); },
      error: () => this.foldersLoading.set(false),
    });
  }

  selectFolder(f: SharedFolder): void {
    this.selectedFolder.set(f);
    this.breadcrumb.set([f]);
    this.router.navigate([], { queryParams: { folder_id: f.id }, replaceUrl: true });
    this.loadFiles(1);
    this.loadSubfolders(f.id);
  }

  navigateToSubfolder(sub: SharedFolder): void {
    this.selectedFolder.set(sub);
    this.breadcrumb.update(bc => [...bc, sub]);
    this.router.navigate([], { queryParams: { folder_id: sub.id }, replaceUrl: true });
    this.loadFiles(1);
    this.loadSubfolders(sub.id);
  }

  navigateBreadcrumb(index: number): void {
    const bc = this.breadcrumb();
    const target = bc[index];
    if (!target) return;
    this.breadcrumb.set(bc.slice(0, index + 1));
    this.selectedFolder.set(target);
    this.router.navigate([], { queryParams: { folder_id: target.id }, replaceUrl: true });
    this.loadFiles(1);
    this.loadSubfolders(target.id);
  }

  private loadSubfolders(folderId: string): void {
    this.sfApi.getSubfolders(folderId).subscribe({
      next: res => this.subfolders.set(res.data.items),
      error: () => this.subfolders.set([]),
    });
  }

  createSubfolder(): void {
    const name = this.newSubfolderName().trim();
    const parent = this.selectedFolder();
    if (!name || !parent || this.creatingSubfolder()) return;
    this.creatingSubfolder.set(true);
    this.sfApi.createSubfolder(parent.id, name).subscribe({
      next: res => {
        this.subfolders.update(sf => [...sf, res.data.folder]);
        this.newSubfolderName.set('');
        this.showCreateSubfolder.set(false);
        this.creatingSubfolder.set(false);
      },
      error: () => this.creatingSubfolder.set(false),
    });
  }

  onFolderSelect(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    const f = this.folders().find(x => x.id === id) ?? null;
    if (f) this.selectFolder(f);
    else {
      this.selectedFolder.set(null);
      this.files.set([]);
      this.router.navigate([], { queryParams: {}, replaceUrl: true });
    }
  }

  private loadFiles(pg: number): void {
    const f = this.selectedFolder();
    if (!f) return;
    this.filesLoading.set(true);
    this.page.set(pg);
    this.sfApi.listFiles(f.id, pg).subscribe({
      next: (res) => {
        this.files.set(res.data.items);
        this.totalPages.set(Math.ceil(res.data.pagination.total / res.data.pagination.per_page) || 1);
        this.filesLoading.set(false);
      },
      error: () => this.filesLoading.set(false),
    });
  }

  prevPage(): void { if (this.page() > 1) this.loadFiles(this.page() - 1); }
  nextPage(): void { if (this.page() < this.totalPages()) this.loadFiles(this.page() + 1); }

  toggleUpload(): void { this.uploadExpanded.update(v => !v); }

  onDragOver(e: DragEvent): void { e.preventDefault(); this.isDragOver.set(true); }
  onDragLeave(): void { this.isDragOver.set(false); }
  onDrop(e: DragEvent): void {
    e.preventDefault(); this.isDragOver.set(false);
    const file = e.dataTransfer?.files[0];
    if (file) this.upload(file);
  }

  onFileSelected(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.upload(file);
  }

  private upload(file: File): void {
    const folderId = this.selectedFolder()?.id;
    if (!folderId) return;
    this.uploadSvc.upload(file, { sharedFolderId: folderId }).subscribe({
      next: () => this.loadFiles(1),
      error: () => {},
    });
  }

  openInBrowser(file: SharedFolderFileItem): void {
    if (file.view_url) window.open(file.view_url, '_blank');
  }

  downloadFile(fileId: string): void {
    this.filesApi.download(fileId).subscribe((res) => window.open(res.data.url, '_blank'));
  }

  canViewInBrowser(file: SharedFolderFileItem): boolean {
    return canViewInBrowser(file.mime_type, file.view_url, file.content_kind);
  }

  fileDetailLink(fileId: string): string[] {
    return ['/files', fileId];
  }

  fileDetailQueryParams(): Record<string, string> {
    const folderId = this.selectedFolder()?.id;
    return folderId ? { from: 'shared-folder', folder_id: folderId } : {};
  }

  openCreateSubfolderForm(): void {
    this.showCreateSubfolder.set(true);
    this.newSubfolderName.set('');
    setTimeout(() => this.subfolderNameInput()?.nativeElement.focus(), 0);
  }

  openAccessDialog(): void { this.accessDialogOpen.set(true); }
  closeAccessDialog(): void { this.accessDialogOpen.set(false); }

  openLeaveDialog(): void { this.leaveDialogOpen.set(true); this.leaveError.set(null); }
  closeLeaveDialog(): void { this.leaveDialogOpen.set(false); }

  confirmLeave(): void {
    const folder = this.selectedFolder();
    if (!folder || this.leavingFolder()) return;
    this.leavingFolder.set(true);
    this.leaveError.set(null);
    this.sfApi.leaveFolder(folder.id).subscribe({
      next: () => {
        this.leavingFolder.set(false);
        this.leaveDialogOpen.set(false);
        this.selectedFolder.set(null);
        this.subfolders.set([]);
        this.breadcrumb.set([]);
        this.files.set([]);
        this.loadFolders();
      },
      error: (err) => {
        this.leavingFolder.set(false);
        this.leaveError.set(err.message ?? 'Ошибка');
      },
    });
  }

  resetUpload(): void {
    this.uploadSvc.reset();
  }

  previewLink(): void {
    const url = this.linkForm.value.url;
    if (!url) return;
    this.previewing.set(true);
    this.linkPreview.set(null);
    this.linkError.set(null);
    this.urlFilesApi.preview(url).subscribe({
      next: (res) => { this.linkPreview.set(res.data.preview); this.previewing.set(false); },
      error: () => { this.previewing.set(false); },
    });
  }

  saveLink(): void {
    const url = this.linkForm.value.url;
    const folderId = this.selectedFolder()?.id;
    if (!url || !folderId || this.savingLink()) return;
    this.savingLink.set(true);
    const preview = this.linkPreview();
    this.sfApi.addUrlFile(folderId, url, preview ? { title: preview.title, image_url: preview.image_url, site_name: preview.site_name } : null).subscribe({
      next: () => {
        this.savingLink.set(false);
        this.linkForm.reset();
        this.linkPreview.set(null);
        this.loadFiles(1);
      },
      error: (err) => { this.savingLink.set(false); this.linkError.set(err.message ?? 'Ошибка'); },
    });
  }
}
