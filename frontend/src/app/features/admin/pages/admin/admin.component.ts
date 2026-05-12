import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AdminApiService } from '../../../../core/api/admin-api.service';
import { SupportApiService } from '../../../../core/api/support-api.service';
import {
  AdminStats,
  AdminUser,
  TariffPlan,
  SupportTicketListItem,
  SupportTicketDetail,
  SupportMessageItem,
  SuggestionItem,
  SuggestionDetail,
  PaginatedData,
} from '../../../../shared/models/api.models';

type AdminTab = 'stats' | 'users' | 'support' | 'suggestions';

@Component({
  selector: 'app-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent {
  private readonly adminApi   = inject(AdminApiService);
  private readonly supportApi = inject(SupportApiService);
  private readonly fb         = inject(FormBuilder);

  readonly activeTab  = signal<AdminTab>('stats');
  readonly stats      = signal<AdminStats | null>(null);
  readonly users      = signal<AdminUser[]>([]);
  readonly statsError = signal(false);
  readonly usersError = signal(false);

  readonly editingPlan       = signal<Record<string, TariffPlan>>({});
  readonly savingPlan        = signal<Record<string, boolean>>({});
  readonly blockingUser      = signal<Record<string, boolean>>({});
  readonly resetLinkMap      = signal<Record<string, string>>({});
  readonly resetLinkLoading  = signal<Record<string, boolean>>({});
  readonly resetSessionsLoading = signal<Record<string, boolean>>({});
  readonly confirmReset      = signal<string | null>(null);

  // ─── Notify dialog ────────────────────────────────────────────────────────
  readonly notifyTarget  = signal<{ userId: string; email: string } | 'all' | null>(null);
  readonly notifyTitle   = signal('');
  readonly notifyBody    = signal('');
  readonly notifySending = signal(false);
  readonly notifyError   = signal<string | null>(null);
  readonly notifyDone    = signal(false);

  // ─── Admin Support Tickets ────────────────────────────────────────────────
  readonly supportTickets       = signal<(SupportTicketListItem & { user: { id: number; email: string; name: string | null } | null })[]>([]);
  readonly supportTicketsPagination = signal<PaginatedData<any>['pagination'] | null>(null);
  readonly supportTicketsPage   = signal(1);
  readonly supportTicketsLoading = signal(false);
  readonly supportTicketsError  = signal(false);
  readonly supportStatusFilter  = signal('');

  readonly activeTicket         = signal<SupportTicketDetail | null>(null);
  readonly ticketLoading        = signal(false);
  readonly ticketError          = signal(false);
  readonly sendingMessage       = signal(false);
  readonly messageSendError     = signal<string | null>(null);
  readonly changingStatus       = signal(false);

  private _markReadTimer: ReturnType<typeof setTimeout> | null = null;

  readonly adminMessageForm = this.fb.group({
    body: ['', [Validators.required, Validators.maxLength(50000)]],
  });
  readonly adminMsgAttachments = signal<File[]>([]);
  readonly adminMsgAttachError = signal<string | null>(null);

  readonly supportTicketTotalPages = computed(() => {
    const p = this.supportTicketsPagination();
    return p ? Math.ceil(p.total / p.per_page) : 1;
  });

  // ─── Admin Suggestions ────────────────────────────────────────────────────
  readonly adminSuggestions        = signal<SuggestionItem[]>([]);
  readonly suggestionsPagination   = signal<PaginatedData<SuggestionItem>['pagination'] | null>(null);
  readonly suggestionsPage         = signal(1);
  readonly suggestionsLoading      = signal(false);
  readonly suggestionsError        = signal(false);
  readonly suggestionsStatusFilter = signal('');

  readonly activeSuggestion        = signal<SuggestionDetail | null>(null);
  readonly suggestionLoading       = signal(false);
  readonly suggestionError         = signal(false);
  readonly updatingSuggStatus      = signal(false);
  readonly addingComment           = signal(false);
  readonly commentError            = signal<string | null>(null);

  readonly commentForm = this.fb.group({
    body: ['', [Validators.required, Validators.maxLength(10000)]],
  });

  readonly suggestionsTotalPages = computed(() => {
    const p = this.suggestionsPagination();
    return p ? Math.ceil(p.total / p.per_page) : 1;
  });

  constructor() {
    this.loadStats();
    this.loadUsers();
  }

  setTab(tab: AdminTab): void {
    this.activeTab.set(tab);
    this.activeTicket.set(null);
    this.activeSuggestion.set(null);

    if (tab === 'support' && this.supportTickets().length === 0) {
      this.loadSupportTickets();
    }
    if (tab === 'suggestions' && this.adminSuggestions().length === 0) {
      this.loadSuggestions();
    }
  }

  // ─── Stats & Users ────────────────────────────────────────────────────────

  loadStats(): void {
    this.statsError.set(false);
    this.adminApi.getStats().subscribe({
      next: res => this.stats.set(res.data),
      error: () => this.statsError.set(true),
    });
  }

  loadUsers(): void {
    this.usersError.set(false);
    this.adminApi.getUsers().subscribe({
      next: res => this.users.set(res.data.items),
      error: () => this.usersError.set(true),
    });
  }

  setPlanEdit(userId: string, plan: TariffPlan): void {
    this.editingPlan.update(m => ({ ...m, [userId]: plan }));
  }

  getPlanEdit(userId: string, defaultPlan: TariffPlan | null): TariffPlan {
    return this.editingPlan()[userId] ?? defaultPlan ?? 'free';
  }

  savePlan(userId: string): void {
    const plan = this.editingPlan()[userId];
    if (!plan) return;
    this.savingPlan.update(m => ({ ...m, [userId]: true }));
    this.adminApi.updatePlan(userId, plan).subscribe({
      next: () => {
        this.users.update(list =>
          list.map(u => u.id === userId ? { ...u, plan } : u)
        );
        this.savingPlan.update(m => ({ ...m, [userId]: false }));
        this.editingPlan.update(m => { const n = { ...m }; delete n[userId]; return n; });
      },
      error: () => this.savingPlan.update(m => ({ ...m, [userId]: false })),
    });
  }

  toggleBlock(userId: string): void {
    this.blockingUser.update(m => ({ ...m, [userId]: true }));
    this.adminApi.blockUser(userId).subscribe({
      next: res => {
        this.users.update(list =>
          list.map(u => u.id === userId ? { ...u, account_status: res.data.account_status as any } : u)
        );
        this.blockingUser.update(m => ({ ...m, [userId]: false }));
      },
      error: () => this.blockingUser.update(m => ({ ...m, [userId]: false })),
    });
  }

  generateResetLink(userId: string): void {
    this.resetLinkLoading.update(m => ({ ...m, [userId]: true }));
    this.adminApi.generateResetLink(userId).subscribe({
      next: res => {
        this.resetLinkMap.update(m => ({ ...m, [userId]: res.data.url }));
        this.resetLinkLoading.update(m => ({ ...m, [userId]: false }));
      },
      error: () => this.resetLinkLoading.update(m => ({ ...m, [userId]: false })),
    });
  }

  askResetSessions(userId: string): void {
    this.confirmReset.set(userId);
  }

  cancelResetSessions(): void {
    this.confirmReset.set(null);
  }

  confirmResetSessions(userId: string): void {
    this.confirmReset.set(null);
    this.resetSessionsLoading.update(m => ({ ...m, [userId]: true }));
    this.adminApi.resetSessions(userId).subscribe({
      next: () => this.resetSessionsLoading.update(m => ({ ...m, [userId]: false })),
      error: () => this.resetSessionsLoading.update(m => ({ ...m, [userId]: false })),
    });
  }

  // ─── Support Tickets ──────────────────────────────────────────────────────

  loadSupportTickets(page = this.supportTicketsPage()): void {
    this.supportTicketsLoading.set(true);
    this.supportTicketsError.set(false);
    const status = this.supportStatusFilter() || undefined;
    this.supportApi.adminGetTickets(page, status).subscribe({
      next: res => {
        this.supportTickets.set(res.data.items as any);
        this.supportTicketsPagination.set(res.data.pagination);
        this.supportTicketsPage.set(page);
        this.supportTicketsLoading.set(false);
      },
      error: () => {
        this.supportTicketsError.set(true);
        this.supportTicketsLoading.set(false);
      },
    });
  }

  setSupportStatusFilter(status: string): void {
    this.supportStatusFilter.set(status);
    this.loadSupportTickets(1);
  }

  openTicket(ticketId: string): void {
    this.ticketError.set(false);
    this.ticketLoading.set(true);
    this.adminMessageForm.reset();
    this.adminMsgAttachments.set([]);
    this.messageSendError.set(null);

    this.supportApi.adminGetTicket(ticketId).subscribe({
      next: res => {
        this.activeTicket.set(res.data.ticket);
        this.ticketLoading.set(false);
        this._scheduleAdminMarkRead(ticketId);
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
    this.adminMessageForm.reset();
    this.adminMsgAttachments.set([]);
    this.messageSendError.set(null);
  }

  private _scheduleAdminMarkRead(ticketId: string): void {
    this._cancelMarkRead();
    this._markReadTimer = setTimeout(() => {
      this.supportApi.adminMarkTicketRead(ticketId).subscribe(() => {
        this.supportTickets.update(list =>
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

  takeTicket(ticketId: string): void {
    this.changingStatus.set(true);
    this.supportApi.adminTakeTicket(ticketId).subscribe({
      next: () => {
        this.activeTicket.update(t => t ? { ...t, status: 'in_progress' } : t);
        this.supportTickets.update(list => list.map(item =>
          item.id === ticketId ? { ...item, status: 'in_progress' as any } : item
        ));
        this.changingStatus.set(false);
      },
      error: () => this.changingStatus.set(false),
    });
  }

  awaitConfirmation(ticketId: string): void {
    this.changingStatus.set(true);
    this.supportApi.adminAwaitConfirmation(ticketId).subscribe({
      next: () => {
        this.activeTicket.update(t => t ? { ...t, status: 'awaiting_confirmation' } : t);
        this.supportTickets.update(list => list.map(item =>
          item.id === ticketId ? { ...item, status: 'awaiting_confirmation' as any } : item
        ));
        this.changingStatus.set(false);
      },
      error: () => this.changingStatus.set(false),
    });
  }

  sendAdminMessage(): void {
    this.adminMessageForm.markAllAsTouched();
    const ticket = this.activeTicket();
    if (!ticket || this.adminMessageForm.invalid || this.sendingMessage()) return;

    this.messageSendError.set(null);
    this.sendingMessage.set(true);

    this.supportApi.adminSendMessage(
      ticket.id,
      this.adminMessageForm.value.body!,
      this.adminMsgAttachments()
    ).subscribe({
      next: res => {
        this.activeTicket.update(t => t ? { ...t, messages: [...t.messages, res.data.message] } : t);
        this.adminMessageForm.reset();
        this.adminMsgAttachments.set([]);
        this.sendingMessage.set(false);
      },
      error: (err) => {
        this.messageSendError.set(err?.message ?? 'Не удалось отправить сообщение');
        this.sendingMessage.set(false);
      },
    });
  }

  onAdminMsgFiles(event: Event): void {
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    this.adminMsgAttachError.set(null);
    const total = files.reduce((s, f) => s + f.size, 0);
    if (total > 50 * 1024 * 1024) {
      this.adminMsgAttachError.set('Общий размер вложений в одном сообщении не должен превышать 50 МБ.');
      return;
    }
    this.adminMsgAttachments.set(files);
  }

  downloadAttachment(ticketId: string, attachmentId: string, name: string): void {
    this.supportApi.adminGetAttachmentUrl(ticketId, attachmentId).subscribe({
      next: res => {
        const a = document.createElement('a');
        a.href = res.data.url;
        a.download = res.data.original_name;
        a.target = '_blank';
        a.click();
      },
    });
  }

  // ─── Admin Suggestions ────────────────────────────────────────────────────

  loadSuggestions(page = this.suggestionsPage()): void {
    this.suggestionsLoading.set(true);
    this.suggestionsError.set(false);
    const status = this.suggestionsStatusFilter() || undefined;
    this.supportApi.adminGetSuggestions(page, status).subscribe({
      next: res => {
        this.adminSuggestions.set(res.data.items);
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

  setSuggestionsFilter(status: string): void {
    this.suggestionsStatusFilter.set(status);
    this.loadSuggestions(1);
  }

  openSuggestion(id: string): void {
    this.suggestionError.set(false);
    this.suggestionLoading.set(true);
    this.commentForm.reset();
    this.commentError.set(null);

    this.supportApi.adminGetSuggestion(id).subscribe({
      next: res => {
        this.activeSuggestion.set(res.data.suggestion);
        this.suggestionLoading.set(false);
      },
      error: () => {
        this.suggestionError.set(true);
        this.suggestionLoading.set(false);
      },
    });
  }

  closeSuggestion(): void {
    this.activeSuggestion.set(null);
    this.commentForm.reset();
    this.commentError.set(null);
  }

  toggleSuggestionStatus(id: string, currentStatus: string): void {
    const newStatus = currentStatus === 'accepted' ? 'new' : 'accepted';
    this.updatingSuggStatus.set(true);
    this.supportApi.adminUpdateSuggestionStatus(id, newStatus).subscribe({
      next: () => {
        this.activeSuggestion.update(s => s ? { ...s, status: newStatus as any } : s);
        this.adminSuggestions.update(list => list.map(s =>
          s.id === id ? { ...s, status: newStatus as any } : s
        ));
        this.updatingSuggStatus.set(false);
      },
      error: () => this.updatingSuggStatus.set(false),
    });
  }

  addSuggestionComment(suggestionId: string): void {
    this.commentForm.markAllAsTouched();
    if (this.commentForm.invalid || this.addingComment()) return;

    this.commentError.set(null);
    this.addingComment.set(true);

    this.supportApi.adminAddSuggestionComment(suggestionId, this.commentForm.value.body!).subscribe({
      next: res => {
        this.activeSuggestion.update(s => s ? {
          ...s,
          admin_comments: [...(s.admin_comments ?? []), res.data.comment],
        } : s);
        this.commentForm.reset();
        this.addingComment.set(false);
      },
      error: (err) => {
        this.commentError.set(err?.message ?? 'Не удалось добавить комментарий');
        this.addingComment.set(false);
      },
    });
  }

  downloadSuggestionAttachment(suggestionId: string, attachmentId: string): void {
    this.supportApi.adminGetSuggestionAttachmentUrl(suggestionId, attachmentId).subscribe({
      next: res => {
        const a = document.createElement('a');
        a.href = res.data.url;
        a.download = res.data.original_name;
        a.target = '_blank';
        a.click();
      },
    });
  }

  // ─── Notify ───────────────────────────────────────────────────────────────

  openNotifyDialog(user: AdminUser): void {
    this.notifyTarget.set({ userId: user.id, email: user.email });
    this.notifyTitle.set('');
    this.notifyBody.set('');
    this.notifyError.set(null);
    this.notifyDone.set(false);
  }

  openBroadcastDialog(): void {
    this.notifyTarget.set('all');
    this.notifyTitle.set('');
    this.notifyBody.set('');
    this.notifyError.set(null);
    this.notifyDone.set(false);
  }

  closeNotifyDialog(): void {
    this.notifyTarget.set(null);
  }

  sendNotify(): void {
    const title = this.notifyTitle().trim();
    const body  = this.notifyBody().trim();
    if (!title || !body || this.notifySending()) return;

    this.notifyError.set(null);
    this.notifySending.set(true);

    const target = this.notifyTarget();
    const req = target === 'all'
      ? this.adminApi.notifyAll(title, body)
      : this.adminApi.notifyUser((target as { userId: string }).userId, title, body);

    req.subscribe({
      next: () => {
        this.notifySending.set(false);
        this.notifyDone.set(true);
        setTimeout(() => this.closeNotifyDialog(), 1500);
      },
      error: (err) => {
        this.notifyError.set(err?.message ?? 'Ошибка отправки');
        this.notifySending.set(false);
      },
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  formatSize(bytes: number): string {
    if (bytes === 0) return '0 Б';
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} ГБ`;
  }

  formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  planLabel(plan: TariffPlan | null): string {
    const map: Record<string, string> = { free: 'Free', silver: 'Silver', gold: 'Gold' };
    return plan ? (map[plan] ?? plan) : '—';
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      active: 'Активен',
      pending_email_verification: 'Ожидает подтверждения email',
      blocked_unverified_email: 'Заблокирован',
    };
    return map[status] ?? status;
  }

  ticketStatusLabel(status: string): string {
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

  trackById(_: number, item: { id: string | number }): string | number {
    return item.id;
  }
}
