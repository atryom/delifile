import {
  Component, inject, signal, computed, OnInit, ChangeDetectionStrategy,
} from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClient, HttpEventType, HttpEvent } from '@angular/common/http';
import { Observable, of, switchMap, from } from 'rxjs';
import { SharedFoldersApiService } from '../../../../core/api/shared-folders-api.service';
import { SharedFolderAccessDialogComponent } from '../../dialogs/access/shared-folder-access-dialog.component';
import { FilesApiService } from '../../../../core/api/files-api.service';
import { SharedFolder, SharedFolderFileItem, LinkPreview } from '../../../../shared/models/api.models';
import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { VideoThumbnailService } from '../../../files/services/video-thumbnail.service';
import { UrlFilesApiService } from '../../../../core/api/url-files-api.service';
import { InitUploadRequest } from '../../../../shared/models/api.models';
import { ThreadCommentsComponent } from '../../../../shared/components/thread-comments/thread-comments.component';

const PLAN_FILE_LIMITS: Record<string, number> = {
  free: 50 * 1024 * 1024, silver: 100 * 1024 * 1024, gold: 150 * 1024 * 1024,
};

function mimeIcon(mime: string): string {
  if (!mime) return '📎';
  if (mime.startsWith('image/')) return '🖼️';
  if (mime.startsWith('video/')) return '🎬';
  if (mime.startsWith('audio/')) return '🎵';
  if (mime.includes('pdf')) return '📄';
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z')) return '🗜️';
  return '📎';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
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
  private readonly authState      = inject(AuthStateService);
  private readonly thumbnailSvc   = inject(VideoThumbnailService);
  private readonly http           = inject(HttpClient);
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

  readonly files           = signal<SharedFolderFileItem[]>([]);
  readonly filesLoading    = signal(false);
  readonly page            = signal(1);
  readonly totalPages      = signal(1);

  readonly uploadExpanded  = signal(false);
  readonly isDragOver      = signal(false);
  readonly uploadPhase     = signal<'idle'|'uploading'|'done'|'error'>('idle');
  readonly uploadProgress  = signal(0);
  readonly uploadError     = signal<string|null>(null);
  readonly uploadedFileId  = signal<string|null>(null);

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

    const plan = this.authState.plan() ?? 'free';
    const limitBytes = PLAN_FILE_LIMITS[plan] ?? PLAN_FILE_LIMITS['free'];
    if (file.size > limitBytes) {
      const mb = Math.round(limitBytes / 1024 / 1024);
      this.uploadError.set(`Размер файла превышает лимит тарифа (${mb} МБ)`);
      this.uploadPhase.set('error');
      return;
    }

    this.uploadPhase.set('uploading');
    this.uploadProgress.set(0);
    this.uploadError.set(null);

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
        if (thumb) { req.thumbnail_name = thumb.file.name; req.thumbnail_size = thumb.blob.size; req.thumbnail_mime = 'image/jpeg'; }

        return this.sfApi.initUpload(folderId, req).pipe(
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
                reportProgress: true, observe: 'events', withCredentials: false,
              }) as Observable<HttpEvent<unknown>>),
              switchMap((evt) => {
                if ((evt as {type: number}).type === HttpEventType.UploadProgress) {
                  const pe = evt as { loaded: number; total?: number };
                  this.uploadProgress.set(pe.total ? Math.round(100 * pe.loaded / pe.total) : 0);
                }
                if ((evt as {type: number}).type !== HttpEventType.Response) return of(null);
                return this.sfApi.completeUpload(folderId, fileId, thumbInfo?.key);
              }),
            );
          }),
        );
      }),
    ).subscribe({
      next: (res) => {
        if (!res) return;
        this.uploadPhase.set('done');
        this.loadFiles(1);
      },
      error: (err) => { this.uploadError.set(err.message ?? 'Ошибка загрузки'); this.uploadPhase.set('error'); },
    });
  }

  openInBrowser(file: SharedFolderFileItem): void {
    if (file.view_url) window.open(file.view_url, '_blank');
  }

  downloadFile(fileId: string): void {
    this.filesApi.download(fileId).subscribe((res) => window.open(res.data.url, '_blank'));
  }

  canViewInBrowser(file: SharedFolderFileItem): boolean {
    if (file.content_kind === 'url_file') return false;
    const mime = file.mime_type ?? '';
    return !!file.view_url && (
      mime.startsWith('image/') || mime.startsWith('video/') ||
      mime.startsWith('audio/') || mime.includes('pdf')
    );
  }

  fileDetailLink(fileId: string): string[] {
    return ['/files', fileId];
  }

  fileDetailQueryParams(): Record<string, string> {
    const folderId = this.selectedFolder()?.id;
    return folderId ? { from: 'shared-folder', folder_id: folderId } : {};
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
    this.uploadPhase.set('idle');
    this.uploadProgress.set(0);
    this.uploadError.set(null);
    this.uploadedFileId.set(null);
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
