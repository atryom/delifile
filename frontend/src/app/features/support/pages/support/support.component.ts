import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { SupportApiService } from '../../../../core/api/support-api.service';
import {
  SupportTicketListItem,
  SupportTicketDetail,
  SupportMessageItem,
  SuggestionItem,
  SupportAttachmentItem,
  PaginatedData,
} from '../../../../shared/models/api.models';
import { formatSize } from '../../../../shared/utils/format';

type SupportTab = 'tickets' | 'suggestions';

@Component({
  selector: 'app-support',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './support.component.html',
  styleUrl: './support.component.scss',
})
export class SupportComponent implements OnInit {
  private readonly api = inject(SupportApiService);
  private readonly fb  = inject(FormBuilder);

  readonly activeTab = signal<SupportTab>('tickets');

  // ─── Tickets ──────────────────────────────────────────────────────────────
  readonly tickets          = signal<SupportTicketListItem[]>([]);
  readonly ticketsPagination = signal<PaginatedData<SupportTicketListItem>['pagination'] | null>(null);
  readonly ticketsPage      = signal(1);
  readonly ticketsLoading   = signal(false);
  readonly ticketsError     = signal(false);

  readonly activeTicket     = signal<SupportTicketDetail | null>(null);
  readonly ticketLoading    = signal(false);
  readonly ticketError      = signal(false);

  readonly creatingTicket   = signal(false);
  readonly showCreateTicket = signal(false);

  readonly sendingMessage   = signal(false);
  readonly messageError     = signal<string | null>(null);

  private _markReadTimer: ReturnType<typeof setTimeout> | null = null;

