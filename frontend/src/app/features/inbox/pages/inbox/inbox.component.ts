import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { InboxApiService } from '../../../../core/api/inbox-api.service';
import { FileRequestsApiService } from '../../../../core/api/file-requests-api.service';
import { InboxFile, InboxSharedFolder, FileRequestItem, FileRequestFileItem } from '../../../../shared/models/api.models';
import { formatSize } from '../../../../shared/utils/format';

type ActiveTab = 'files' | 'folders' | 'requests';

@Component({
  selector: 'app-inbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, TranslateModule],
  templateUrl: './inbox.component.html',
  styleUrl: './inbox.component.scss',
})
export class InboxComponent implements OnInit {
  private readonly inboxApi    = inject(InboxApiService);
  private readonly requestsApi = inject(FileRequestsApiService);
  private readonly router      = inject(Router);

  readonly activeTab    = signal<ActiveTab>('files');
  readonly files        = signal<InboxFile[]>([]);
  readonly folders      = signal<InboxSharedFolder[]>([]);
  readonly requests     = signal<FileRequestItem[]>([]);
  readonly loading      = signal(false);
  readonly selectedFileIds   = signal<Set<string>>(new Set());
  readonly selectedFolderIds = signal<Set<string>>(new Set());
  readonly actionPending = signal(false);

  readonly hasFileSelection   = computed(() => this.selectedFileIds().size > 0);
  readonly hasFolderSelection = computed(() => this.selectedFolderIds().size > 0);
  readonly allFilesSelected   = computed(() =>
    this.files().length > 0 && this.selectedFileIds().size === this.files().length
  );
  readonly allFoldersSelected = computed(() =>
    this.folders().length > 0 && this.selectedFolderIds().size === this.folders().length
  );

  readonly pendingRequests = computed(() => {
    const result: Array<{ request: FileRequestItem; file: FileRequestFileItem | null }> = [];
    for (const r of this.requests()) {
      if (r.allow_multiple) {
        for (const f of r.files ?? []) {
          if (f.status === 'pending') result.push({ request: r, file: f });
        }
      } else if (r.status === 'fulfilled') {
        result.push({ request: r, file: null });
      }
    }
    return result;
  });

  ngOnInit(): void {
    this.inboxApi.dismissBadge();
    this.loadFiles();
    this.loadFolders();
    this.loadRequests();
  }

  setTab(tab: ActiveTab): void {
    this.activeTab.set(tab);
    this.selectedFileIds.set(new Set());
    this.selectedFolderIds.set(new Set());
  }

