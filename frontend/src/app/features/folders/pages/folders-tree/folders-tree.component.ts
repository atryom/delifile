import {
  Component, inject, signal, OnInit, ChangeDetectionStrategy,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { OrganizationApiService } from '../../../../core/api/organization-api.service';
import { FolderTreeNode } from '../../../../shared/models/api.models';

@Component({
  selector: 'app-folders-tree',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, RouterLink, ReactiveFormsModule, TranslateModule],
  templateUrl: './folders-tree.component.html',
  styleUrl: './folders-tree.component.scss',
})
export class FoldersTreeComponent implements OnInit {
  private readonly orgApi = inject(OrganizationApiService);

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

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.orgApi.getFolderTree().subscribe({
      next: (res) => {
        this.tree.set(res.data.items);
        this.loading.set(false);
      },
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
      next: () => { this.cancelCreate(); this.load(); },
      error: (err) => alert(err.message ?? 'Ошибка'),
    });
  }

  startEdit(node: FolderTreeNode): void {
    this.editingId.set(node.id);
    this.editName.set(node.name);
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  saveEdit(node: FolderTreeNode): void {
    const name = this.editName().trim();
    if (!name || name === node.name) { this.cancelEdit(); return; }

    this.orgApi.updateFolder(node.id, { name }).subscribe({
      next: () => { this.cancelEdit(); this.load(); },
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
        this.load();
      },
      error: (err) => {
        this.deleting.set(false);
        const code = err.data?.code;
        if (code === 'HAS_FILES' && !force) {
          // Show force-delete confirmation
          this.forceDeleteTarget.set(target);
          this.deleteTarget.set(null);
        } else {
          this.deleteError.set(err.message ?? 'Ошибка');
        }
      },
    });
  }
}
