import { Component, inject, signal, input, output, OnInit } from '@angular/core';
import { NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FilesApiService } from '../../../../core/api/files-api.service';
import { ContactsApiService } from '../../../../core/api/domain-api.services';
import { Contact } from '../../../../shared/models/api.models';

@Component({
  selector: 'app-share-contact-dialog',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule, TranslateModule],
  template: `
    <div class="dialog-overlay" (click)="closed.emit()">
      <div class="dialog" (click)="$event.stopPropagation()">
        <div class="dialog-header">
          <h2>{{ 'files.share.title' | translate }}</h2>
          <button class="dialog-close" (click)="closed.emit()">✕</button>
        </div>

        <div class="dialog-body">
          <input
            class="search-input"
            type="search"
            [placeholder]="'files.share.search' | translate"
            [(ngModel)]="searchQuery"
            (ngModelChange)="onSearch($event)"
          />

          <div class="contacts-list" *ngIf="!loading()">
            <div class="empty-contacts" *ngIf="contacts().length === 0">
              {{ searchQuery ? ('files.share.no_contacts' | translate) : ('files.share.no_contacts_yet' | translate) }}
            </div>

            <div
              *ngFor="let contact of contacts()"
              class="contact-item"
              [class.selected]="selectedId() === contact.id"
              (click)="select(contact)"
            >
              <div class="contact-avatar">{{ contact.name[0]?.toUpperCase() }}</div>
              <div class="contact-info">
                <p class="contact-name">{{ contact.name }}</p>
                <p class="contact-phone">{{ contact.phone }}</p>
              </div>
              <span class="reg-badge" [class.registered]="contact.is_registered">
                {{ contact.is_registered ? ('files.share.registered' | translate) : ('files.share.not_registered' | translate) }}
              </span>
            </div>
          </div>

          <div class="loading-contacts" *ngIf="loading()">{{ 'files.share.loading' | translate }}</div>
        </div>

        <div class="dialog-footer">
          <div class="error-msg" *ngIf="error()">{{ error() }}</div>
          <button class="btn-secondary" (click)="closed.emit()">{{ 'files.share.cancel' | translate }}</button>
          <button
            class="btn-primary"
            [disabled]="!selectedId() || submitting()"
            (click)="submit()"
          >
            {{ submitting() ? ('files.share.submitting' | translate) : ('files.share.submit' | translate) }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dialog-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 500; }
    .dialog { background: #fff; border-radius: 14px; width: 480px; max-width: 95vw; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
    .dialog-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px 16px; border-bottom: 1px solid #f0f0f0; }
    .dialog-header h2 { margin: 0; font-size: 1.1rem; font-weight: 700; }
    .dialog-close { background: none; border: none; font-size: 1.1rem; cursor: pointer; color: #9ca3af; }
    .dialog-body { flex: 1; overflow-y: auto; padding: 18px 24px; }
    .dialog-footer { padding: 16px 24px; border-top: 1px solid #f0f0f0; display: flex; justify-content: flex-end; gap: 10px; align-items: center; }
    .search-input { width: 100%; padding: 9px 14px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; outline: none; box-sizing: border-box; margin-bottom: 14px; }
    .search-input:focus { border-color: #6366f1; }
    .contacts-list { display: flex; flex-direction: column; gap: 6px; }
    .empty-contacts, .loading-contacts { text-align: center; color: #9ca3af; font-size: 0.88rem; padding: 20px; }
    .contact-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid #f0f0f0; border-radius: 9px; cursor: pointer; transition: all 0.12s; }
    .contact-item:hover { border-color: #c7d2fe; background: #f5f3ff; }
    .contact-item.selected { border-color: #6366f1; background: #eef2ff; }
    .contact-avatar { width: 36px; height: 36px; border-radius: 50%; background: #6366f1; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1rem; flex-shrink: 0; }
    .contact-info { flex: 1; min-width: 0; }
    .contact-name { font-size: 0.9rem; font-weight: 600; margin: 0 0 2px; }
    .contact-phone { font-size: 0.8rem; color: #9ca3af; margin: 0; }
    .reg-badge { font-size: 0.72rem; padding: 2px 8px; border-radius: 99px; background: #fee2e2; color: #dc2626; white-space: nowrap; }
    .reg-badge.registered { background: #dcfce7; color: #16a34a; }
    .error-msg { flex: 1; color: #dc2626; font-size: 0.85rem; }
    .btn-primary { padding: 9px 20px; background: #6366f1; color: #fff; border: none; border-radius: 8px; font-size: 0.9rem; cursor: pointer; font-weight: 600; }
    .btn-primary:hover:not(:disabled) { background: #4f46e5; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary { padding: 9px 20px; background: #f9fafb; color: #374151; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; cursor: pointer; }
    .btn-secondary:hover { background: #f3f4f6; }
  `],
})
export class ShareContactDialogComponent implements OnInit {
  readonly fileId = input.required<string>();
  readonly closed  = output<void>();
  readonly shared  = output<void>();

  private readonly filesApi    = inject(FilesApiService);
  private readonly contactsApi = inject(ContactsApiService);
  private readonly translate   = inject(TranslateService);

  readonly contacts   = signal<Contact[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly loading    = signal(false);
  readonly submitting = signal(false);
  readonly error      = signal<string | null>(null);
  searchQuery = '';

  ngOnInit(): void {
    this.loadContacts();
  }

  loadContacts(search?: string): void {
    this.loading.set(true);
    this.contactsApi.list(search).subscribe({
      next: (res) => {
        this.contacts.set(res.data.items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onSearch(q: string): void {
    this.loadContacts(q || undefined);
  }

  select(contact: Contact): void {
    this.selectedId.set(contact.id);
    this.error.set(null);
  }

  submit(): void {
    const id = this.selectedId();
    if (!id || this.submitting()) return;

    this.submitting.set(true);
    this.error.set(null);

    this.filesApi.shareToContact(this.fileId(), id).subscribe({
      next: () => {
        this.submitting.set(false);
        this.shared.emit();
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err?.message ?? this.translate.instant('files.share.error'));
      },
    });
  }
}
