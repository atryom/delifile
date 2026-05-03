import { Component, inject, signal, OnInit, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgIf, NgFor, DatePipe } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FilesApiService } from '../../../../core/api/files-api.service';
import { FileCard, ShareLink, FileAccess, ActivityLog } from '../../../../shared/models/api.models';
import { ShareContactDialogComponent } from '../../dialogs/share-contact/share-contact-dialog.component';
import { CreateLinkDialogComponent } from '../../dialogs/create-link/create-link-dialog.component';

@Component({
  selector: 'app-file-detail',
  standalone: true,
  imports: [NgIf, NgFor, DatePipe, RouterLink, ShareContactDialogComponent, CreateLinkDialogComponent, TranslateModule],
  template: `
    <div class="page">
      <!-- Back -->
      <a routerLink="/files" class="back-link">{{ 'files.detail.back' | translate }}</a>

      <!-- Loading -->
      <div class="loading-state" *ngIf="loading()">{{ 'files.detail.loading' | translate }}</div>

      <ng-container *ngIf="!loading() && file()">
        <div class="file-detail-layout">

          <!-- Left: Metadata -->
          <div class="file-main">
            <div class="file-header-card">
              <div class="file-big-icon">{{ mimeIcon(file()!.mime_type) }}</div>
              <div class="file-header-info">
                <h1 class="file-title">{{ file()!.original_name }}</h1>
                <div class="file-meta-row">
                  <span class="badge" [class]="'badge-' + file()!.status">{{ file()!.status }}</span>
                  <span class="meta-item">{{ formatSize(file()!.size) }}</span>
                  <span class="meta-item">{{ file()!.mime_type }}</span>
                </div>
                <div class="file-meta-row">
                  <span class="meta-item">{{ 'files.detail.uploaded' | translate:{ date: (file()!.uploaded_at | date:'MMM d, y, HH:mm') } }}</span>
                  <span class="meta-item" *ngIf="file()!.expires_at">
                    {{ 'files.detail.expires' | translate:{ date: (file()!.expires_at | date:'MMM d, y, HH:mm') } }}
                  </span>
                </div>
                <div class="file-meta-row" *ngIf="file()!.is_owner">
                  <span class="owner-badge">{{ 'files.detail.owner' | translate }}</span>
                </div>
              </div>
            </div>

            <!-- Primary actions -->
            <div class="actions-bar">
              <button class="btn-action btn-primary" (click)="download()" [disabled]="actionPending()">
                {{ 'files.detail.download' | translate }}
              </button>
              <button
                class="btn-action"
                [class.btn-active]="file()!.is_favorite"
                (click)="toggleFavorite()"
                [disabled]="actionPending()"
              >
                {{ file()!.is_favorite ? ('files.detail.favorited' | translate) : ('files.detail.favorite' | translate) }}
              </button>
              <button
                class="btn-action"
                [class.btn-active]="file()!.is_pinned"
                (click)="togglePin()"
                [disabled]="actionPending()"
              >
                {{ file()!.is_pinned ? ('files.detail.pinned' | translate) : ('files.detail.pin' | translate) }}
              </button>
            </div>

            <!-- Share actions (owner only) -->
            <div class="share-actions" *ngIf="file()!.is_owner">
              <button class="btn-action btn-share" (click)="showShareDialog.set(true)">
                {{ 'files.detail.share' | translate }}
              </button>
              <button class="btn-action btn-share" (click)="showLinkDialog.set(true)">
                {{ 'files.detail.create_link' | translate }}
              </button>
            </div>

            <!-- Danger actions (owner only) -->
            <div class="danger-actions" *ngIf="file()!.is_owner">
              <button class="btn-danger" (click)="deleteFile()" [disabled]="actionPending()">
                {{ 'files.detail.delete' | translate }}
              </button>
            </div>

            <!-- Tags -->
            <div class="section" *ngIf="file()!.tags.length">
              <h3 class="section-title">{{ 'files.detail.tags' | translate }}</h3>
              <div class="tags-row">
                <span class="tag" *ngFor="let t of file()!.tags">{{ t.name }}</span>
              </div>
            </div>

            <!-- Action feedback -->
            <div class="feedback" *ngIf="feedback()">{{ feedback() }}</div>
          </div>

          <!-- Right: Sidebar panels -->
          <aside class="file-sidebar">

            <!-- Active share links -->
            <div class="sidebar-section">
              <h3 class="section-title">{{ 'files.detail.active_links' | translate }}</h3>
              <div class="empty-panel" *ngIf="!links().length">{{ 'files.detail.no_links' | translate }}</div>
              <div *ngFor="let link of links()" class="link-item">
                <div class="link-url" [title]="link.url">{{ link.url }}</div>
                <div class="link-meta">
                  {{ 'files.detail.link_expires' | translate:{ date: (link.expires_at | date:'MMM d, HH:mm') } }}
                  · <span class="badge badge-{{ link.status }}">{{ link.status }}</span>
                </div>
                <div class="link-actions">
                  <button class="btn-mini" (click)="copyLink(link.url)">{{ 'files.detail.copy' | translate }}</button>
                  <button class="btn-mini btn-mini-danger" (click)="disableLink(link)" *ngIf="link.status === 'active'">
                    {{ 'files.detail.disable' | translate }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Who has access -->
            <div class="sidebar-section">
              <h3 class="section-title">{{ 'files.detail.access' | translate }}</h3>
              <div class="empty-panel" *ngIf="!accesses().length">{{ 'files.detail.only_you' | translate }}</div>
              <div *ngFor="let a of accesses()" class="access-item">
                <span class="access-user">{{ a.user?.phone ?? '—' }}</span>
                <span class="access-type badge badge-access">{{ a.access_type }}</span>
              </div>
            </div>

            <!-- Activity -->
            <div class="sidebar-section">
              <h3 class="section-title">{{ 'files.detail.activity_section' | translate }}</h3>
              <div class="empty-panel" *ngIf="!activity().length">{{ 'files.detail.no_activity' | translate }}</div>
              <div *ngFor="let log of activity()" class="activity-item">
                <span class="activity-label">{{ log.label }}</span>
                <span class="activity-meta">{{ log.created_at | date:'MMM d, HH:mm' }}</span>
              </div>
            </div>

          </aside>
        </div>
      </ng-container>

      <!-- Share to contact dialog -->
      <app-share-contact-dialog
        *ngIf="showShareDialog()"
        [fileId]="id()"
        (closed)="showShareDialog.set(false)"
        (shared)="onShared()"
      />

      <!-- Create link dialog -->
      <app-create-link-dialog
        *ngIf="showLinkDialog()"
        [fileId]="id()"
        (closed)="showLinkDialog.set(false)"
        (created)="onLinkCreated()"
      />
    </div>
  `,
  styles: [`
    .page { padding: 28px 32px; max-width: 1100px; }
    .back-link { color: #6366f1; text-decoration: none; font-size: 0.9rem; }
    .back-link:hover { text-decoration: underline; }
    .loading-state { text-align: center; padding: 80px; color: #9ca3af; }

    .file-detail-layout { display: grid; grid-template-columns: 1fr 340px; gap: 28px; margin-top: 20px; }

    .file-header-card { display: flex; align-items: flex-start; gap: 20px; background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 24px; margin-bottom: 18px; }
    .file-big-icon { font-size: 3rem; flex-shrink: 0; }
    .file-header-info { flex: 1; min-width: 0; }
    .file-title { font-size: 1.3rem; font-weight: 700; margin: 0 0 10px; word-break: break-all; }
    .file-meta-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 6px; font-size: 0.85rem; color: #6b7280; }
    .meta-item { color: #6b7280; }
    .owner-badge { background: #dbeafe; color: #1d4ed8; font-size: 0.78rem; padding: 2px 8px; border-radius: 99px; font-weight: 600; }

    .actions-bar, .share-actions, .danger-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
    .btn-action { padding: 9px 16px; border: 1px solid #e5e7eb; border-radius: 9px; background: #fff; cursor: pointer; font-size: 0.88rem; font-weight: 500; transition: all 0.15s; }
    .btn-action:hover { border-color: #c7d2fe; background: #f5f3ff; }
    .btn-action.btn-primary { background: #6366f1; color: #fff; border-color: #6366f1; }
    .btn-action.btn-primary:hover { background: #4f46e5; }
    .btn-action.btn-active { background: #fef9c3; border-color: #fbbf24; color: #92400e; }
    .btn-action.btn-share { background: #f0fdf4; border-color: #86efac; color: #15803d; }
    .btn-danger { padding: 8px 14px; background: #fff5f5; border: 1px solid #fca5a5; border-radius: 9px; color: #dc2626; cursor: pointer; font-size: 0.88rem; }
    .btn-danger:hover { background: #fee2e2; }
    .btn-action:disabled, .btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }

    .section { margin-top: 20px; }
    .section-title { font-size: 0.82rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; margin: 0 0 10px; }
    .tags-row { display: flex; gap: 6px; flex-wrap: wrap; }
    .tag { background: #ede9fe; color: #7c3aed; font-size: 0.8rem; padding: 3px 10px; border-radius: 99px; }

    .feedback { margin-top: 16px; padding: 10px 14px; background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; color: #15803d; font-size: 0.88rem; }

    /* Sidebar */
    .file-sidebar { display: flex; flex-direction: column; gap: 20px; }
    .sidebar-section { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px; }
    .empty-panel { font-size: 0.85rem; color: #c4c4c4; font-style: italic; }

    .link-item { border: 1px solid #f0f0f0; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; }
    .link-url { font-size: 0.78rem; color: #6366f1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 4px; }
    .link-meta { font-size: 0.76rem; color: #9ca3af; margin-bottom: 6px; }
    .link-actions { display: flex; gap: 6px; }
    .btn-mini { padding: 3px 10px; font-size: 0.78rem; border: 1px solid #e5e7eb; border-radius: 5px; cursor: pointer; background: #fff; }
    .btn-mini:hover { background: #f9fafb; }
    .btn-mini-danger { color: #ef4444; border-color: #fca5a5; }

    .access-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 0.85rem; }
    .access-item:last-child { border: none; }
    .access-user { color: #374151; }
    .access-type { font-size: 0.72rem; }

    .activity-item { display: flex; justify-content: space-between; align-items: flex-start; padding: 8px 0; border-bottom: 1px solid #f3f4f6; gap: 8px; }
    .activity-item:last-child { border: none; }
    .activity-label { font-size: 0.83rem; color: #374151; }
    .activity-meta { font-size: 0.76rem; color: #9ca3af; white-space: nowrap; }

    .badge { display: inline-block; font-size: 0.72rem; padding: 2px 8px; border-radius: 99px; text-transform: uppercase; letter-spacing: 0.04em; }
    .badge-available { background: #dcfce7; color: #16a34a; }
    .badge-uploading  { background: #fef9c3; color: #a16207; }
    .badge-expired    { background: #fee2e2; color: #dc2626; }
    .badge-active     { background: #dcfce7; color: #16a34a; }
    .badge-disabled   { background: #f3f4f6; color: #6b7280; }
    .badge-access     { background: #ede9fe; color: #7c3aed; }

    @media (max-width: 768px) {
      .file-detail-layout { grid-template-columns: 1fr; }
    }
  `],
})
export class FileDetailComponent implements OnInit {
  readonly id = input.required<string>();