  readonly ticketForm = this.fb.group({
    body: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(10000)]],
  });

  readonly messageForm = this.fb.group({
    body: ['', [Validators.required, Validators.maxLength(10000)]],
  });

  readonly ticketAttachments  = signal<File[]>([]);
  readonly messageAttachments = signal<File[]>([]);
  readonly attachmentError    = signal<string | null>(null);

  readonly confirmingTicket = signal(false);

  // ─── Suggestions ─────────────────────────────────────────────────────────
  readonly suggestions          = signal<SuggestionItem[]>([]);
  readonly suggestionsPagination = signal<PaginatedData<SuggestionItem>['pagination'] | null>(null);
  readonly suggestionsPage      = signal(1);
  readonly suggestionsLoading   = signal(false);
  readonly suggestionsError     = signal(false);

  readonly showCreateSuggestion = signal(false);
  readonly creatingSuggestion   = signal(false);
  readonly suggestionError      = signal<string | null>(null);

  readonly suggestionForm = this.fb.group({
    body: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(10000)]],
  });
  readonly suggestionAttachments = signal<File[]>([]);

  readonly totalPages = computed(() => {
    const p = this.ticketsPagination();
    return p ? Math.ceil(p.total / p.per_page) : 1;
  });

  readonly suggestionTotalPages = computed(() => {
    const p = this.suggestionsPagination();
    return p ? Math.ceil(p.total / p.per_page) : 1;
  });

  ngOnInit(): void {
    this.loadTickets();
  }

  setTab(tab: SupportTab): void {
    this.activeTab.set(tab);
    this.activeTicket.set(null);
    this.showCreateTicket.set(false);
    this.showCreateSuggestion.set(false);
    if (tab === 'tickets' && this.tickets().length === 0) {
      this.loadTickets();
    }
    if (tab === 'suggestions' && this.suggestions().length === 0) {
      this.loadSuggestions();
    }
  }

  // ─── Tickets ──────────────────────────────────────────────────────────────

  loadTickets(page = this.ticketsPage()): void {
    this.ticketsLoading.set(true);
    this.ticketsError.set(false);
    this.api.getTickets(page).subscribe({
      next: res => {
        this.tickets.set(res.data.items);
        this.ticketsPagination.set(res.data.pagination);
        this.ticketsPage.set(page);
        this.ticketsLoading.set(false);
      },
      error: () => {
        this.ticketsError.set(true);
        this.ticketsLoading.set(false);
      },
    });
  }

  openTicket(ticketId: string): void {
    this.showCreateTicket.set(false);
    this.ticketError.set(false);
    this.ticketLoading.set(true);
    this.messageForm.reset();
    this.messageAttachments.set([]);
    this.messageError.set(null);

    this.api.getTicket(ticketId).subscribe({
      next: res => {
        this.activeTicket.set(res.data.ticket);
        this.ticketLoading.set(false);
        this._scheduleMarkRead(ticketId);
      },
      error: () => {
        this.ticketError.set(true);
        this.ticketLoading.set(false);
      },
    });
  }

  closeTicket(): void {
    this._cancelMarkRead();
    this.activeTicket.set(null);
    this.messageForm.reset();
    this.messageAttachments.set([]);
    this.messageError.set(null);
  }

  private _scheduleMarkRead(ticketId: string): void {
    this._cancelMarkRead();
    this._markReadTimer = setTimeout(() => {
      this.api.markTicketRead(ticketId).subscribe(() => {
        // Update local unread count in list
        this.tickets.update(list =>
          list.map(t => t.id === ticketId ? { ...t, unread_count: 0 } : t)
        );
      });
    }, 2000);
  }

  private _cancelMarkRead(): void {
    if (this._markReadTimer !== null) {
      clearTimeout(this._markReadTimer);
      this._markReadTimer = null;
    }
  }

  sendMessage(): void {
    this.messageForm.markAllAsTouched();
    const ticket = this.activeTicket();
    if (!ticket || this.messageForm.invalid || this.sendingMessage()) return;

    this.messageError.set(null);
    this.sendingMessage.set(true);

    this.api.sendMessage(ticket.id, this.messageForm.value.body!, this.messageAttachments()).subscribe({
      next: res => {
        this.activeTicket.update(t => t ? { ...t, messages: [...t.messages, res.data.message] } : t);
        // If ticket was awaiting_confirmation, backend resets to in_progress
        if (ticket.status === 'awaiting_confirmation') {
          this.activeTicket.update(t => t ? { ...t, status: 'in_progress' } : t);
          this.tickets.update(list => list.map(item =>
            item.id === ticket.id ? { ...item, status: 'in_progress' } : item
          ));
        }
        this.messageForm.reset();
        this.messageAttachments.set([]);
        this.sendingMessage.set(false);
      },
      error: (err) => {
        this.messageError.set(err?.message ?? 'Не удалось отправить сообщение');
        this.sendingMessage.set(false);
      },
    });
  }

  confirmTicket(): void {
    const ticket = this.activeTicket();
    if (!ticket || this.confirmingTicket()) return;
    this.confirmingTicket.set(true);

    this.api.confirmTicket(ticket.id).subscribe({
      next: () => {
        this.activeTicket.update(t => t ? { ...t, status: 'completed', completion_reason: 'user_confirmed' } : t);
        this.tickets.update(list => list.map(item =>
          item.id === ticket.id ? { ...item, status: 'completed' } : item
        ));
        this.confirmingTicket.set(false);
      },
      error: () => this.confirmingTicket.set(false),
    });
  }

  // ─── Create Ticket ────────────────────────────────────────────────────────

  openCreateTicket(): void {
    this.activeTicket.set(null);
    this.showCreateTicket.set(true);
    this.ticketForm.reset();
    this.ticketAttachments.set([]);
    this.attachmentError.set(null);
  }

  cancelCreateTicket(): void {
    this.showCreateTicket.set(false);
    this.ticketForm.reset();
    this.ticketAttachments.set([]);
    this.attachmentError.set(null);
  }

  submitTicket(): void {
    this.ticketForm.markAllAsTouched();
    if (this.ticketForm.invalid || this.creatingTicket()) return;

    this.attachmentError.set(null);
    this.creatingTicket.set(true);

    this.api.createTicket(this.ticketForm.value.body!, this.ticketAttachments()).subscribe({
      next: res => {
        this.showCreateTicket.set(false);
        this.ticketForm.reset();
        this.ticketAttachments.set([]);
        this.creatingTicket.set(false);
        this.loadTickets(1);
        this.activeTicket.set(res.data.ticket);
      },
      error: (err) => {
        this.attachmentError.set(err?.message ?? 'Не удалось создать обращение');
        this.creatingTicket.set(false);
      },
    });
  }

  // ─── Suggestions ─────────────────────────────────────────────────────────

  loadSuggestions(page = this.suggestionsPage()): void {
    this.suggestionsLoading.set(true);
    this.suggestionsError.set(false);
    this.api.getSuggestions(page).subscribe({
      next: res => {
        this.suggestions.set(res.data.items);
        this.suggestionsPagination.set(res.data.pagination);
        this.suggestionsPage.set(page);
        this.suggestionsLoading.set(false);
      },
      error: () => {
        this.suggestionsError.set(true);
        this.suggestionsLoading.set(false);
      },
    });
  }

  openCreateSuggestion(): void {
    this.showCreateSuggestion.set(true);
    this.suggestionForm.reset();
    this.suggestionAttachments.set([]);
    this.suggestionError.set(null);
  }

  cancelCreateSuggestion(): void {
    this.showCreateSuggestion.set(false);
    this.suggestionForm.reset();
    this.suggestionAttachments.set([]);
    this.suggestionError.set(null);
  }

  submitSuggestion(): void {
    this.suggestionForm.markAllAsTouched();
    if (this.suggestionForm.invalid || this.creatingSuggestion()) return;

    this.suggestionError.set(null);
    this.creatingSuggestion.set(true);

    this.api.createSuggestion(this.suggestionForm.value.body!, this.suggestionAttachments()).subscribe({
      next: () => {
        this.showCreateSuggestion.set(false);
        this.suggestionForm.reset();
        this.suggestionAttachments.set([]);
        this.creatingSuggestion.set(false);
        this.loadSuggestions(1);
      },
      error: (err) => {
        this.suggestionError.set(err?.message ?? 'Не удалось отправить предложение');
        this.creatingSuggestion.set(false);
      },
    });
  }

  // ─── File Inputs ──────────────────────────────────────────────────────────

  onTicketFiles(event: Event): void {
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    this.attachmentError.set(null);
    const err = this._validateUserFiles(files);
    if (err) { this.attachmentError.set(err); return; }
    this.ticketAttachments.set(files);
  }

  onMessageFiles(event: Event): void {
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    this.messageError.set(null);
    const err = this._validateUserFiles(files);
    if (err) { this.messageError.set(err); return; }
    this.messageAttachments.set(files);
  }

  onSuggestionFiles(event: Event): void {
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    this.suggestionError.set(null);
    const err = this._validateUserFiles(files);
    if (err) { this.suggestionError.set(err); return; }
    this.suggestionAttachments.set(files);
  }

  private _validateUserFiles(files: File[]): string | null {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    for (const f of files) {
      if (!allowed.includes(f.type)) {
        return 'Разрешены только файлы JPG, JPEG, PNG, WEBP, GIF. Общий размер вложений в одном сообщении не должен превышать 10 МБ.';
      }
    }
    const total = files.reduce((s, f) => s + f.size, 0);
    if (total > 10 * 1024 * 1024) {
      return 'Общий размер вложений в одном сообщении не должен превышать 10 МБ.';
    }
    return null;
  }

  downloadAttachment(ticketId: string, attachment: SupportAttachmentItem): void {
    this.api.getAttachmentUrl(ticketId, attachment.id).subscribe({
      next: res => {
        const a = document.createElement('a');
        a.href = res.data.url;
        a.download = res.data.original_name;
        a.target = '_blank';
        a.click();
      },
    });
  }

  downloadSuggestionAttachment(suggestionId: string, attachment: SupportAttachmentItem): void {
    this.api.getSuggestionAttachmentUrl(suggestionId, attachment.id).subscribe({
      next: res => {
        const a = document.createElement('a');
        a.href = res.data.url;
        a.download = res.data.original_name;
        a.target = '_blank';
        a.click();
      },
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      new: 'Новое',
      in_progress: 'В работе',
      awaiting_confirmation: 'Ожидает подтверждения',
      completed: 'Выполнено',
    };
    return map[status] ?? status;
  }

  suggestionStatusLabel(status: string): string {
    return status === 'accepted' ? 'Принято' : 'Новое';
  }

  formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  formatSize(bytes: number): string { return formatSize(bytes); }

  trackById(_: number, item: { id: string }): string {
    return item.id;
  }
}
