import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ContactsApiService } from '../../../../core/api/domain-api.services';
import { Contact } from '../../../../shared/models/api.models';

@Component({
  selector: 'app-contacts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslateModule],
  templateUrl: './contacts.component.html',
  styleUrl: './contacts.component.scss',
})
export class ContactsComponent implements OnInit {
  private readonly contactsApi = inject(ContactsApiService);
  private readonly fb          = inject(FormBuilder);
  private readonly translate   = inject(TranslateService);

  readonly contacts    = signal<Contact[]>([]);
  readonly loading     = signal(false);
  readonly adding      = signal(false);
  readonly resolving   = signal(false);
  readonly deletingId  = signal<string | null>(null);
  readonly showAddForm = signal(false);
  readonly addError    = signal<string | null>(null);
  readonly feedback    = signal<string | null>(null);
  private searchTimer?: ReturnType<typeof setTimeout>;

  readonly addForm = this.fb.group({
    name:  ['', [Validators.required]],
    email: ['', [Validators.email]],
  });

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

  onSearch(e: Event): void {
    const q = (e.target as HTMLInputElement).value;
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.loadContacts(q || undefined), 350);
  }

  addContact(): void {
    if (this.addForm.invalid || this.adding()) return;
    this.adding.set(true);
    this.addError.set(null);

    const { name, email } = this.addForm.getRawValue();
    const emailNorm = email?.trim().toLowerCase() || null;

    // Client-side duplicate check
    if (emailNorm) {
      const exists = this.contacts().some(c => c.email?.toLowerCase() === emailNorm);
      if (exists) {
        this.adding.set(false);
        this.addError.set(this.translate.instant('contacts.duplicate_error'));
        return;
      }
    }

    this.contactsApi.create({ name: name!, email: emailNorm }).subscribe({
      next: (res) => {
        this.adding.set(false);
        this.addForm.reset();
        this.showAddForm.set(false);
        const msg = res.data.invitation_sent
          ? this.translate.instant('contacts.added_with_invite', { email: emailNorm })
          : this.translate.instant('contacts.added');
        this.showFeedback(msg);
        this.loadContacts();
      },
      error: (err) => {
        this.adding.set(false);
        this.addError.set(err?.message ?? this.translate.instant('contacts.add_error'));
      },
    });
  }

  resolveContacts(): void {
    this.resolving.set(true);
    this.contactsApi.resolve().subscribe({
      next: (res) => {
        this.resolving.set(false);
        const n = res.data.newly_resolved;
        this.showFeedback(this.translate.instant('contacts.resolved', { n }));
        this.loadContacts();
      },
      error: () => this.resolving.set(false),
    });
  }

  deleteContact(contact: Contact): void {
    if (this.deletingId()) return;
    if (!confirm(this.translate.instant('contacts.delete_confirm', { name: contact.name }))) return;
    this.deletingId.set(contact.id);
    this.contactsApi.delete(contact.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.contacts.update(list => list.filter(c => c.id !== contact.id));
        this.showFeedback(this.translate.instant('contacts.deleted'));
      },
      error: () => {
        this.deletingId.set(null);
        this.showFeedback(this.translate.instant('contacts.delete_error'));
      },
    });
  }

  private showFeedback(msg: string): void {
    this.feedback.set(msg);
    setTimeout(() => this.feedback.set(null), 4000);
  }
}
