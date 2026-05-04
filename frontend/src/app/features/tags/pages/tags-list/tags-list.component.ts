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
  templateUrl: './tags-list.component.html',
  styleUrl: './tags-list.component.scss',
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
