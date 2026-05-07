import {
  Component, inject, signal, OnInit, ChangeDetectionStrategy,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { OrganizationApiService } from '../../../../core/api/organization-api.service';
import { SharedFoldersApiService } from '../../../../core/api/shared-folders-api.service';
import { FolderTreeNode, SharedFolder } from '../../../../shared/models/api.models';
import { SharedFolderAccessDialogComponent } from '../../../shared-folders/dialogs/access/shared-folder-access-dialog.component';

@Component({
  selector: 'app-folders-tree',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, RouterLink, ReactiveFormsModule, TranslateModule, SharedFolderAccessDialogComponent],
  templateUrl: './folders-tree.component.html',
  styleUrl: './folders-tree.component.scss',
})
export class FoldersTreeComponent implements OnInit {
  private readonly orgApi = inject(OrganizationApiService);
  private readonly sfApi  = inject(SharedFoldersApiService);
  private readonly router = inject(Router);
  private readonly route  = inject(ActivatedRoute);

  // ── Tab ──────────────────────────────────────────────────────────────────
  readonly activeTab = signal<'local' | 'shared'>('local');

  // ── Local folders ────────────────────────────────────────────────────────
  readonly loading          = signal(true);
  readonly tree             = signal<FolderTreeNode[]>([]);
  readonly expanded         = signal<Set<string>>(new Set());
  readonly editingId        = signal<string | null>(null);
  readonly editName         = signal('');
  readonly creating         = signal(false);
  readonly createParentId   = signal<string | null>(null);
  readonly createName       = signal('');
  readonly deleteTarget     = signal<FolderTreeNode | null>(null);
  readonly forceDeleteTarget = signal<FolderTreeNode | null>(null);
  readonly deleteError      = signal<string | null>(null);
  readonly deleting         = signal(false);

  // ── Shared folders ───────────────────────────────────────────────────────
  readonly sfLoading         = signal(false);
  readonly sharedFolders     = signal<SharedFolder[]>([]);
  readonly sfCreating        = signal(false);
  readonly sfCreateName      = signal('');
  readonly sfEditingId       = signal<string | null>(null);
  readonly sfEditName        = signal('');
  readonly sfDeleteTarget    = signal<SharedFolder | null>(null);
  readonly sfDeleting        = signal(false);
  readonly sfAccessFolderId  = signal<string | null>(null);
  readonly sfAccessFolderName = signal('');

  ngOnInit(): void {
    if (this.route.snapshot.queryParamMap.get('tab') === 'shared') {
      this.activeTab.set('shared');
    }
    this.loadLocal();
    this.loadShared();
  }

  setTab(tab: 'local' | 'shared'): void {
    this.activeTab.set(tab);
  }

  // ── Local folder methods ─────────────────────────────────────────────────

  private loadLocal(): void {
    this.loading.set(true);
    this.orgApi.getFolderTree().subscribe({
      next: (res) => { this.tree.set(res.data.items); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  toggleExpand(id: string): void {
    this.expanded.update(s => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  startCreate(parentId: string | null): void {
    this.creating.set(true);
    this.createParentId.set(parentId);
    this.createName.set('');
    if (parentId) {
      this.expanded.update(s => { const n = new Set(s); n.add(parentId); return n; });
    }
  }

  cancelCreate(): void {
    this.creating.set(false);
    this.createParentId.set(null);
    this.createName.set('');
  }

  saveCreate(): void {
    const name = this.createName().trim();
    if (!name) return;
    this.orgApi.createFolder({ name, parent_id: this.createParentId() }).subscribe({
      next: () => { this.cancelCreate(); this.loadLocal(); },
      error: (err) => alert(err.message ?? 'Ошибка'),
    });
  }

  startEdit(node: FolderTreeNode): void {
    this.editingId.set(node.id);
    this.editName.set(node.name);
  }

  cancelEdit(): void { this.editingId.set(null); }

  saveEdit(node: FolderTreeNode): void {
    const name = this.editName().trim();
    if (!name || name === node.name) { this.cancelEdit(); return; }
    this.orgApi.updateFolder(node.id, { name }).subscribe({
      next: () => { this.cancelEdit(); this.loadLocal(); },
      error: (err) => alert(err.message ?? 'Ошибка'),
    });
  }

  confirmDelete(node: FolderTreeNode): void {
    this.deleteTarget.set(node);
    this.deleteError.set(null);
  }

  cancelDelete(): void {
    this.deleteTarget.set(null);
    this.deleteError.set(null);
  }

  deleteFolder(force: boolean): void {
    const target = this.deleteTarget() ?? this.forceDeleteTarget();
    if (!target || this.deleting()) return;
    this.deleting.set(true);
    this.deleteError.set(null);
    this.orgApi.deleteFolder(target.id, force).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteTarget.set(null);
        this.forceDeleteTarget.set(null);
        this.loadLocal();
      },
      error: (err) => {
        this.deleting.set(false);
        const code = err.data?.code;
        if (code === 'HAS_FILES' && !force) {
          this.forceDeleteTarget.set(target);
          this.deleteTarget.set(null);
        } else {
          this.deleteError.set(err.message ?? 'Ошибка');
        }
      },
    });
  }

  // ── Shared folder methods ────────────────────────────────────────────────

  private loadShared(): void {
    this.sfLoading.set(true);
    this.sfApi.list().subscribe({
      next: (res) => { this.sharedFolders.set(res.data.items); this.sfLoading.set(false); },
      error: () => this.sfLoading.set(false),
    });
  }

  sfStartCreate(): void { this.sfCreating.set(true); this.sfCreateName.set(''); }
  sfCancelCreate(): void { this.sfCreating.set(false); this.sfCreateName.set(''); }

  sfSaveCreate(): void {
    const name = this.sfCreateName().trim();
    if (!name) return;
    this.sfApi.create(name).subscribe({
      next: () => { this.sfCancelCreate(); this.loadShared(); },
      error: (err) => alert(err.message ?? 'Ошибка'),
    });
  }

  sfStartEdit(f: SharedFolder): void {
    this.sfEditingId.set(f.id);
    this.sfEditName.set(f.name);
  }

  sfCancelEdit(): void { this.sfEditingId.set(null); }

  sfSaveEdit(f: SharedFolder): void {
    const name = this.sfEditName().trim();
    if (!name || name === f.name) { this.sfCancelEdit(); return; }
    this.sfApi.update(f.id, name).subscribe({
      next: () => { this.sfCancelEdit(); this.loadShared(); },
      error: (err) => alert(err.message ?? 'Ошибка'),
    });
  }

  sfConfirmDelete(f: SharedFolder): void { this.sfDeleteTarget.set(f); }
  sfCancelDelete(): void { this.sfDeleteTarget.set(null); }

  sfDelete(): void {
    const target = this.sfDeleteTarget();
    if (!target || this.sfDeleting()) return;
    this.sfDeleting.set(true);
    this.sfApi.delete(target.id).subscribe({
      next: () => { this.sfDeleting.set(false); this.sfDeleteTarget.set(null); this.loadShared(); },
      error: () => this.sfDeleting.set(false),
    });
  }

  openAccessDialog(f: SharedFolder): void {
    this.sfAccessFolderId.set(f.id);
    this.sfAccessFolderName.set(f.name);
  }

  closeAccessDialog(): void { this.sfAccessFolderId.set(null); }

  navigateToSharedFolder(f: SharedFolder): void {
    this.router.navigate(['/shared-folders'], { queryParams: { folder_id: f.id } });
  }
}
