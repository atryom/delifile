import {
  Component, inject, signal, computed, OnInit, ChangeDetectionStrategy,
} from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FilesApiService, FileFilter } from '../../../../core/api/files-api.service';
import { FileUploadService } from '../../services/file-upload.service';
import { UrlFilesApiService } from '../../../../core/api/url-files-api.service';
import { OrganizationApiService } from '../../../../core/api/organization-api.service';
import { FileListItem, Tag, FolderTreeNode, LinkPreview } from '../../../../shared/models/api.models';

@Component({
  selector: 'app-file-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, FormsModule, ReactiveFormsModule, TranslateModule],
  template: `
    <div class="page">
      <!-- Page header -->
      <div class="page-header">
        <h1 class="page-title">{{ 'files.list.title' | translate }}</h1>
        <div class="header-actions">
          <button class="btn-secondary" (click)="showAddLink.set(!showAddLink())">
            {{ 'files.list.add_link_btn' | translate }}
          </button>
          <label class="btn-primary">
            <span>{{ 'files.list.upload_btn' | translate }}</span>
            <input type="file" (change)="onFileSelected($event)" style="display:none" />
          </label>
        </div>
      </div>

      <!-- Add link form -->
      @if (showAddLink()) {
        <div class="add-link-card">
          <h3>{{ 'files.add_link.title' | translate }}</h3>
          <form [formGroup]="linkForm" (ngSubmit)="saveLink()" class="link-form">
            <input
              formControlName="url"
              type="url"
              [placeholder]="'files.add_link.url_placeholder' | translate"
              class="link-input"
            />
            <div class="link-actions">
              <button
                type="button"
                class="btn-secondary-sm"
                (click)="previewLink()"
                [disabled]="linkForm.invalid || previewing()"
              >
                {{ previewing() ? '...' : ('files.add_link.preview_btn' | translate) }}
              </button>
              <button
                type="submit"
                class="btn-primary-sm"
                [disabled]="linkForm.invalid || savingLink()"
              >
                {{ savingLink() ? ('files.add_link.saving' | translate) : ('files.add_link.save_btn' | translate) }}
              </button>
              <button type="button" class="btn-ghost-sm" (click)="showAddLink.set(false)">
                {{ 'files.add_link.cancel' | translate }}
              </button>
            </div>
          </form>

          @if (linkPreview()) {
            <div class="link-preview-card">
              @if (linkPreview()!.image_url) {
                <img [src]="linkPreview()!.image_url" alt="" class="preview-img" />
              }
              <div class="preview-body">
                <p class="preview-title">{{ linkPreview()!.title }}</p>
                <p class="preview-site">{{ linkPreview()!.site_name }}</p>
                @if (linkPreview()!.description) {
                  <p class="preview-desc">{{ linkPreview()!.description }}</p>
                }
              </div>
            </div>
          }
          @if (linkError()) {
            <p class="field-error">{{ linkError() }}</p>
          }
        </div>
      }

      <!-- Upload zone -->
      @if (uploadState().phase === 'idle' && !showAddLink()) {
        <div
          class="upload-zone"
          [class.drag-over]="isDragOver()"
          (dragover)="onDragOver($event)"
          (dragleave)="onDragLeave()"
          (drop)="onDrop($event)"
        >
          <span class="upload-icon">☁️</span>
          <p>{{ 'files.list.drop_hint' | translate }}</p>
          <span class="upload-hint">{{ 'files.list.expire_hint' | translate }}</span>
        </div>
      }

      <!-- Upload in progress -->
      @if (uploadState().phase !== 'idle' && uploadState().phase !== 'done') {
        <div class="upload-progress-card">
          <div class="upload-progress-info">
            <span>{{ phaseLabel() }}</span>
            <span class="upload-percent">{{ uploadState().progress }}%</span>
          </div>
          <div class="progress-bar-track">
            <div class="progress-bar-fill" [style.width]="uploadState().progress + '%'"></div>
          </div>
          @if (uploadState().fileId) {
            <button class="btn-text-danger" (click)="cancelUpload()">
              {{ 'files.upload.cancel' | translate }}
            </button>
          }
        </div>
      }

      <!-- Upload done snackbar -->
      @if (uploadDone()) {
        <div class="snackbar">
          {{ 'files.upload.success' | translate }}
          <a [routerLink]="['/files', uploadState().fileId]" class="snackbar-link">{{ 'files.upload.open' | translate }}</a>
          <button class="snackbar-close" (click)="dismissUpload()">✕</button>
        </div>
      }

      <!-- Filters + search -->
      <div class="filter-bar">
        <div class="filter-tabs">
          @for (f of filters; track f.key) {
            <button
              [class.active]="activeFilter() === f.key"
              (click)="setFilter(f.key)"
              class="filter-tab"
            >{{ f.label | translate }}</button>
          }
        </div>
        <input
          class="search-input"
          type="search"
          [placeholder]="'files.list.search' | translate"
          [(ngModel)]="searchQuery"
          (ngModelChange)="onSearchChange($event)"
        />
      </div>

      <!-- Tag/folder filters -->
      <div class="secondary-filters">
        <select class="filter-select" (change)="onTagFilter($event)">
          <option value="">{{ 'files.list.filter_all_tags' | translate }}</option>
          @for (tag of tags(); track tag.id) {
            <option [value]="tag.id" [selected]="activeTagId() === tag.id">{{ tag.name }}</option>
          }
        </select>

        <select class="filter-select" (change)="onFolderFilter($event)">
          <option value="">{{ 'files.list.filter_all_folders' | translate }}</option>
          @for (folder of flatFolders(); track folder.id) {
            <option [value]="folder.id" [selected]="activeFolderId() === folder.id">{{ folder.name }}</option>
          }
        </select>
      </div>

      <!-- Loading -->
      @if (loading()) {
        <div class="loading-state">{{ 'files.list.loading' | translate }}</div>
      }

      <!-- Empty state -->
      @if (!loading() && files().length === 0) {
        <div class="empty-state">
          <span class="empty-icon">📂</span>
          <p>{{ emptyMessage() }}</p>
        </div>
      }

      <!-- File grid -->
      @if (!loading() && files().length > 0) {
        <div class="file-grid">
          @for (file of files(); track file.id) {
            @if (file.content_kind === 'url_file') {
              <!-- URL file card -->
              <div
                class="file-card url-card"
                [class.expired]="file.status === 'expired'"
                (click)="openFile(file)"
              >
                @if (file.link_image_url) {
                  <img [src]="file.link_image_url" alt="" class="url-thumb" />
                } @else {
                  <div class="url-thumb-placeholder">🔗</div>
                }
                <div class="file-info">
                  <p class="file-name" [title]="file.link_title ?? file.original_name">
                    {{ file.link_title ?? file.original_name }}
                  </p>
                  <p class="file-meta">
                    <span class="url-site">{{ file.link_site_name }}</span>
                  </p>
                  <p class="url-href">{{ file.link_url }}</p>
                </div>
                <div class="file-actions" (click)="$event.stopPropagation()">
                  <a [href]="file.link_url" target="_blank" rel="noopener" class="btn-icon" [title]="'files.list.open_link' | translate">🌐</a>
                  <button class="btn-icon" [title]="'files.list.open_title' | translate" (click)="openFile(file)">→</button>
                </div>
              </div>
            } @else {
              <!-- Binary file card -->
              <div
                class="file-card"
                [class.expired]="file.status === 'expired'"
                (click)="openFile(file)"
              >
                <div class="file-icon">{{ mimeIcon(file.mime_type ?? '') }}</div>
                <div class="file-info">
                  <p class="file-name" [title]="file.original_name">{{ file.original_name }}</p>
                  <p class="file-meta">
                    {{ formatSize(file.size) }}
                    <span class="meta-sep">·</span>
                    {{ file.uploaded_at | date:'MMM d, y' }}
                  </p>
                  <span class="file-badge" [class]="'badge-' + file.status">{{ file.status }}</span>
                </div>
                <div class="file-actions" (click)="$event.stopPropagation()">
                  <button class="btn-icon" [title]="'files.list.download_title' | translate" (click)="quickDownload(file, $event)">⬇️</button>
                  <button class="btn-icon" [title]="'files.list.open_title' | translate" (click)="openFile(file)">→</button>
                </div>
              </div>
            }
          }
        </div>
      }

      <!-- Pagination -->
      @if (totalPages() > 1) {
        <div class="pagination">
          <button [disabled]="page() === 1" (click)="goToPage(page() - 1)">{{ 'common.prev' | translate }}</button>
          <span>{{ 'common.page_of' | translate:{ page: page(), total: totalPages() } }}</span>
          <button [disabled]="page() === totalPages()" (click)="goToPage(page() + 1)">{{ 'common.next' | translate }}</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .page { padding: 28px 32px; max-width: 1000px; }
    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
    .page-title { font-size: 1.6rem; font-weight: 700; color: #1a1a2e; margin: 0; }
    .header-actions { display: flex; gap: 10px; }

    /* ── Add link ─────────────────────────────────────────── */
    .add-link-card { background: #fff; border-radius: 12px; padding: 20px 24px; margin-bottom: 20px; box-shadow: 0 1px 4px rgba(0,0,0,.07); }
    .add-link-card h3 { margin: 0 0 14px; font-size: 1rem; font-weight: 600; }
    .link-form { display: flex; flex-direction: column; gap: 10px; }
    .link-input { border: 1px solid #d1d5db; border-radius: 6px; padding: 9px 12px; font-size: 0.93rem; outline: none; width: 100%; box-sizing: border-box; }
    .link-input:focus { border-color: #6366f1; }
    .link-actions { display: flex; gap: 8px; flex-wrap: wrap; }

    /* ── Link preview ─────────────────────────────────────── */
    .link-preview-card { display: flex; gap: 12px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-top: 12px; }
    .preview-img { width: 100px; height: 72px; object-fit: cover; flex-shrink: 0; }
    .preview-body { padding: 10px 12px; flex: 1; min-width: 0; }
    .preview-title { font-weight: 600; font-size: 0.9rem; margin: 0 0 4px; }
    .preview-site { font-size: 0.78rem; color: #6b7280; margin: 0 0 4px; }
    .preview-desc { font-size: 0.82rem; color: #374151; margin: 0; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

    /* ── Upload zone ──────────────────────────────────────── */
    .upload-zone { border: 2px dashed #c7d2fe; border-radius: 12px; background: #f0f4ff; text-align: center; padding: 36px 20px; margin-bottom: 24px; cursor: pointer; transition: border-color 0.2s, background 0.2s; }
    .upload-zone.drag-over { border-color: #6366f1; background: #e0e7ff; }
    .upload-icon { font-size: 2.4rem; display: block; margin-bottom: 8px; }
    .upload-hint { color: #888; font-size: 0.82rem; margin-top: 6px; display: block; }

    .upload-progress-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px 22px; margin-bottom: 20px; }
    .upload-progress-info { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 0.9rem; }
    .upload-percent { font-weight: 600; color: #6366f1; }
    .progress-bar-track { height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; }
    .progress-bar-fill { height: 100%; background: linear-gradient(90deg, #6366f1, #818cf8); border-radius: 4px; transition: width 0.2s; }
    .btn-text-danger { background: none; border: none; color: #ef4444; cursor: pointer; font-size: 0.85rem; margin-top: 10px; }

    .snackbar { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: #1a1a2e; color: #fff; padding: 12px 22px; border-radius: 10px; display: flex; align-items: center; gap: 12px; font-size: 0.92rem; z-index: 999; box-shadow: 0 4px 20px rgba(0,0,0,0.2); }
    .snackbar-link { color: #a5b4fc; text-decoration: none; }
    .snackbar-close { background: none; border: none; color: #9ca3af; cursor: pointer; font-size: 1rem; }

    .filter-bar { display: flex; align-items: center; gap: 16px; margin-bottom: 10px; flex-wrap: wrap; }
    .filter-tabs { display: flex; gap: 4px; background: #f3f4f6; border-radius: 8px; padding: 4px; }
    .filter-tab { padding: 6px 14px; border-radius: 6px; border: none; cursor: pointer; font-size: 0.87rem; background: transparent; color: #6b7280; transition: all 0.15s; }
    .filter-tab.active { background: #fff; color: #6366f1; font-weight: 600; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    .search-input { flex: 1; min-width: 180px; padding: 8px 14px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; outline: none; }
    .search-input:focus { border-color: #6366f1; }

    .secondary-filters { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
    .filter-select { padding: 7px 12px; border: 1px solid #e5e7eb; border-radius: 7px; font-size: 0.87rem; background: #fff; outline: none; cursor: pointer; color: #374151; }
    .filter-select:focus { border-color: #6366f1; }

    .loading-state, .empty-state { text-align: center; padding: 60px 20px; color: #9ca3af; }
    .empty-icon { font-size: 3rem; display: block; margin-bottom: 12px; }

    .file-grid { display: flex; flex-direction: column; gap: 10px; }
    .file-card { display: flex; align-items: center; gap: 16px; background: #fff; border: 1px solid #f0f0f0; border-radius: 12px; padding: 14px 18px; cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s; }
    .file-card:hover { border-color: #c7d2fe; box-shadow: 0 2px 12px rgba(99,102,241,0.08); }
    .file-card.expired { opacity: 0.55; }
    .file-icon { font-size: 2rem; width: 40px; text-align: center; flex-shrink: 0; }
    .file-info { flex: 1; min-width: 0; }
    .file-name { font-size: 0.95rem; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0 0 4px; }
    .file-meta { font-size: 0.8rem; color: #9ca3af; margin: 0 0 4px; }
    .meta-sep { margin: 0 6px; }
    .file-badge { display: inline-block; font-size: 0.72rem; padding: 2px 8px; border-radius: 99px; text-transform: uppercase; letter-spacing: 0.04em; }
    .badge-available { background: #dcfce7; color: #16a34a; }
    .badge-uploading { background: #fef9c3; color: #a16207; }
    .badge-expired   { background: #fee2e2; color: #dc2626; }
    .badge-deleted   { background: #f3f4f6; color: #6b7280; }

    /* ── URL card specifics ────────────────────────────────── */
    .url-card { align-items: stretch; }
    .url-thumb { width: 80px; height: 56px; object-fit: cover; border-radius: 6px; flex-shrink: 0; }
    .url-thumb-placeholder { width: 80px; height: 56px; background: #e0e7ff; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 1.6rem; flex-shrink: 0; }
    .url-site { color: #6366f1; font-size: 0.78rem; }
    .url-href { font-size: 0.75rem; color: #9ca3af; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0; }

    .file-actions { display: flex; gap: 4px; flex-shrink: 0; }
    .btn-icon { background: none; border: 1px solid #e5e7eb; border-radius: 6px; padding: 4px 8px; cursor: pointer; font-size: 1rem; transition: background 0.1s; text-decoration: none; display: inline-flex; align-items: center; }
    .btn-icon:hover { background: #f3f4f6; }

    .pagination { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 28px; }
    .pagination button { padding: 8px 18px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; cursor: pointer; }
    .pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
    .pagination span { font-size: 0.9rem; color: #6b7280; }

    .btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 9px 20px; background: #6366f1; color: #fff; border: none; border-radius: 8px; font-size: 0.92rem; font-weight: 600; cursor: pointer; }
    .btn-primary:hover { background: #4f46e5; }
    .btn-secondary { display: inline-flex; align-items: center; padding: 9px 16px; background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; border-radius: 8px; font-size: 0.92rem; font-weight: 500; cursor: pointer; }
    .btn-secondary:hover { background: #e5e7eb; }
    .btn-primary-sm { padding: 7px 14px; background: #6366f1; color: #fff; border: none; border-radius: 6px; font-size: 0.87rem; font-weight: 600; cursor: pointer; }
    .btn-primary-sm:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-secondary-sm { padding: 7px 14px; background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.87rem; cursor: pointer; }
    .btn-secondary-sm:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-ghost-sm { padding: 7px 14px; background: none; color: #6b7280; border: none; border-radius: 6px; font-size: 0.87rem; cursor: pointer; }
    .field-error { color: #dc2626; font-size: 0.82rem; margin-top: 6px; }

    @media (max-width: 600px) {
      .page { padding: 20px 16px; }
      .filter-bar { flex-direction: column; align-items: stretch; }
    }
  `],
})
export class FileListComponent implements OnInit {
  private readonly filesApi      = inject(FilesApiService);
  private readonly uploadService = inject(FileUploadService);
  private readonly urlFilesApi   = inject(UrlFilesApiService);
  private readonly orgApi        = inject(OrganizationApiService);
  private readonly router        = inject(Router);
  private readonly route         = inject(ActivatedRoute);
  private readonly translate     = inject(TranslateService);
  private readonly fb            = inject(FormBuilder);

