import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AdminApiService } from '../../../../core/api/admin-api.service';
import { AdminStats, AdminUser, TariffPlan } from '../../../../shared/models/api.models';

@Component({
  selector: 'app-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslateModule],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent {
  private readonly adminApi = inject(AdminApiService);

  readonly activeTab  = signal<'stats' | 'users'>('stats');
  readonly stats      = signal<AdminStats | null>(null);
  readonly users      = signal<AdminUser[]>([]);
  readonly statsError = signal(false);
  readonly usersError = signal(false);

  readonly editingPlan   = signal<Record<string, TariffPlan>>({});
  readonly savingPlan    = signal<Record<string, boolean>>({});
  readonly blockingUser  = signal<Record<string, boolean>>({});
  readonly resetLinkMap  = signal<Record<string, string>>({});
  readonly resetLinkLoading = signal<Record<string, boolean>>({});

  constructor() {
    this.loadStats();
    this.loadUsers();
  }

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

  setTab(tab: 'stats' | 'users'): void {
    this.activeTab.set(tab);
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
}