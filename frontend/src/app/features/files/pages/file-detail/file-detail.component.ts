import { Component, inject, signal, OnInit, input, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
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
  imports: [DatePipe, RouterLink, ShareContactDialogComponent, CreateLinkDialogComponent, TranslateModule],
  template: `
    <div class="page">
      <a routerLink="/files" class="back-link">{{ 'files.detail.back' | translate }}</a>

      @if (loading()) {
        <div class="loading-state">{{ 'files.detail.loading' | translate }}</div>
      }

      @if (!loading() && file()) {
        <div class="file-detail-layout">

          <!-- Left: Metadata + Actions -->
          <div class="file-main">

            <!-- URL file card -->
            @if (file()!.content_kind === 'url_file') {
              <div class="url-card">
                @if (file()!.link_image_url) {
                  <img [src]="file()!.link_image_url" alt="" class="url-card-img" loading="lazy" />
                }
                <div class="url-card-body">
                  <p class="url-site">{{ file()!.link_site_name ?? file()!.link_url }}</p>
                  <h2 class="url-card-title">{{ file()!.original_name }}</h2>
                  @if (file()!.link_description) {
                    <p class="url-card-desc">{{ file()!.link_description }}</p>
                  }
                  <a [href]="file()!.link_url" target="_blank" rel="noopener noreferrer" class="url-open-btn">
                    {{ 'files.detail.open_link' | translate }}
                  </a>
                </div>
              </div>
            } @else {
              <div class="file-header-card">
                @if (file()!.preview_url) {
                  <img [src]="file()!.preview_url" alt="" class="file-preview-thumb" loading="lazy" />
                } @else {
                  <div class="file-big-icon" aria-hidden="true">{{ mimeIcon(file()!.mime_type ?? '') }}</div>
                }
                <div class="file-header-info">
                  <h1 class="file-title">{{ file()!.original_name }}</h1>
                  <div class="file-meta-row">
                    <span class="badge" [class]="'badge-' + file()!.status">{{ file()!.status }}</span>
                    <span class="meta-item">{{ formatSize(file()!.size) }}</span>
                    @if (file()!.mime_type) {
                      <span class="meta-item">{{ file()!.mime_type }}</span>
                    }
                  </div>
                  <div class="file-meta-row">
                    <span class="meta-item">{{ 'files.detail.uploaded' | translate:{date: (file()!.uploaded_at | date:'MMM d, y, HH:mm')} }}</span>
                    @if (file()!.expires_at && !file()!.is_pinned) {
                      <span class="meta-item">{{ 'files.detail.expires' | translate:{date: (file()!.expires_at | date:'MMM d, y, HH:mm')} }}</span>
                    }
                  </div>
                  @if (file()!.is_owner) {
                    <div class="file-meta-row">
                      <span class="owner-badge">{{ 'files.detail.owner' | translate }}</span>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Primary actions -->
            <div class="actions-bar">
              @if (file()!.content_kind === 'url_file') {
                <button class="btn-action btn-primary" (click)="copyUrlLink()">
                  {{ 'files.detail.copy_link' | translate }}
                </button>
              } @else {
                <button class="btn-action btn-primary" (click)="download()" [disabled]="actionPending()">
                  {{ 'files.detail.download' | translate }}
                </button>
              }
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
            @if (file()!.is_owner) {
              <div class="share-actions">
                <button class="btn-action btn-share" (click)="showShareDialog.set(true)">
                  {{ 'files.detail.share' | translate }}
                </button>
                <button class="btn-action btn-share" (click)="showLinkDialog.set(true)">
                  {{ 'files.detail.create_link' | translate }}
                </button>
              </div>
            }

            <!-- Tags (editable for owner) -->
            <div class="section">
              <h3 class="section-title">{{ 'files.detail.tags' | translate }}</h3>
              <div class="tags-row">
                @for (t of file()!.tags; track t.id) {
                  <span class="tag">
                    {{ t.name }}
                    @if (file()!.is_owner) {
                      <button class="tag-remove" (click)="removeTag(t)" aria-label="Удалить тег">×</button>
                    }
                  </span>
                }
                @if (file()!.is_owner) {
                  @if (!showTagPicker()) {
                    <button class="tag-add-btn" (click)="openTagPicker()">+ тег</button>
                  } @else {
                    <div class="tag-picker" (mouseleave)="onTagPickerMouseLeave()">
                      <input
                        #tagInput
                        class="tag-search"
                        type="text"
                        [placeholder]="'files.detail.tag_search_placeholder' | translate"
                        (input)="onTagSearch($event)"
                        (keydown.escape)="closeTagPicker()"
                        (blur)="onTagInputBlur()"
                        [attr.aria-label]="'files.detail.tag_search_placeholder' | translate"
                      />
                      <div class="tag-dropdown">
                        @for (tag of filteredTags(); track tag.id) {
                          <button class="tag-option" (mousedown)="$event.preventDefault()" (click)="addTag(tag)">{{ tag.name }}</button>
                        }
                        @if (tagSearchQuery() && !tagExactMatch()) {
                          <button class="tag-option tag-create" (mousedown)="$event.preventDefault()" (click)="createAndAddTag()">
                            {{ 'files.detail.create_tag' | translate:{name: tagSearchQuery()} }}
                          </button>
                        }
                        @if (!tagSearchQuery() && filteredTags().length === 0) {
                          <span class="tag-empty">{{ 'files.detail.no_tags' | translate }}</span>
                        }
                      </div>
                    </div>
                  }
                }
              </div>
            </div>

            <!-- Folder (owner only) -->
            @if (file()!.is_owner) {
              <div class="section">
                <h3 class="section-title">{{ 'files.detail.folder' | translate }}</h3>
                @if (!showFolderPicker()) {
                  <div class="folder-row">
                    <span class="folder-name">
                      {{ currentFolderName() ?? ('files.detail.no_folder' | translate) }}
                    </span>
                    <button class="btn-mini" (click)="openFolderPicker()">Изменить</button>
                    @if (file()!.folder_id) {
                      <button class="btn-mini btn-mini-danger" (click)="removeFromFolder()">
                        {{ 'files.detail.remove_from_folder' | translate }}
                      </button>
                    }
                  </div>
                } @else {
                  <div class="folder-picker">
                    <select class="folder-select" (change)="onFolderSelect($event)">
                      <option value="">{{ 'files.detail.no_folder' | translate }}</option>
                      @for (node of flatFolders(); track node.id) {
                        <option [value]="node.id" [selected]="node.id === file()!.folder_id">
                          {{ node.indent }}{{ node.name }}
                        </option>
                      }
                    </select>
                    <button class="btn-mini" (click)="showFolderPicker.set(false)">{{ 'common.cancel' | translate }}</button>
                  </div>
                }
              </div>
            }

            <!-- Danger actions (owner only) -->
            @if (file()!.is_owner) {
              <div class="danger-actions">
                <button class="btn-danger" (click)="deleteFile()" [disabled]="actionPending()">
                  {{ 'files.detail.delete' | translate }}
                </button>
              </div>
            }

            <!-- Action feedback -->
            @if (feedback()) {
              <div class="feedback" role="status">{{ feedback() }}</div>
            }
          </div>

          <!-- Right: Sidebar panels -->
          <aside class="file-sidebar">

            <!-- Active share links -->
            <div class="sidebar-section">
              <h3 class="section-title">{{ 'files.detail.active_links' | translate }}</h3>
              @if (!links().length) {
                <div class="empty-panel">{{ 'files.detail.no_links' | translate }}</div>
              }
              @for (link of links(); track link.id) {
                <div class="link-item">
                  <div class="link-url" [title]="link.url">{{ link.url }}</div>
                  <div class="link-meta">
                    {{ 'files.detail.link_expires' | translate:{date: (link.expires_at | date:'MMM d, HH:mm')} }}
                    · <span class="badge badge-{{ link.status }}">{{ link.status }}</span>
                    @if (link.allow_save) {
                      · <span class="badge badge-save">💾</span>
                    }
                  </div>
                  <div class="link-actions">
                    <button class="btn-mini" (click)="copyLink(link.url)">{{ 'files.detail.copy' | translate }}</button>
                    @if (link.status === 'active') {
                      <button class="btn-mini btn-mini-danger" (click)="disableLink(link)">
                        {{ 'files.detail.disable' | translate }}
                      </button>
                    }
                  </div>
                </div>
              }
            </div>

            <!-- Who has access -->
            <div class="sidebar-section">
              <h3 class="section-title">{{ 'files.detail.access' | translate }}</h3>
              @if (!accesses().length) {
                <div class="empty-panel">{{ 'files.detail.only_you' | translate }}</div>
              }
              @for (a of accesses(); track a.id) {
                <div class="access-item">
                  <span class="access-user">{{ a.user?.name ?? a.user?.email ?? '—' }}</span>
                  <span class="access-type badge badge-access">{{ a.access_type }}</span>
                </div>
              }
            </div>

            <!-- Activity -->
            <div class="sidebar-section">
              <h3 class="section-title">{{ 'files.detail.activity_section' | translate }}</h3>
              @if (!activity().length) {
                <div class="empty-panel">{{ 'files.detail.no_activity' | translate }}</div>
              }
              @for (log of activity(); track log.id) {
                <div class="activity-item">
                  <span class="activity-label">{{ log.label }}</span>
                  <span class="activity-meta">{{ log.created_at | date:'MMM d, HH:mm' }}</span>
                </div>
              }
            </div>

          </aside>
        </div>
      }

      <!-- Share to contact dialog -->
      @if (showShareDialog()) {
        <app-share-contact-dialog
          [fileId]="id()"
          (closed)="showShareDialog.set(false)"
          (shared)="onShared()"
        />
      }

      <!-- Create link dialog -->
      @if (showLinkDialog()) {
        <app-create-link-dialog
          [fileId]="id()"
          (closed)="onLinkDialogClosed()"
          (created)="onLinkCreated()"
        />
      }
    </div>
  `,
  styles: [`
    .page { padding: 28px 32px; max-width: 1100px; }
    .back-link { color: #6366f1; text-decoration: none; font-size: 0.9rem; }
    .back-link:hover { text-decoration: underline; }
    .loading-state { text-align: center; padding: 80px; color: #9ca3af; }

    .file-detail-layout { display: grid; grid-template-columns: 1fr 340px; gap: 28px; margin-top: 20px; }

    /* URL file card */
    .url-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden; margin-bottom: 18px; }
    .url-card-img { width: 100%; max-height: 240px; object-fit: cover; display: block; }
    .url-card-body { padding: 20px 22px; }
    .url-site { font-size: 0.78rem; color: #9ca3af; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.04em; }
    .url-card-title { font-size: 1.2rem; font-weight: 700; margin: 0 0 8px; color: #1f2937; }
    .url-card-desc { font-size: 0.88rem; color: #6b7280; margin: 0 0 14px; line-height: 1.5; }
    .url-open-btn { display: inline-block; padding: 8px 18px; background: #6366f1; color: #fff; border-radius: 8px; text-decoration: none; font-size: 0.88rem; font-weight: 600; }
    .url-open-btn:hover { background: #4f46e5; }

    /* Regular file header card */
    .file-header-card { display: flex; align-items: flex-start; gap: 20px; background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 24px; margin-bottom: 18px; }
    .file-big-icon { font-size: 3rem; flex-shrink: 0; }
    .file-preview-thumb { width: 80px; height: 80px; object-fit: cover; border-radius: 10px; flex-shrink: 0; }
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

    /* Tags */
    .tags-row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
    .tag { display: inline-flex; align-items: center; gap: 4px; background: #ede9fe; color: #7c3aed; font-size: 0.8rem; padding: 3px 8px 3px 10px; border-radius: 99px; }
    .tag-remove { background: none; border: none; cursor: pointer; color: #7c3aed; font-size: 0.9rem; line-height: 1; padding: 0; opacity: 0.7; }
    .tag-remove:hover { opacity: 1; }
    .tag-add-btn { padding: 3px 10px; background: #f3f4f6; border: 1px dashed #d1d5db; border-radius: 99px; font-size: 0.8rem; cursor: pointer; color: #6b7280; }
    .tag-add-btn:hover { background: #ede9fe; border-color: #a5b4fc; color: #7c3aed; }
    .tag-picker { position: relative; }
    .tag-search { padding: 4px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.82rem; outline: none; width: 140px; }
    .tag-search:focus { border-color: #6366f1; }
    .tag-dropdown { position: absolute; top: 100%; left: 0; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); min-width: 160px; z-index: 100; max-height: 180px; overflow-y: auto; }
    .tag-option { display: block; width: 100%; text-align: left; padding: 7px 12px; border: none; background: none; cursor: pointer; font-size: 0.84rem; }
    .tag-option:hover { background: #f5f3ff; }
    .tag-create { color: #6366f1; font-style: italic; border-top: 1px solid #f0f0f0; }
    .tag-create:hover { background: #eef2ff; }
    .tag-empty { display: block; padding: 8px 12px; font-size: 0.82rem; color: #9ca3af; }

    /* Folder */
    .folder-row { display: flex; align-items: center; gap: 8px; }
    .folder-name { font-size: 0.88rem; color: #374151; }
    .folder-picker { display: flex; align-items: center; gap: 8px; }
    .folder-select { padding: 6px 10px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.88rem; outline: none; max-width: 220px; }
    .folder-select:focus { border-color: #6366f1; }

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
    .badge-save       { background: #dcfce7; color: #15803d; }

    @media (max-width: 768px) {
      .file-detail-layout { grid-template-columns: 1fr; }
    }
  `],
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