  readonly files        = signal<FileListItem[]>([]);
  readonly loading      = signal(false);
  readonly page         = signal(1);
  readonly totalPages   = signal(1);
  readonly activeFilter = signal<FileFilter>('mine');
  readonly isDragOver   = signal(false);
  readonly uploadState  = this.uploadService.state;
  readonly uploadDone   = computed(() => this.uploadState().phase === 'done');
  readonly tags         = signal<Tag[]>([]);
  readonly flatFolders  = signal<{ id: string; name: string }[]>([]);
  readonly activeTagId  = signal<string>('');
  readonly activeFolderId = signal<string>('');

  readonly showAddLink  = signal(false);
  readonly previewing   = signal(false);
  readonly savingLink   = signal(false);
  readonly linkPreview  = signal<LinkPreview | null>(null);
  readonly linkError    = signal<string | null>(null);

  searchQuery = '';
  private searchTimer?: ReturnType<typeof setTimeout>;

  readonly linkForm = this.fb.group({ url: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]] });

  readonly filters = [
    { key: 'mine' as FileFilter,      label: 'files.list.filter_my' },
    { key: 'received' as FileFilter,  label: 'files.list.filter_received' },
    { key: 'favorites' as FileFilter, label: 'files.list.filter_favorites' },
  ];

  readonly emptyMessage = computed(() => {
    const q = this.searchQuery;
    if (q) return this.translate.instant('files.list.empty_search', { q });
    return this.activeFilter() === 'received'
      ? this.translate.instant('files.list.empty_shared')
      : this.activeFilter() === 'favorites'
      ? this.translate.instant('files.list.empty_favorites')
      : this.translate.instant('files.list.empty_default');
  });

  ngOnInit(): void {
    // Read tag_id / folder_id from query params (e.g. from tags/folders pages)
    const qp = this.route.snapshot.queryParamMap;
    if (qp.get('tag_id'))    this.activeTagId.set(qp.get('tag_id')!);
    if (qp.get('folder_id')) this.activeFolderId.set(qp.get('folder_id')!);

    this.loadFilters();
    this.loadFiles();
  }

  private loadFilters(): void {
    this.orgApi.getTags().subscribe(res => this.tags.set(res.data.items));
    this.orgApi.getFolderTree().subscribe(res => {
      const flat: { id: string; name: string }[] = [];
      this.flattenFolders(res.data.items, flat, '');
      this.flatFolders.set(flat);
    });
  }

  private flattenFolders(nodes: any[], out: { id: string; name: string }[], prefix: string): void {
    for (const n of nodes) {
      out.push({ id: n.id, name: prefix + n.name });
      if (n.children?.length) this.flattenFolders(n.children, out, prefix + n.name + ' / ');
    }
  }

  onTagFilter(event: Event): void {
    this.activeTagId.set((event.target as HTMLSelectElement).value);
    this.page.set(1);
    this.loadFiles();
  }

  onFolderFilter(event: Event): void {
    this.activeFolderId.set((event.target as HTMLSelectElement).value);
    this.page.set(1);
    this.loadFiles();
  }

  setFilter(f: FileFilter): void {
    this.activeFilter.set(f);
    this.page.set(1);
    this.loadFiles();
  }

  onSearchChange(_: string): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.page.set(1); this.loadFiles(); }, 350);
  }

  goToPage(p: number): void { this.page.set(p); this.loadFiles(); }

  loadFiles(): void {
    this.loading.set(true);
    const tagId    = this.activeTagId() || undefined;
    const folderId = this.activeFolderId() || undefined;

    this.filesApi.list(this.activeFilter(), this.page(), this.searchQuery || undefined, { tag_id: tagId, folder_id: folderId }).subscribe({
      next: (res) => {
        this.files.set(res.data.items);
        const p = res.data.pagination;
        this.totalPages.set(Math.ceil(p.total / p.per_page) || 1);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openFile(file: FileListItem): void {
    this.router.navigate(['/files', file.id]);
  }

  quickDownload(file: FileListItem, e: Event): void {
    e.stopPropagation();
    this.filesApi.download(file.id).subscribe(res => window.open(res.data.url, '_blank'));
  }

  // ─── Add Link ─────────────────────────────────────────────────────────────

  previewLink(): void {
    const url = this.linkForm.getRawValue().url!;
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
    this.savingLink.set(true);
    this.linkError.set(null);

    this.urlFilesApi.create(this.linkForm.getRawValue().url!).subscribe({
      next: () => {
        this.savingLink.set(false);
        this.showAddLink.set(false);
        this.linkForm.reset();
        this.linkPreview.set(null);
        this.loadFiles();
      },
      error: (err) => {
        this.savingLink.set(false);
        this.linkError.set(err.message ?? this.translate.instant('files.add_link.error'));
      },
    });
  }

  // ─── Upload ───────────────────────────────────────────────────────────────

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) this.startUpload(input.files[0]);
    input.value = '';
  }

  onDragOver(e: DragEvent): void { e.preventDefault(); this.isDragOver.set(true); }
  onDragLeave(): void { this.isDragOver.set(false); }
  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.isDragOver.set(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) this.startUpload(file);
  }

  private startUpload(file: File): void {
    this.uploadService.upload(file).subscribe({ next: () => this.loadFiles() });
  }

  cancelUpload(): void {
    const id = this.uploadState().fileId;
    if (id) this.uploadService.cancel(id);
  }

  dismissUpload(): void { this.uploadService.reset(); }

  readonly phaseLabel = computed(() => {
    const p = this.uploadState().phase;
    return p === 'init'       ? this.translate.instant('files.upload.preparing')
         : p === 'uploading'  ? this.translate.instant('files.upload.uploading')
         : p === 'completing' ? this.translate.instant('files.upload.finalizing')
         : '';
  });

  // ─── Helpers ──────────────────────────────────────────────────────────────

  formatSize(bytes: number): string {
    if (bytes < 1024)        return `${bytes} B`;
    if (bytes < 1024 ** 2)   return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3)   return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  }

  mimeIcon(mime: string): string {
    if (mime.startsWith('image/'))        return '🖼️';
    if (mime.startsWith('video/'))        return '🎬';
    if (mime.startsWith('audio/'))        return '🎵';
    if (mime.includes('pdf'))             return '📄';
    if (mime.includes('zip') || mime.includes('tar') || mime.includes('gz')) return '🗜️';
    if (mime.includes('word') || mime.includes('document')) return '📝';
    if (mime.includes('spreadsheet') || mime.includes('excel')) return '📊';
    return '📎';
  }
}
