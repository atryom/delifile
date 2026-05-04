import { Component, inject, signal, input, output, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FilesApiService } from '../../../../core/api/files-api.service';
import { ContactsApiService } from '../../../../core/api/domain-api.services';
import { Contact } from '../../../../shared/models/api.models';

@Component({
  selector: 'app-share-contact-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslateModule],
  templateUrl: './share-contact-dialog.component.html',
  styleUrl: './share-contact-dialog.component.scss',
})
export class ShareContactDialogComponent implements OnInit {
  readonly fileId = input.required<string>();
  readonly closed  = output<void>();
  readonly shared  = output<void>();

  private readonly filesApi    = inject(FilesApiService);
  private readonly contactsApi = inject(ContactsApiService);
  private readonly translate   = inject(TranslateService);

  readonly contacts        = signal<Contact[]>([]);
  readonly selectedId      = signal<string | null>(null);
  readonly selectedContact = signal<Contact | null>(null);
  readonly loading         = signal(false);
  readonly submitting      = signal(false);
  readonly error           = signal<string | null>(null);
  readonly shareStatus     = signal<'none' | 'pending' | 'shared'>('none');
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
    this.selectedContact.set(contact);
    this.error.set(null);
    this.shareStatus.set('none');
  }

  submit(): void {
    const id = this.selectedId();
    if (!id || this.submitting()) return;

    this.submitting.set(true);
    this.error.set(null);

    this.filesApi.shareToContact(this.fileId(), id).subscribe({
      next: (res) => {
        this.submitting.set(false);
        const status = res.data?.share?.status ?? 'shared';
        this.shareStatus.set(status as 'pending' | 'shared');
        if (status === 'shared') {
          this.shared.emit();
        } else {
          setTimeout(() => this.closed.emit(), 2500);
        }
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err?.message ?? this.translate.instant('files.share.error'));
      },
    });
  }
}
