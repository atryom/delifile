import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe, UpperCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { TariffApiService } from '../../../../core/api/tariff-api.service';
import { TariffPlanInfo, TariffUsage } from '../../../../shared/models/api.models';

@Component({
  selector: 'app-tariffs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslateModule, UpperCasePipe, DecimalPipe],
  template: `
    <div class="tariffs-page">
      <div class="tariffs-header">
        <a routerLink="/files" class="btn-back">{{ 'common.prev' | translate }}</a>
        <h1>{{ 'tariffs.title' | translate }}</h1>
      </div>

      @if (loading()) {
        <p class="info-text">{{ 'common.loading' | translate }}</p>
      } @else {
        <!-- Usage stats for current plan -->
        @if (usage()) {
          <div class="usage-card">
            <h2 class="usage-title">{{ 'tariffs.usage.title' | translate }}</h2>
            <div class="usage-rows">

              <!-- Storage -->
              <div class="usage-row">
                <div class="usage-meta">
                  <span class="usage-name">{{ 'tariffs.usage.storage' | translate }}</span>
                  <span class="usage-values">
                    {{ formatBytes(usage()!.storage_used_bytes) }}
                    / {{ formatBytes(usage()!.storage_limit_bytes) }}
                  </span>
                </div>
                <div class="progress-bar-wrap" role="progressbar"
                     [attr.aria-valuenow]="storagePercent()"
                     aria-valuemin="0" aria-valuemax="100">
                  <div class="progress-bar" [style.width.%]="storagePercent()"
                       [class.progress-bar--warn]="storagePercent() >= 80"
                       [class.progress-bar--danger]="storagePercent() >= 95">
                  </div>
                </div>
                <span class="usage-pct">{{ storagePercent() | number:'1.0-0' }}%</span>
              </div>

              <!-- Devices -->
              <div class="usage-row">
                <div class="usage-meta">
                  <span class="usage-name">{{ 'tariffs.usage.devices' | translate }}</span>
                  <span class="usage-values">
                    {{ usage()!.device_count }}
                    @if (usage()!.device_limit !== null) {
                      / {{ usage()!.device_limit }}
                    } @else {
                      / {{ 'tariffs.devices_unlimited' | translate }}
                    }
                  </span>
                </div>
                @if (usage()!.device_limit !== null) {
                  <div class="progress-bar-wrap" role="progressbar"
                       [attr.aria-valuenow]="devicePercent()"
                       aria-valuemin="0" aria-valuemax="100">
                    <div class="progress-bar" [style.width.%]="devicePercent()"
                         [class.progress-bar--warn]="devicePercent() >= 80"
                         [class.progress-bar--danger]="devicePercent() >= 100">
                    </div>
                  </div>
                  <span class="usage-pct">{{ devicePercent() | number:'1.0-0' }}%</span>
                }
              </div>

              <!-- Max file size ever uploaded -->
              <div class="usage-row">
                <div class="usage-meta">
                  <span class="usage-name">{{ 'tariffs.usage.max_file' | translate }}</span>
                  <span class="usage-values">
                    {{ formatBytes(usage()!.max_file_size_bytes) }}
                    / {{ formatBytes(usage()!.file_size_limit_bytes) }}
                  </span>
                </div>
                <div class="progress-bar-wrap" role="progressbar"
                     [attr.aria-valuenow]="maxFilePercent()"
                     aria-valuemin="0" aria-valuemax="100">
                  <div class="progress-bar" [style.width.%]="maxFilePercent()"
                       [class.progress-bar--warn]="maxFilePercent() >= 80"
                       [class.progress-bar--danger]="maxFilePercent() >= 100">
                  </div>
                </div>
                <span class="usage-pct">{{ maxFilePercent() | number:'1.0-0' }}%</span>
              </div>

            </div>
          </div>
        }

        <div class="plans-grid">
          @for (plan of plans(); track plan.key) {
            <div class="plan-card" [class.plan-card--current]="plan.key === currentPlan()">
              @if (plan.key === currentPlan()) {
                <div class="current-badge">{{ 'tariffs.current' | translate }}</div>
              }
              <div class="plan-name plan-name--{{ plan.key }}">{{ plan.key | uppercase }}</div>
              <div class="plan-price">
                @if (plan.price_rub === 0) {
                  <span class="price-amount">{{ 'tariffs.free_label' | translate }}</span>
                } @else {
                  <span class="price-amount">{{ plan.price_rub }} {{ 'tariffs.per_month' | translate }}</span>
                }
              </div>
              <ul class="plan-features">
                <li>{{ 'tariffs.file_size' | translate : { mb: plan.file_size_mb } }}</li>
                <li>{{ 'tariffs.storage' | translate : { mb: storageMbLabel(plan.storage_mb) } }}</li>
                <li>
                  @if (plan.device_limit === null) {
                    {{ 'tariffs.devices_unlimited' | translate }}
                  } @else {
                    {{ 'tariffs.devices' | translate : { n: plan.device_limit } }}
                  }
                </li>
              </ul>
              @if (requestedPlan() === plan.key) {
                <div class="request-accepted">{{ 'tariffs.request_accepted' | translate }}</div>
              } @else {
                <button
                  class="btn-select"
                  [class.btn-select--current]="plan.key === currentPlan()"
                  [disabled]="requesting()"
                  (click)="requestPlan(plan.key)">
                  {{ plan.key === currentPlan() ? ('tariffs.current_btn' | translate) : ('tariffs.select_btn' | translate) }}
                </button>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .tariffs-page { max-width: 960px; margin: 0 auto; padding: 32px 24px; }
    .tariffs-header { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; margin-bottom: 32px; }
    .tariffs-header h1 { margin: 0; font-size: 1.6rem; color: #1a1a2e; }
    .btn-back { color: #6366f1; text-decoration: none; font-size: 0.9rem; }
    .btn-back:hover { text-decoration: underline; }

    .usage-card {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 16px;
      padding: 24px 28px;
      margin-bottom: 28px;
    }
    .usage-title { font-size: 1rem; font-weight: 700; color: #1a1a2e; margin: 0 0 18px; }
    .usage-rows { display: flex; flex-direction: column; gap: 18px; }
    .usage-row { display: flex; flex-direction: column; gap: 6px; }
    .usage-meta { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
    .usage-name { font-size: 0.85rem; font-weight: 600; color: #374151; }
    .usage-values { font-size: 0.8rem; color: #9ca3af; }
    .usage-pct { font-size: 0.78rem; color: #9ca3af; text-align: right; }

    .progress-bar-wrap {
      width: 100%;
      height: 8px;
      background: #f3f4f6;
      border-radius: 99px;
      overflow: hidden;
    }
    .progress-bar {
      height: 100%;
      background: #6366f1;
      border-radius: 99px;
      transition: width 0.4s ease;
    }
    .progress-bar--warn { background: #f59e0b; }
    .progress-bar--danger { background: #dc2626; }

    .plans-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 24px; }

    .plan-card {
      background: #fff;
      border: 2px solid #e5e7eb;
      border-radius: 16px;
      padding: 28px 24px;
      position: relative;
      transition: border-color 0.2s, box-shadow 0.2s;
      display: flex;
      flex-direction: column;
    }
    .plan-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .plan-card--current { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }

    .current-badge {
      position: absolute; top: -12px; left: 50%; transform: translateX(-50%);
      background: #6366f1; color: #fff; font-size: 0.72rem; font-weight: 700;
      padding: 3px 12px; border-radius: 20px; white-space: nowrap;
    }

    .plan-name { font-size: 1.5rem; font-weight: 800; margin-bottom: 8px; }
    .plan-name--free   { color: #6b7280; }
    .plan-name--silver { color: #6b7280; }
    .plan-name--gold   { color: #d97706; }

    .plan-price { margin-bottom: 20px; }
    .price-amount { font-size: 1.1rem; font-weight: 600; color: #1a1a2e; }

    .plan-features { list-style: none; padding: 0; margin: 0 0 24px; display: flex; flex-direction: column; gap: 10px; flex: 1; }
    .plan-features li { font-size: 0.9rem; color: #374151; padding-left: 20px; position: relative; }
    .plan-features li::before { content: '✓'; position: absolute; left: 0; color: #10b981; font-weight: 700; }

    .btn-select {
      width: 100%; padding: 10px 16px; border-radius: 8px; border: none; cursor: pointer;
      font-size: 0.9rem; font-weight: 600;
      background: #6366f1; color: #fff; transition: background 0.15s;
    }
    .btn-select:hover:not(:disabled) { background: #4f46e5; }
    .btn-select:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-select--current { background: #e0e7ff; color: #4338ca; }
    .btn-select--current:hover:not(:disabled) { background: #c7d2fe; }

    .request-accepted {
      text-align: center; padding: 10px 16px; border-radius: 8px;
      background: #d1fae5; color: #065f46; font-size: 0.9rem; font-weight: 600;
    }
    .info-text { color: #6b7280; }

    @media (max-width: 600px) {
      .tariffs-page { padding: 16px 12px; }
      .usage-card { padding: 16px; }
      .usage-meta { flex-wrap: wrap; gap: 4px; }
      .usage-values { font-size: 0.78rem; }
      .plans-grid { grid-template-columns: 1fr; }
    }
  `],
})
export class TariffsComponent {
  private readonly authState  = inject(AuthStateService);
  private readonly tariffApi  = inject(TariffApiService);

