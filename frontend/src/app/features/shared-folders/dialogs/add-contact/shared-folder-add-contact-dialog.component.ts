import { Component, input, output, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ContactsApiService } from '../../../../core/api/domain-api.services';
import { SharedFoldersApiService } from '../../../../core/api/shared-folders-api.service';
import { Contact, SharedFolderAccessType } from '../../../../shared/models/api.models';

@Component({
  selector: 'app-shared-folder-add-contact-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslateModule],
  template: `
    <div class="dialog-overlay" (click)="closed.emit()">
      <div class="dialog" (click)="$event.stopPropagation()" role="dialog" [attr.aria-label]="'shared_folders.add_contact_title' | translate">
        <div class="dialog-header">
          <h2>{{ 'shared_folders.add_contact_title' | translate }}</h2>
          <button class="dialog-close" (click)="closed.emit()" aria-label="Закрыть">✕</button>
        </div>

        <div class="dialog-body">
          <input
            class="search-input"
            type="search"
            placeholder="{{ 'files.share.search' | translate }}"
            [(ngModel)]="searchQuery"
            (ngModelChange)="onSearch($event)"
          />

          @if (!loading()) {
            <div class="contacts-list">
              @if (contacts().length === 0) {
                <div class="empty-contacts">
                  {{ searchQuery ? ('files.share.no_contacts' | translate) : ('files.share.no_contacts_yet' | translate) }}
                </div>
              }
              @for (contact of contacts(); track contact.id) {
                <div
                  class="contact-item"
                  [class.selected]="selectedId() === contact.id"
                  (click)="select(contact)"
                >
                  <div class="contact-avatar" aria-hidden="true">{{ contact.name[0]?.toUpperCase() }}</div>
                  <div class="contact-info">
                    <p class="contact-name">{{ contact.name }}</p>
                    <p class="contact-sub">{{ contact.email ?? contact.phone ?? '' }}</p>
                  </div>
                  <span class="reg-badge" [class.registered]="contact.is_registered" [class.pending]="!contact.is_registered">
                    {{ contact.is_registered ? ('files.share.registered' | translate) : ('files.share.pending_invite' | translate) }}
                  </span>
                </div>
              }
            </div>
          }

          @if (loading()) {
            <div class="loading-contacts">{{ 'files.share.loading' | translate }}</div>
          }

          <!-- Access type selector -->
          <div class="access-type-group">
            <label class="access-type-label">{{ 'shared_folders.access_type_view' | translate }}</label>
            <div class="btn-group" role="group" aria-label="Тип доступа">
              <button
                type="button"
                class="btn-group-item"
                [class.active]="accessType() === 'view'"
                (click)="accessType.set('view')"
              >{{ 'shared_folders.access_type_view' | translate }}</button>
              <button
                type="button"
                class="btn-group-item"
                [class.active]="accessType() === 'edit'"
                (click)="accessType.set('edit')"
              >{{ 'shared_folders.access_type_edit' | translate }}</button>
            </div>
          </div>
        </div>

        <div class="dialog-footer">
          @if (error()) {
            <div class="error-msg">{{ error() }}</div>
          }
          <button class="btn-secondary" (click)="closed.emit()">{{ 'common.cancel' | translate }}</button>
          <button
            class="btn-primary"
            [disabled]="!selectedId() || submitting()"
            (click)="submit()"
          >
            {{ submitting() ? ('shared_folders.add_contact_submitting' | translate) : ('shared_folders.add_contact_submit' | translate) }}
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrl: './shared-folder-add-contact-dialog.component.scss',
})
export class SharedFolderAddContactDialogComponent implements OnInit {
  readonly folderId = input.required<string>();
  readonly closed   = output<void>();
  readonly added    = output<void>();

  private readonly contactsApi = inject(ContactsApiService);
  private readonly sfApi       = inject(SharedFoldersApiService);

  readonly loading    = signal(false);
  readonly submitting = signal(false);
  readonly contacts   = signal<Contact[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly error      = signal<string | null>(null);
  readonly accessType = signal<SharedFolderAccessType>('view');

  searchQuery = '';
  private searchTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.loadContacts('');
  }

  private loadContacts(q: string): void {
    this.loading.set(true);
    this.contactsApi.list(q || undefined).subscribe({
      next: (res) => { this.contacts.set(res.data.items); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  onSearch(q: string): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.loadContacts(q), 300);
  }

  select(contact: Contact): void {
    this.selectedId.set(contact.id);
  }

  submit(): void {
    const id = this.selectedId();
    if (!id || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);

    this.sfApi.addAccess(this.folderId(), id, this.accessType()).subscribe({
      next: () => { this.submitting.set(false); this.added.emit(); this.closed.emit(); },
      error: (err) => { this.submitting.set(false); this.error.set(err.message ?? 'Ошибка'); },
    });
  }
}
