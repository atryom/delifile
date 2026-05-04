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
  template: `
    <div class="page">
      <div class="page-header">
        <h1>{{ 'folders.title' | translate }}</h1>
        <button class="btn-primary" (click)="startCreate(null)">
          + {{ 'folders.create_btn' | translate }}
        </button>
      </div>

      @if (creating() && createParentId() === null) {
        <div class="inline-create">
          <input
            type="text"
            [placeholder]="'folders.folder_name_placeholder' | translate"
            [value]="createName()"
            (input)="createName.set($any($event.target).value)"
            class="create-input"
            (keydown.enter)="saveCreate()"
            (keydown.escape)="cancelCreate()"
            maxlength="100"
          />
          <button class="btn-sm btn-save" (click)="saveCreate()">{{ 'folders.save' | translate }}</button>
          <button class="btn-sm btn-cancel" (click)="cancelCreate()">{{ 'common.cancel' | translate }}</button>
        </div>
      }

      @if (loading()) {
        <p class="loading-text">{{ 'folders.loading' | translate }}</p>
      } @else if (tree().length === 0) {
        <p class="empty-text">{{ 'folders.empty' | translate }}</p>
      } @else {
        <ul class="tree-root" role="tree">
          @for (node of tree(); track node.id) {
            <ng-container *ngTemplateOutlet="nodeTemplate; context: { $implicit: node, depth: 0 }">
            </ng-container>
          }
        </ul>
      }
    </div>

    <ng-template #nodeTemplate let-node let-depth="depth">
      <li class="tree-node" role="treeitem" [style.padding-left.px]="depth * 20">
        @if (editingId() === node.id) {
          <div class="edit-row">
            <input
              type="text"
              [value]="editName()"
              (input)="editName.set($any($event.target).value)"
              class="edit-input"
              maxlength="100"
              (keydown.enter)="saveEdit(node)"
              (keydown.escape)="cancelEdit()"
            />
            <button class="btn-sm btn-save" (click)="saveEdit(node)">{{ 'folders.save' | translate }}</button>
            <button class="btn-sm btn-cancel" (click)="cancelEdit()">{{ 'common.cancel' | translate }}</button>
          </div>
        } @else {
          <div class="node-row">
            <button class="expand-btn" (click)="toggleExpand(node.id)" aria-label="toggle">
              @if (node.children?.length) {
                {{ expanded().has(node.id) ? '▾' : '▸' }}
              } @else {
                <span style="opacity:0">▸</span>
              }
            </button>
            <span class="folder-icon">🗂</span>
            <span class="folder-name">{{ node.name }}</span>
            <span class="folder-count">{{ node.files_count }}</span>
            <div class="node-actions">
              <a [routerLink]="['/files']" [queryParams]="{ folder_id: node.id }" class="btn-sm btn-view">
                {{ 'folders.view_files' | translate }}
              </a>
              <button class="btn-sm btn-add-child" (click)="startCreate(node.id)">+</button>
              <button class="btn-sm btn-edit" (click)="startEdit(node)">{{ 'folders.rename' | translate }}</button>
              <button class="btn-sm btn-delete" (click)="confirmDelete(node)">{{ 'folders.delete' | translate }}</button>
            </div>
          </div>
        }

        @if (creating() && createParentId() === node.id) {
          <div class="inline-create" [style.padding-left.px]="(depth + 1) * 20">
            <input
              type="text"
              [placeholder]="'folders.folder_name_placeholder' | translate"
              [value]="createName()"
              (input)="createName.set($any($event.target).value)"
              class="create-input"
              (keydown.enter)="saveCreate()"
              (keydown.escape)="cancelCreate()"
              maxlength="100"
            />
            <button class="btn-sm btn-save" (click)="saveCreate()">{{ 'folders.save' | translate }}</button>
            <button class="btn-sm btn-cancel" (click)="cancelCreate()">{{ 'common.cancel' | translate }}</button>
          </div>
        }

        @if (expanded().has(node.id) && node.children?.length) {
          <ul class="tree-children" role="group">
            @for (child of node.children; track child.id) {
              <ng-container *ngTemplateOutlet="nodeTemplate; context: { $implicit: child, depth: depth + 1 }">
              </ng-container>
            }
          </ul>
        }
      </li>
    </ng-template>

    @if (deleteTarget()) {
      <div class="modal-backdrop" (click)="cancelDelete()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>{{ 'folders.confirm_delete_title' | translate }}</h3>
          <p>{{ 'folders.confirm_delete_desc' | translate : { name: deleteTarget()!.name } }}</p>
          @if (deleteError()) {
            <div class="alert-error">{{ deleteError() }}</div>
          }
          <div class="modal-actions">
            <button class="btn-primary btn-danger" (click)="deleteFolder(false)" [disabled]="deleting()">
              {{ 'folders.delete_btn' | translate }}
            </button>
            <button class="btn-secondary" (click)="cancelDelete()">{{ 'common.cancel' | translate }}</button>
          </div>
        </div>
      </div>
    }

    @if (forceDeleteTarget()) {
      <div class="modal-backdrop" (click)="forceDeleteTarget.set(null)">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>{{ 'folders.force_delete_title' | translate }}</h3>
          <p>{{ 'folders.force_delete_desc' | translate }}</p>
          <div class="modal-actions">
            <button class="btn-primary btn-danger" (click)="deleteFolder(true)" [disabled]="deleting()">
              {{ 'folders.force_delete_btn' | translate }}
            </button>
            <button class="btn-secondary" (click)="forceDeleteTarget.set(null)">{{ 'common.cancel' | translate }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .page { max-width: 640px; margin: 0 auto; padding: 32px 20px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .page-header h1 { font-size: 1.5rem; font-weight: 700; margin: 0; }
    .loading-text, .empty-text { color: #6b7280; text-align: center; padding: 32px 0; }
    .tree-root, .tree-children { list-style: none; padding: 0; margin: 0; }
    .tree-node { margin-bottom: 4px; }
    .node-row { display: flex; align-items: center; gap: 8px; background: #fff; border-radius: 8px; padding: 10px 12px; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
    .expand-btn { background: none; border: none; cursor: pointer; font-size: 0.85rem; color: #6b7280; width: 20px; padding: 0; }
    .folder-icon { font-size: 1.1rem; }
    .folder-name { flex: 1; font-weight: 500; font-size: 0.95rem; }
    .folder-count { font-size: 0.78rem; color: #6b7280; background: #f3f4f6; border-radius: 10px; padding: 2px 7px; }
    .node-actions { display: flex; gap: 5px; }
    .inline-create { display: flex; gap: 8px; align-items: center; margin: 8px 0; background: #f9fafb; border-radius: 8px; padding: 10px 12px; }
    .create-input, .edit-input { flex: 1; border: 1px solid #6366f1; border-radius: 6px; padding: 7px 10px; font-size: 0.93rem; outline: none; }
    .edit-row { display: flex; gap: 8px; align-items: center; padding: 8px 12px; }
    .btn-primary { background: #6366f1; color: #fff; border: none; padding: 9px 18px; border-radius: 6px; font-size: 0.9rem; font-weight: 600; cursor: pointer; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-primary.btn-danger { background: #ef4444; }
    .btn-secondary { background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; padding: 9px 18px; border-radius: 6px; font-size: 0.9rem; cursor: pointer; }
    .btn-sm { font-size: 0.78rem; padding: 4px 9px; border-radius: 5px; border: none; cursor: pointer; font-weight: 500; }
    .btn-view { background: #ede9fe; color: #5b21b6; text-decoration: none; display: inline-block; }
    .btn-add-child { background: #d1fae5; color: #065f46; font-size: 1rem; font-weight: 700; }
    .btn-edit { background: #e0f2fe; color: #0369a1; }
    .btn-save { background: #d1fae5; color: #065f46; }
    .btn-cancel { background: #f3f4f6; color: #374151; }
    .btn-delete { background: #fee2e2; color: #dc2626; }
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; z-index: 300; }
    .modal { background: #fff; border-radius: 12px; padding: 28px; max-width: 380px; width: 90%; }
    .modal h3 { margin: 0 0 10px; font-size: 1.1rem; }
    .modal p { color: #374151; font-size: 0.93rem; margin: 0 0 20px; }
    .modal-actions { display: flex; gap: 10px; }
    .alert-error { background: #fef2f2; border: 1px solid #fca5a5; color: #dc2626; border-radius: 6px; padding: 10px 14px; font-size: 0.88rem; margin-bottom: 12px; }
  `],
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
