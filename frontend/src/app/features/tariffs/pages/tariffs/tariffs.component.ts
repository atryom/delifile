import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { TariffApiService } from '../../../../core/api/tariff-api.service';
import { TariffUsage } from '../../../../shared/models/api.models';
import { formatSize } from '../../../../shared/utils/format';

@Component({
  selector: 'app-tariffs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslateModule, DecimalPipe],
  templateUrl: './tariffs.component.html',
  styleUrl: './tariffs.component.scss',
})
export class TariffsComponent {
  private readonly tariffApi = inject(TariffApiService);

  readonly usage   = signal<TariffUsage | null>(null);
  readonly loading = signal(true);

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
    this.tariffApi.getUsage().subscribe({
      next: res => { this.usage.set(res.data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  formatBytes(bytes: number): string {
    return bytes === 0 ? '0 МБ' : formatSize(bytes);
  }
}
