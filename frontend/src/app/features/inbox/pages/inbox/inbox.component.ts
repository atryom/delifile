import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { InboxApiService } from '../../../../core/api/inbox-api.service';
import { InboxFile, InboxSharedFolder } from '../../../../shared/models/api.models';

type ActiveTab = 'files' | 'folders';

@Component({
  selector: 'app-inbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, TranslateModule],
  templateUrl: './inbox.component.html',
  styleUrl: './inbox.component.scss',
})
export class InboxComponent implements OnInit {
  private readonly inboxApi = inject(InboxApiService);

  readonly activeTab    = signal<ActiveTab>('files');
  readonly files        = signal<InboxFile[]>([]);
  readonly folders      = signal<InboxSharedFolder[]>([]);
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

  ngOnInit(): void {
    this.loadFiles();
    this.loadFolders();
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
      },
      error: () => this.actionPending.set(false),
    });
  }

  formatSize(bytes: number | null): string {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }
}