  readonly currentPlan  = this.authState.plan;
  readonly plans        = signal<TariffPlanInfo[]>([]);
  readonly usage        = signal<TariffUsage | null>(null);
  readonly loading      = signal(true);
  readonly requesting   = signal(false);
  readonly requestedPlan = signal<string | null>(null);

  readonly storagePercent = computed(() => {
    const u = this.usage();
    if (!u || u.storage_limit_bytes === 0) return 0;
    return Math.min(100, Math.round((u.storage_used_bytes / u.storage_limit_bytes) * 100));
  });

  readonly devicePercent = computed(() => {
    const u = this.usage();
    if (!u || u.device_limit === null || u.device_limit === 0) return 0;
    return Math.min(100, Math.round((u.device_count / u.device_limit) * 100));
  });

  readonly maxFilePercent = computed(() => {
    const u = this.usage();
    if (!u || u.file_size_limit_bytes === 0) return 0;
    return Math.min(100, Math.round((u.max_file_size_bytes / u.file_size_limit_bytes) * 100));
  });

  constructor() {
    this.tariffApi.getPlans().subscribe({
      next: res => {
        this.plans.set(res.data.plans);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.tariffApi.getUsage().subscribe({
      next: res => this.usage.set(res.data),
      error: () => { /* ignore, usage is optional */ },
    });
  }

  storageMbLabel(mb: number): string {
    return mb >= 1024 ? `${mb / 1024} ГБ` : `${mb} МБ`;
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 МБ';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} ГБ`;
    return `${mb.toFixed(1)} МБ`;
  }

  requestPlan(planKey: string): void {
    if (this.requesting()) return;
    this.requesting.set(true);
    this.tariffApi.requestPlan(planKey).subscribe({
      next: () => {
        this.requestedPlan.set(planKey);
        this.requesting.set(false);
      },
      error: () => this.requesting.set(false),
    });
  }
}
