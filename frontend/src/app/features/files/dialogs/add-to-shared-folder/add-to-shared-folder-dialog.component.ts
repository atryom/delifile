import { Component, input, output, inject, signal, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { SharedFoldersApiService } from '../../../../core/api/shared-folders-api.service';

interface FolderItem { id: string; name: string; parent_id?: string | null; is_in: boolean; }
interface FolderTreeItem extends FolderItem { depth: number; }

function buildFolderTree(folders: FolderItem[]): FolderTreeItem[] {
  const result: FolderTreeItem[] = [];
  function walk(parentId: string | null, depth: number): void {
    for (const f of folders) {
      if ((f.parent_id ?? null) === (parentId ?? null)) {
        result.push({ ...f, depth });
        walk(f.id, depth + 1);
      }
    }
  }
  walk(null, 0);
  // Append any orphaned folders (parent not in list) at root level
  const placed = new Set(result.map(r => r.id));
  for (const f of folders) {
    if (!placed.has(f.id)) result.push({ ...f, depth: 0 });
  }
  return result;
}

@Component({
  selector: 'app-add-to-shared-folder-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslateModule],
  template: `
    <div class="dialog-overlay" (click)="closed.emit()">
      <div class="dialog" (click)="$event.stopPropagation()" role="dialog" aria-label="Добавить в общую папку">
        <div class="dialog-header">
          <h2>{{ 'shared_folders.add_to_shared_folder_title' | translate }}</h2>
          <button class="dialog-close" (click)="closed.emit()" aria-label="Закрыть">✕</button>
        </div>

        <div class="dialog-body">
          <p class="hint">{{ 'shared_folders.add_to_shared_folder_hint' | translate }}</p>

          @if (loading()) {
            <div class="loading">{{ 'common.loading' | translate }}</div>
          } @else if (tree().length === 0) {
            <div class="empty">{{ 'shared_folders.add_to_shared_folder_empty' | translate }}</div>
          } @else {
            <ul class="folder-list" role="list">
              @for (f of tree(); track f.id) {
                <li class="folder-item" [style.padding-left.px]="f.depth * 20">
                  <label class="folder-label">
                    <input
                      type="checkbox"
                      [checked]="checkedIds().has(f.id)"
                      (change)="toggleFolder(f.id, $event)"
                      class="folder-checkbox"
                    />
                    @if (f.depth > 0) {
                      <span class="folder-indent-icon" aria-hidden="true">↳</span>
                    }
                    <span class="folder-icon" aria-hidden="true">📁</span>
                    <span class="folder-name">{{ f.name }}</span>
                  </label>
                </li>
              }
            </ul>
          }
        </div>

        <div class="dialog-footer">
          @if (error()) {
            <div class="error-msg">{{ error() }}</div>
          }
          <button class="btn-secondary" (click)="closed.emit()">{{ 'common.cancel' | translate }}</button>
          <button class="btn-primary" [disabled]="saving() || loading()" (click)="save()">
            {{ saving()
              ? ('shared_folders.add_to_shared_folder_saving' | translate)
              : ('shared_folders.add_to_shared_folder_save' | translate) }}
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrl: './add-to-shared-folder-dialog.component.scss',
})
export class AddToSharedFolderDialogComponent implements OnInit {
  readonly fileId  = input.required<string>();
  readonly closed  = output<void>();
  readonly saved   = output<void>();

  private readonly sfApi = inject(SharedFoldersApiService);

  readonly loading    = signal(true);
  readonly saving     = signal(false);
  readonly folders    = signal<FolderItem[]>([]);
  readonly checkedIds = signal<Set<string>>(new Set());
  readonly error      = signal<string | null>(null);

  readonly tree = computed(() => buildFolderTree(this.folders()));

  ngOnInit(): void {
    this.sfApi.getFileSharedFolders(this.fileId()).subscribe({
      next: (res) => {
        this.folders.set(res.data.folders.filter(f => f.is_in !== undefined));
        this.checkedIds.set(new Set(res.data.folder_ids));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  toggleFolder(id: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.checkedIds.update(s => {
      const n = new Set(s);
      checked ? n.add(id) : n.delete(id);
      return n;
    });
  }

  save(): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.sfApi.updateFileSharedFolders(this.fileId(), [...this.checkedIds()]).subscribe({
      next: () => { this.saving.set(false); this.saved.emit(); this.closed.emit(); },
      error: (err) => { this.saving.set(false); this.error.set(err.message ?? 'Ошибка'); },
    });
  }
}
