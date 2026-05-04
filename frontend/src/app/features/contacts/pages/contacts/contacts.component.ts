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
  template: `
    <div class="page">
      <div class="page-header">
        <h1 class="page-title">{{ 'contacts.title' | translate }}</h1>
        <button class="btn-primary" (click)="showAddForm.set(!showAddForm())">
          {{ showAddForm() ? ('contacts.cancel_btn' | translate) : ('contacts.add_btn' | translate) }}
        </button>
      </div>

      <!-- Add contact form -->
      @if (showAddForm()) {
        <div class="add-form-card">
          <h3>{{ 'contacts.new_contact' | translate }}</h3>
          <form [formGroup]="addForm" (ngSubmit)="addContact()" class="add-form" novalidate>
            <div class="form-row">
              <div class="field">
                <label for="contact-name">{{ 'contacts.name' | translate }}</label>
                <input id="contact-name" type="text" formControlName="name" [placeholder]="'contacts.name_placeholder' | translate" />
              </div>
              <div class="field">
                <label for="contact-email">{{ 'contacts.email' | translate }}</label>
                <input id="contact-email" type="email" formControlName="email" placeholder="friend@example.com" />
              </div>
            </div>
            @if (addError()) {
              <div class="error-msg" role="alert">{{ addError() }}</div>
            }
            <div class="form-actions">
              <button type="submit" class="btn-primary" [disabled]="addForm.invalid || adding()">
                {{ adding() ? ('contacts.add_submitting' | translate) : ('contacts.add_submit' | translate) }}
              </button>
            </div>
          </form>
        </div>
      }

      <!-- Search + resolve -->
      <div class="toolbar">
        <input
          class="search-input"
          type="search"
          [placeholder]="'contacts.search' | translate"
          (input)="onSearch($event)"
          aria-label="{{ 'contacts.search' | translate }}"
        />
        <button class="btn-outline" (click)="resolveContacts()" [disabled]="resolving()">
          {{ resolving() ? ('contacts.resolving' | translate) : ('contacts.resolve_btn' | translate) }}
        </button>
      </div>

      <!-- Feedback -->
      @if (feedback()) {
        <div class="feedback" role="status">{{ feedback() }}</div>
      }

      <!-- Loading -->
      @if (loading()) {
        <div class="loading-state">{{ 'contacts.loading' | translate }}</div>
      }

      <!-- Empty -->
      @if (!loading() && contacts().length === 0) {
        <div class="empty-state">
          <span class="empty-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9126d9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-users-icon lucide-users"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/></svg></span>
          <p>{{ 'contacts.empty' | translate }}</p>
        </div>
      }

      <!-- Contact list -->
      @if (!loading() && contacts().length > 0) {
        <div class="contact-grid">
          @for (contact of contacts(); track contact.id) {
            <div class="contact-card">
              <div class="contact-avatar" aria-hidden="true">{{ contact.name[0]?.toUpperCase() }}</div>
              <div class="contact-info">
                <p class="contact-name">{{ contact.name }}</p>
                <p class="contact-email">{{ contact.email ?? contact.phone ?? '—' }}</p>
              </div>
              <div class="contact-status">
                <span class="reg-badge" [class.registered]="contact.is_registered">
                  {{ contact.is_registered ? ('contacts.in_app' | translate) : ('contacts.not_registered' | translate) }}
                </span>
              </div>
              <button
                class="btn-delete"
                [attr.aria-label]="'contacts.delete_btn' | translate"
                [disabled]="deletingId() === contact.id"
                (click)="deleteContact(contact)"
              >
                {{ deletingId() === contact.id ? '…' : '✕' }}
              </button>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page { padding: 28px 32px; max-width: 860px; }
    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
    .page-title { font-size: 1.6rem; font-weight: 700; color: #1a1a2e; margin: 0; }

    .add-form-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px 24px; margin-bottom: 22px; }
    .add-form-card h3 { margin: 0 0 14px; font-size: 1rem; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .field label { display: block; font-size: 0.85rem; font-weight: 600; color: #374151; margin-bottom: 5px; }
    .field input { width: 100%; padding: 9px 12px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; outline: none; box-sizing: border-box; }
    .field input:focus { border-color: #6366f1; }
    .form-actions { margin-top: 14px; }
    .error-msg { color: #dc2626; font-size: 0.85rem; margin-top: 8px; }

    .toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
    .search-input { flex: 1; padding: 9px 14px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; outline: none; }
    .search-input:focus { border-color: #6366f1; }

    .feedback { background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 10px 14px; color: #15803d; font-size: 0.88rem; margin-bottom: 14px; }
    .loading-state, .empty-state { text-align: center; padding: 60px 20px; color: #9ca3af; }
    .empty-icon { font-size: 3rem; display: block; margin-bottom: 12px; }

    .contact-grid { display: flex; flex-direction: column; gap: 8px; }
    .contact-card { display: flex; align-items: center; gap: 14px; background: #fff; border: 1px solid #f0f0f0; border-radius: 12px; padding: 14px 18px; }
    .contact-avatar { width: 42px; height: 42px; border-radius: 50%; background: #6366f1; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.1rem; flex-shrink: 0; }
    .contact-info { flex: 1; }
    .contact-name { font-size: 0.95rem; font-weight: 600; margin: 0 0 3px; }
    .contact-email { font-size: 0.82rem; color: #9ca3af; margin: 0; }
    .contact-status { flex-shrink: 0; }
    .reg-badge { font-size: 0.75rem; padding: 3px 10px; border-radius: 99px; background: #fee2e2; color: #dc2626; }
    .reg-badge.registered { background: #dcfce7; color: #16a34a; }

    .btn-delete { background: none; border: none; color: #9ca3af; font-size: 0.9rem; cursor: pointer; padding: 6px 8px; border-radius: 6px; flex-shrink: 0; line-height: 1; }
    .btn-delete:hover:not(:disabled) { background: #fee2e2; color: #dc2626; }
    .btn-delete:disabled { opacity: 0.4; cursor: not-allowed; }

    .btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px; background: #6366f1; color: #fff; border: none; border-radius: 8px; font-size: 0.9rem; font-weight: 600; cursor: pointer; }
    .btn-primary:hover:not(:disabled) { background: #4f46e5; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-outline { padding: 9px 16px; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.88rem; cursor: pointer; color: #374151; }
    .btn-outline:hover:not(:disabled) { background: #f9fafb; }
    .btn-outline:disabled { opacity: 0.5; cursor: not-allowed; }
  `],
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
