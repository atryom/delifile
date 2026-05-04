import {
  Component, inject, signal, computed, OnInit, ChangeDetectionStrategy,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { OrganizationApiService } from '../../../../core/api/organization-api.service';
import { Tag } from '../../../../shared/models/api.models';

@Component({
  selector: 'app-tags-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule, TranslateModule],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>{{ 'tags.title' | translate }}</h1>
      </div>

      <!-- Add tag form -->
      <div class="add-card">
        <form [formGroup]="addForm" (ngSubmit)="addTag()" class="add-form">
          <input
            formControlName="name"
            type="text"
            [placeholder]="'tags.add_placeholder' | translate"
            class="add-input"
            maxlength="50"
          />
          <button type="submit" class="btn-primary" [disabled]="addForm.invalid || adding()">
            {{ adding() ? ('tags.adding' | translate) : ('tags.add_btn' | translate) }}
          </button>
        </form>
        @if (addError()) {
          <p class="field-error">{{ addError() }}</p>
        }
      </div>

      <!-- Search -->
      <div class="search-row">
        <input
          type="search"
          [placeholder]="'tags.search_placeholder' | translate"
          class="search-input"
          (input)="onSearch($event)"
        />
      </div>

      <!-- Tags list -->
      @if (loading()) {
        <p class="loading-text">{{ 'tags.loading' | translate }}</p>
      } @else if (filtered().length === 0) {
        <p class="empty-text">{{ 'tags.empty' | translate }}</p>
      } @else {
        <ul class="tags-list" role="list">
          @for (tag of filtered(); track tag.id) {
            <li class="tag-item">
              @if (editingId() === tag.id) {
                <div class="edit-row">
                  <input
                    type="text"
                    [value]="editName()"
                    (input)="editName.set($any($event.target).value)"
                    class="edit-input"
                    maxlength="50"
                    (keydown.enter)="saveEdit(tag)"
                    (keydown.escape)="cancelEdit()"
                    autofocus
                  />
                  <button class="btn-sm btn-save" (click)="saveEdit(tag)">{{ 'tags.save' | translate }}</button>
                  <button class="btn-sm btn-cancel" (click)="cancelEdit()">{{ 'common.cancel' | translate }}</button>
                </div>
              } @else {
                <div class="tag-row">
                  <span class="tag-name">{{ tag.name }}</span>
                  <span class="tag-count">{{ tag.files_count ?? 0 }}</span>
                  <div class="tag-actions">
                    <a
                      [routerLink]="['/files']"
                      [queryParams]="{ tag_id: tag.id }"
                      class="btn-sm btn-view"
                    >{{ 'tags.view_files' | translate }}</a>
                    <button class="btn-sm btn-edit" (click)="startEdit(tag)">{{ 'tags.edit' | translate }}</button>
                    <button class="btn-sm btn-delete" (click)="confirmDelete(tag)">{{ 'tags.delete' | translate }}</button>
                  </div>
                </div>
              }
            </li>
          }
        </ul>
      }

      <!-- Confirm delete modal -->
      @if (deleteTarget()) {
        <div class="modal-backdrop" (click)="cancelDelete()">
          <div class="modal" (click)="$event.stopPropagation()">
            <h3>{{ 'tags.confirm_delete_title' | translate }}</h3>
            <p>{{ 'tags.confirm_delete_desc' | translate : { name: deleteTarget()!.name } }}</p>
            <div class="modal-actions">
              <button class="btn-primary btn-danger" (click)="deleteTag()" [disabled]="deleting()">
                {{ deleting() ? ('tags.deleting' | translate) : ('tags.delete_btn' | translate) }}
              </button>
              <button class="btn-secondary" (click)="cancelDelete()">{{ 'common.cancel' | translate }}</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .page { max-width: 640px; margin: 0 auto; padding: 32px 20px; }
    .page-header h1 { font-size: 1.5rem; font-weight: 700; margin: 0 0 24px; }
    .add-card { background: #fff; border-radius: 10px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 4px rgba(0,0,0,.06); }
    .add-form { display: flex; gap: 10px; }
    .add-input { flex: 1; border: 1px solid #d1d5db; border-radius: 6px; padding: 9px 12px; font-size: 0.95rem; outline: none; }
    .add-input:focus { border-color: #6366f1; }
    .search-row { margin-bottom: 16px; }
    .search-input { width: 100%; border: 1px solid #d1d5db; border-radius: 6px; padding: 9px 12px; font-size: 0.93rem; outline: none; box-sizing: border-box; }
    .loading-text, .empty-text { color: #6b7280; text-align: center; padding: 32px 0; }
    .tags-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
    .tag-item { background: #fff; border-radius: 8px; padding: 14px 16px; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
    .tag-row { display: flex; align-items: center; gap: 10px; }
    .tag-name { flex: 1; font-weight: 500; font-size: 0.97rem; }
    .tag-count { font-size: 0.82rem; color: #6b7280; background: #f3f4f6; border-radius: 12px; padding: 2px 8px; }
    .tag-actions { display: flex; gap: 6px; }
    .edit-row { display: flex; gap: 8px; align-items: center; }
    .edit-input { flex: 1; border: 1px solid #6366f1; border-radius: 6px; padding: 7px 10px; font-size: 0.95rem; outline: none; }
    .btn-primary { background: #6366f1; color: #fff; border: none; padding: 9px 18px; border-radius: 6px; font-size: 0.9rem; font-weight: 600; cursor: pointer; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-primary.btn-danger { background: #ef4444; }
    .btn-secondary { background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; padding: 9px 18px; border-radius: 6px; font-size: 0.9rem; cursor: pointer; }
    .btn-sm { font-size: 0.8rem; padding: 5px 10px; border-radius: 5px; border: none; cursor: pointer; font-weight: 500; }
    .btn-view { background: #ede9fe; color: #5b21b6; text-decoration: none; display: inline-block; }
    .btn-edit { background: #e0f2fe; color: #0369a1; }
    .btn-save { background: #d1fae5; color: #065f46; }
    .btn-cancel { background: #f3f4f6; color: #374151; }
    .btn-delete { background: #fee2e2; color: #dc2626; }
    .field-error { color: #dc2626; font-size: 0.82rem; margin-top: 6px; }
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; z-index: 300; }
    .modal { background: #fff; border-radius: 12px; padding: 28px; max-width: 380px; width: 90%; }
    .modal h3 { margin: 0 0 10px; font-size: 1.1rem; }
    .modal p { color: #374151; font-size: 0.93rem; margin: 0 0 20px; }
    .modal-actions { display: flex; gap: 10px; }
  `],
})
export class TagsListComponent implements OnInit {
  private readonly orgApi = inject(OrganizationApiService);
  private readonly fb     = inject(FormBuilder);

  readonly loading     = signal(true);
  readonly adding      = signal(false);
  readonly deleting    = signal(false);
  readonly addError    = signal<string | null>(null);
  readonly tags        = signal<Tag[]>([]);
  readonly searchQuery = signal('');
  readonly editingId   = signal<string | null>(null);
  readonly editName    = signal('');
  readonly deleteTarget = signal<Tag | null>(null);

  readonly filtered = computed(() => {
    const q = this.searchQuery().toLowerCase();
    if (!q) return this.tags();
    return this.tags().filter(t => t.name.toLowerCase().includes(q));
  });

  readonly addForm = this.fb.group({ name: ['', [Validators.required, Validators.maxLength(50)]] });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.orgApi.getTags().subscribe({
      next: (res) => {
        this.tags.set(res.data.items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  addTag(): void {
    if (this.addForm.invalid || this.adding()) return;
    this.adding.set(true);
    this.addError.set(null);

    this.orgApi.createTag(this.addForm.getRawValue().name!).subscribe({
      next: (res) => {
        this.tags.update(ts => [res.data.tag, ...ts]);
        this.addForm.reset();
        this.adding.set(false);
      },
      error: (err) => {
        this.adding.set(false);
        this.addError.set(err.message ?? 'Ошибка создания тега');
      },
    });
  }

  startEdit(tag: Tag): void {
    this.editingId.set(tag.id);
    this.editName.set(tag.name);
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  saveEdit(tag: Tag): void {
    const name = this.editName().trim();
    if (!name || name === tag.name) { this.cancelEdit(); return; }

    this.orgApi.updateTag(tag.id, name).subscribe({
      next: (res) => {
        this.tags.update(ts => ts.map(t => t.id === tag.id ? { ...t, name: res.data.tag.name } : t));
        this.cancelEdit();
      },
      error: (err) => alert(err.message ?? 'Ошибка'),
    });
  }

  confirmDelete(tag: Tag): void {
    this.deleteTarget.set(tag);
  }

  cancelDelete(): void {
    this.deleteTarget.set(null);
  }

  deleteTag(): void {
    const tag = this.deleteTarget();
    if (!tag || this.deleting()) return;
    this.deleting.set(true);

    this.orgApi.deleteTag(tag.id).subscribe({
      next: () => {
        this.tags.update(ts => ts.filter(t => t.id !== tag.id));
        this.deleteTarget.set(null);
        this.deleting.set(false);
      },
      error: (err) => {
        this.deleting.set(false);
        alert(err.message ?? 'Ошибка');
      },
    });
  }
}
