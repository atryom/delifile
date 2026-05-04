import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ActivityApiService } from '../../../../core/api/domain-api.services';
import { ActivityLog } from '../../../../shared/models/api.models';

@Component({
  selector: 'app-activity',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, TranslateModule],
  templateUrl: './activity.component.html',
  styleUrl: './activity.component.scss',
})
export class ActivityComponent implements OnInit {
  private readonly activityApi = inject(ActivityApiService);
  private readonly translate   = inject(TranslateService);

  readonly logs       = signal<ActivityLog[]>([]);
  readonly loading    = signal(false);
  readonly page       = signal(1);
  readonly totalPages = signal(1);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.activityApi.list(this.page()).subscribe({
      next: (res) => {
        this.logs.set(res.data.items);
        const p = res.data.pagination;
        this.totalPages.set(Math.ceil(p.total / p.per_page));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  goToPage(p: number): void {
    this.page.set(p);
    this.load();
  }

  actionIcon(action: string): string {
    const map: Record<string, string> = {
      uploaded:          '☁️',
      downloaded:        '⬇️',
      shared_to_contact: '👤',
      share_revoked:     '🔒',
      link_created:      '🔗',
      link_disabled:     '⛔',
      pinned:            '📌',
      unpinned:          '📌',
      favorited:         '★',
      unfavorited:       '☆',
      moved_to_folder:   '📁',
      tag_updated:       '🏷️',
      saved_by_recipient:'💾',
      deleted:           '🗑️',
    };
    return map[action] ?? '📋';
  }
}
