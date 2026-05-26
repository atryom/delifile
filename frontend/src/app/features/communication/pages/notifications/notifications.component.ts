import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { NotificationsApiService } from '../../../../core/api/notifications-api.service';
import { AppNotification, NotificationGroup } from '../../../../shared/models/api.models';

type FilterGroup = 'all' | NotificationGroup;

@Component({
  selector: 'app-notifications',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, TranslateModule],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
})
export class NotificationsComponent implements OnInit {
  private readonly api    = inject(NotificationsApiService);
  private readonly router = inject(Router);

  readonly loading        = signal(false);
  readonly markingAll     = signal(false);
  readonly items          = signal<AppNotification[]>([]);
  readonly activeFilter   = signal<FilterGroup>('all');
  readonly page           = signal(1);
  readonly lastPage       = signal(1);

  readonly hasMore = computed(() => this.page() < this.lastPage());

  readonly filters: { key: FilterGroup; label: string }[] = [
    { key: 'all',            label: 'notifications.filter_all' },
    { key: 'administrative', label: 'notifications.filter_administrative' },
    { key: 'access',         label: 'notifications.filter_access' },
    { key: 'contacts',       label: 'notifications.filter_contacts' },
    { key: 'other',          label: 'notifications.filter_other' },
  ];

  ngOnInit(): void {
    this.load(true);
  }

  setFilter(f: FilterGroup): void {
    if (this.activeFilter() === f) return;
    this.activeFilter.set(f);
    this.page.set(1);
    this.items.set([]);
    this.load(true);
  }

  loadMore(): void {
    if (!this.hasMore() || this.loading()) return;
    this.page.update(p => p + 1);
    this.load(false);
  }

  open(item: AppNotification): void {
    if (!item.read_at) {
      this.api.markRead(item.id).subscribe();
      this.api.decrementCount();
      this.items.update(list =>
        list.map(n => n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n)
      );
    }
    this.router.navigate([this.routeFor(item)]);
  }

  private routeFor(item: AppNotification): string {
    switch (item.type) {
      case 'file_shared':
      case 'access_changed':
        return item.data?.['file_id'] ? `/files/${item.data['file_id']}` : '/files';
      case 'folder_shared':
        return item.data?.['folder_id']
          ? `/folders?tab=shared&shared_folder_id=${item.data['folder_id']}`
          : '/folders';
      case 'shared_folder_content_added':
        return item.data?.['folder_id']
          ? `/folders?tab=shared&shared_folder_id=${item.data['folder_id']}`
          : '/folders';
      case 'contact_request':
        return '/communication/contacts';
      case 'admin_message':
        return '/settings/support';
      case 'file_expired':
      default:
        return '/files';
    }
  }

  markAllRead(): void {
    if (this.markingAll()) return;
    this.markingAll.set(true);
    this.api.markAllRead().subscribe({
      next: () => {
        const now = new Date().toISOString();
        this.items.update(list => list.map(n => ({ ...n, read_at: n.read_at ?? now })));
        this.api.unreadCount.set(0);
        this.markingAll.set(false);
      },
      error: () => this.markingAll.set(false),
    });
  }

  private load(reset: boolean): void {
    this.loading.set(true);
    const f = this.activeFilter();
    const group = f === 'all' ? undefined : f as NotificationGroup;
    this.api.getNotifications(group, this.page()).subscribe({
      next: res => {
        const newItems = res.data.items;
        this.items.update(prev => reset ? newItems : [...prev, ...newItems]);
        this.lastPage.set(res.data.last_page);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