  private loadFiles(): void {
    this.loading.set(true);
    this.inboxApi.getFiles().subscribe({
      next: res => { this.files.set(res.data.items); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  private loadFolders(): void {
    this.inboxApi.getSharedFolders().subscribe({
      next: res => this.folders.set(res.data.items),
    });
  }

  private loadRequests(): void {
    this.requestsApi.list().subscribe({
      next: res => this.requests.set(res.data.items),
      error: () => {},
    });
  }

  toggleFileSelection(id: string): void {
    this.selectedFileIds.update(set => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  toggleFolderSelection(id: string): void {
    this.selectedFolderIds.update(set => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  toggleAllFiles(): void {
    if (this.allFilesSelected()) {
      this.selectedFileIds.set(new Set());
    } else {
      this.selectedFileIds.set(new Set(this.files().map(f => f.id)));
    }
  }

  toggleAllFolders(): void {
    if (this.allFoldersSelected()) {
      this.selectedFolderIds.set(new Set());
    } else {
      this.selectedFolderIds.set(new Set(this.folders().map(f => f.id)));
    }
  }

  acceptFiles(ids?: string[]): void {
    const target = ids ?? [...this.selectedFileIds()];
    if (!target.length || this.actionPending()) return;
    this.actionPending.set(true);
    this.inboxApi.acceptFiles(target).subscribe({
      next: () => {
        this.files.update(fs => fs.filter(f => !target.includes(f.id)));
        this.selectedFileIds.set(new Set());
        this.actionPending.set(false);
        this.inboxApi.refreshPendingCount();
      },
      error: () => this.actionPending.set(false),
    });
  }

  rejectFiles(ids?: string[]): void {
    const target = ids ?? [...this.selectedFileIds()];
    if (!target.length || this.actionPending()) return;
    this.actionPending.set(true);
    this.inboxApi.rejectFiles(target).subscribe({
      next: () => {
        this.files.update(fs => fs.filter(f => !target.includes(f.id)));
        this.selectedFileIds.set(new Set());
        this.actionPending.set(false);
        this.inboxApi.refreshPendingCount();
      },
      error: () => this.actionPending.set(false),
    });
  }

  acceptFolders(ids?: string[]): void {
    const target = ids ?? [...this.selectedFolderIds()];
    if (!target.length || this.actionPending()) return;
    this.actionPending.set(true);
    this.inboxApi.acceptSharedFolders(target).subscribe({
      next: () => {
        this.folders.update(fs => fs.filter(f => !target.includes(f.id)));
        this.selectedFolderIds.set(new Set());
        this.actionPending.set(false);
        this.inboxApi.refreshPendingCount();
      },
      error: () => this.actionPending.set(false),
    });
  }

  rejectFolders(ids?: string[]): void {
    const target = ids ?? [...this.selectedFolderIds()];
    if (!target.length || this.actionPending()) return;
    this.actionPending.set(true);
    this.inboxApi.rejectSharedFolders(target).subscribe({
      next: () => {
        this.folders.update(fs => fs.filter(f => !target.includes(f.id)));
        this.selectedFolderIds.set(new Set());
        this.actionPending.set(false);
        this.inboxApi.refreshPendingCount();
      },
      error: () => this.actionPending.set(false),
    });
  }

  clearFileSelection(): void {
    this.selectedFileIds.set(new Set());
  }

  clearFolderSelection(): void {
    this.selectedFolderIds.set(new Set());
  }

  acceptRequest(id: string): void {
    if (this.actionPending()) return;
    this.actionPending.set(true);
    this.requestsApi.accept(id).subscribe({
      next: res => {
        const fileId = res.data.file_id;
        this.requests.update(list =>
          list.map(r => r.id === id ? { ...r, status: 'accepted' as const } : r)
        );
        this.actionPending.set(false);
        if (fileId) {
          this.router.navigate(['/files', fileId]);
        }
      },
      error: () => this.actionPending.set(false),
    });
  }

  rejectRequest(id: string): void {
    if (this.actionPending()) return;
    this.actionPending.set(true);
    this.requestsApi.reject(id).subscribe({
      next: () => {
        this.requests.update(list =>
          list.map(r => r.id === id ? { ...r, status: 'rejected' as const } : r)
        );
        this.actionPending.set(false);
      },
      error: () => this.actionPending.set(false),
    });
  }

  acceptRequestFile(requestId: string, fileItemId: string): void {
    if (this.actionPending()) return;
    this.actionPending.set(true);
    this.requestsApi.acceptFile(requestId, fileItemId).subscribe({
      next: res => {
        const fileId = res.data.file_id;
        this.requests.update(list =>
          list.map(r => r.id === requestId ? {
            ...r,
            files: r.files.map(f => f.id === fileItemId ? { ...f, status: 'accepted' as const } : f),
          } : r)
        );
        this.actionPending.set(false);
        if (fileId) {
          this.router.navigate(['/files', fileId]);
        }
      },
      error: () => this.actionPending.set(false),
    });
  }

  rejectRequestFile(requestId: string, fileItemId: string): void {
    if (this.actionPending()) return;
    this.actionPending.set(true);
    this.requestsApi.rejectFile(requestId, fileItemId).subscribe({
      next: () => {
        this.requests.update(list =>
          list.map(r => r.id === requestId ? {
            ...r,
            files: r.files.map(f => f.id === fileItemId ? { ...f, status: 'rejected' as const } : f),
          } : r)
        );
        this.actionPending.set(false);
      },
      error: () => this.actionPending.set(false),
    });
  }

  readonly formatSize = formatSize;
}
