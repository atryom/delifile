import { Component, inject, signal, OnInit } from '@angular/core';
import { NgIf, NgFor, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ActivityApiService } from '../../../../core/api/domain-api.services';
import { ActivityLog } from '../../../../shared/models/api.models';

@Component({
  selector: 'app-activity',
  standalone: true,
  imports: [NgIf, NgFor, DatePipe, RouterLink, TranslateModule],
  template: `
    <div class="page">
      <div class="page-header">
        <h1 class="page-title">{{ 'activity.title' | translate }}</h1>
        <button class="btn-outline" (click)="load()" [disabled]="loading()">
          {{ 'activity.refresh' | translate }}
        </button>
      </div>

      <div class="loading-state" *ngIf="loading()">{{ 'activity.loading' | translate }}</div>

      <div class="empty-state" *ngIf="!loading() && logs().length === 0">
        <span class="empty-icon">📋</span>
        <p>{{ 'activity.empty' | translate }}</p>
      </div>

      <div class="activity-list" *ngIf="!loading() && logs().length > 0">
        <div *ngFor="let log of logs()" class="activity-item">
          <div class="activity-icon">{{ actionIcon(log.action) }}</div>
          <div class="activity-body">
            <p class="activity-label">
              <span class="action-text">{{ log.label }}</span>
              <ng-container *ngIf="log.file">
                — <a [routerLink]="['/files', log.file.id]" class="file-link">{{ log.file.name }}</a>
              </ng-container>
            </p>
            <p class="activity-meta">
              <span *ngIf="log.user">{{ log.user.email }}</span>
              <span class="meta-sep" *ngIf="log.user">·</span>
              {{ log.created_at | date:'MMM d, y, HH:mm' }}
            </p>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div class="pagination" *ngIf="totalPages() > 1">
        <button [disabled]="page() === 1" (click)="goToPage(page() - 1)">{{ 'common.prev' | translate }}</button>
        <span>{{ 'common.page_of' | translate:{ page: page(), total: totalPages() } }}</span>
        <button [disabled]="page() === totalPages()" (click)="goToPage(page() + 1)">{{ 'common.next' | translate }}</button>
      </div>
    </div>
  `,
  styles: [`
    .page { padding: 28px 32px; max-width: 800px; }
    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
    .page-title { font-size: 1.6rem; font-weight: 700; color: #1a1a2e; margin: 0; }

    .loading-state, .empty-state { text-align: center; padding: 60px 20px; color: #9ca3af; }
    .empty-icon { font-size: 3rem; display: block; margin-bottom: 12px; }

    .activity-list { display: flex; flex-direction: column; gap: 2px; }
    .activity-item { display: flex; align-items: flex-start; gap: 14px; padding: 14px 18px; background: #fff; border: 1px solid #f0f0f0; border-radius: 10px; }
    .activity-icon { font-size: 1.4rem; flex-shrink: 0; width: 32px; text-align: center; margin-top: 2px; }
    .activity-body { flex: 1; }
    .activity-label { font-size: 0.92rem; margin: 0 0 4px; color: #1f2937; }
    .action-text { font-weight: 500; }
    .file-link { color: #6366f1; text-decoration: none; }
    .file-link:hover { text-decoration: underline; }
    .activity-meta { font-size: 0.8rem; color: #9ca3af; margin: 0; }
    .meta-sep { margin: 0 6px; }

    .pagination { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 28px; }
    .pagination button { padding: 8px 18px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; cursor: pointer; }
    .pagination button:disabled { opacity: 0.4; cursor: not-allowed; }

    .btn-outline { padding: 8px 16px; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.88rem; cursor: pointer; }
    .btn-outline:hover:not(:disabled) { background: #f9fafb; }
    .btn-outline:disabled { opacity: 0.5; cursor: not-allowed; }
  `],
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