  private readonly filesApi  = inject(FilesApiService);
  private readonly router    = inject(Router);
  private readonly translate = inject(TranslateService);

  readonly file         = signal<FileCard | null>(null);
  readonly loading      = signal(false);
  readonly actionPending = signal(false);
  readonly feedback     = signal<string | null>(null);
  readonly links        = signal<ShareLink[]>([]);
  readonly accesses     = signal<FileAccess[]>([]);
  readonly activity     = signal<ActivityLog[]>([]);
  readonly showShareDialog = signal(false);
  readonly showLinkDialog  = signal(false);

  ngOnInit(): void {
    this.loadFile();
  }

  loadFile(): void {
    this.loading.set(true);
    this.filesApi.get(this.id()).subscribe({
      next: (res) => {
        this.file.set(res.data.file);
        this.loading.set(false);
        this.loadSidePanels();
      },
      error: () => this.loading.set(false),
    });
  }

  loadSidePanels(): void {
    this.filesApi.listLinks(this.id()).subscribe((r) => this.links.set(r.data.items));
    this.filesApi.accesses(this.id()).subscribe((r) => this.accesses.set(r.data.items));
    this.filesApi.activity(this.id()).subscribe((r) => this.activity.set(r.data.items));
  }

  download(): void {
    this.filesApi.download(this.id()).subscribe((res) => {
      window.open(res.data.url, '_blank');
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
        this.showFeedback(isFav ? this.translate.instant('files.detail.removed_favorite') : this.translate.instant('files.detail.added_favorite'));
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
        this.showFeedback(isPinned ? this.translate.instant('files.detail.unpinned') : this.translate.instant('files.detail.file_pinned'));
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

  copyLink(url: string): void {
    navigator.clipboard.writeText(url).then(() => this.showFeedback(this.translate.instant('files.detail.link_copied')));
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

  onLinkCreated(): void {
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
