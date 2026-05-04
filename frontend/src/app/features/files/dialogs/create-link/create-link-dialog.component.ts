import { Component, inject, signal, input, output } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FilesApiService } from '../../../../core/api/files-api.service';
import { ShareLink } from '../../../../shared/models/api.models';

@Component({
  selector: 'app-create-link-dialog',
  standalone: true,
  imports: [NgIf, ReactiveFormsModule, TranslateModule],
  template: `
    <div class="dialog-overlay" (click)="closed.emit()">
      <div class="dialog" (click)="$event.stopPropagation()">
        <div class="dialog-header">
          <h2>{{ 'files.create_link.title' | translate }}</h2>
          <button class="dialog-close" (click)="closed.emit()">✕</button>
        </div>

        <div class="dialog-body" *ngIf="!createdLink()">
          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div class="field">
              <label for="ttl">{{ 'files.create_link.expires_label' | translate }}</label>
              <select id="ttl" formControlName="ttl_hours" class="select-input">
                <option value="1">1 час</option>
                <option value="6">6 часов</option>
                <option value="12">12 часов (по умолчанию)</option>
                <option value="24">24 часа</option>
                <option value="72">3 дня</option>
                <option value="168">7 дней</option>
                <option value="720">30 дней</option>
              </select>
            </div>

            <div class="field-check">
              <label class="check-label">
                <input type="checkbox" formControlName="allow_save" class="check-input" />
                {{ 'files.create_link.allow_save_label' | translate }}
              </label>
              <p class="check-hint">{{ 'files.create_link.allow_save_hint' | translate }}</p>
            </div>

            <div class="info-box">
              {{ 'files.create_link.note' | translate }}
            </div>

            <div class="error-msg" *ngIf="error()">{{ error() }}</div>
          </form>
        </div>

        <!-- Success state -->
        <div class="dialog-body success-state" *ngIf="createdLink()">
          <div class="success-icon">✅</div>
          <p class="success-title">{{ 'files.create_link.created' | translate }}</p>

          <div class="link-display">
            <input type="text" [value]="createdLink()!.url" readonly class="link-input" />
            <button class="btn-copy" (click)="copyLink()">
              {{ copied() ? ('files.create_link.copied' | translate) : ('files.create_link.copy' | translate) }}
            </button>
          </div>

          <p class="link-expires">
            {{ 'files.create_link.expires_at' | translate:{ date: formatExpiry(createdLink()!.expires_at) } }}
          </p>
          @if (createdLink()!.allow_save) {
            <p class="save-badge">{{ 'files.create_link.save_allowed' | translate }}</p>
          }
        </div>

        <div class="dialog-footer">
          <ng-container *ngIf="!createdLink()">
            <button class="btn-secondary" (click)="closed.emit()">{{ 'files.create_link.cancel' | translate }}</button>
            <button class="btn-primary" (click)="submit()" [disabled]="submitting()">
              {{ submitting() ? ('files.create_link.submitting' | translate) : ('files.create_link.submit' | translate) }}
            </button>
          </ng-container>
          <ng-container *ngIf="createdLink()">
            <button class="btn-secondary" (click)="closed.emit()">{{ 'files.create_link.close' | translate }}</button>
            <button class="btn-primary" (click)="created.emit()">{{ 'files.create_link.done' | translate }}</button>
          </ng-container>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dialog-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 500; }
    .dialog { background: #fff; border-radius: 14px; width: 440px; max-width: 95vw; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
    .dialog-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px 16px; border-bottom: 1px solid #f0f0f0; }
    .dialog-header h2 { margin: 0; font-size: 1.1rem; font-weight: 700; }
    .dialog-close { background: none; border: none; font-size: 1.1rem; cursor: pointer; color: #9ca3af; }
    .dialog-body { padding: 20px 24px; }
    .dialog-footer { padding: 16px 24px; border-top: 1px solid #f0f0f0; display: flex; justify-content: flex-end; gap: 10px; }
    .field { margin-bottom: 16px; }
    .field label { display: block; font-size: 0.88rem; font-weight: 600; color: #374151; margin-bottom: 6px; }
    .select-input { width: 100%; padding: 9px 12px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; outline: none; }
    .select-input:focus { border-color: #6366f1; }
    .field-check { margin-bottom: 16px; }
    .check-label { display: flex; align-items: center; gap: 8px; font-size: 0.9rem; font-weight: 500; color: #374151; cursor: pointer; }
    .check-input { width: 16px; height: 16px; cursor: pointer; accent-color: #6366f1; }
    .check-hint { margin: 4px 0 0 24px; font-size: 0.78rem; color: #9ca3af; }
    .info-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 14px; font-size: 0.83rem; color: #1e40af; }
    .error-msg { color: #dc2626; font-size: 0.85rem; margin-top: 12px; }

    .success-state { text-align: center; }
    .success-icon { font-size: 2.5rem; margin-bottom: 10px; }
    .success-title { font-size: 1rem; font-weight: 600; margin-bottom: 16px; }
    .link-display { display: flex; gap: 8px; margin-bottom: 10px; }
    .link-input { flex: 1; padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.85rem; color: #6366f1; background: #f5f3ff; }
    .btn-copy { padding: 8px 14px; background: #6366f1; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 0.85rem; white-space: nowrap; }
    .link-expires { font-size: 0.8rem; color: #9ca3af; margin-bottom: 6px; }
    .save-badge { display: inline-block; font-size: 0.78rem; padding: 3px 10px; background: #dcfce7; color: #15803d; border-radius: 99px; }

    .btn-primary { padding: 9px 20px; background: #6366f1; color: #fff; border: none; border-radius: 8px; font-size: 0.9rem; cursor: pointer; font-weight: 600; }
    .btn-primary:hover:not(:disabled) { background: #4f46e5; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary { padding: 9px 20px; background: #f9fafb; color: #374151; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; cursor: pointer; }
    .btn-secondary:hover { background: #f3f4f6; }
  `],
})
export class CreateLinkDialogComponent {
  readonly fileId  = input.required<string>();
  readonly closed  = output<void>();
  readonly created = output<void>();

  private readonly filesApi  = inject(FilesApiService);
  private readonly fb        = inject(FormBuilder);
  private readonly translate = inject(TranslateService);

  readonly createdLink = signal<ShareLink | null>(null);
  readonly submitting  = signal(false);
  readonly error       = signal<string | null>(null);
  readonly copied      = signal(false);

  readonly form = this.fb.group({
    ttl_hours:  [12, [Validators.required, Validators.min(1)]],
    allow_save: [false],
  });

  submit(): void {
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);

    const { ttl_hours, allow_save } = this.form.getRawValue();

    this.filesApi.createLink(this.fileId(), ttl_hours ?? 12, allow_save ?? false).subscribe({
      next: (res) => {
        this.createdLink.set(res.data.link);
        this.submitting.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? this.translate.instant('files.create_link.error'));
        this.submitting.set(false);
      },
    });
  }

  copyLink(): void {
    navigator.clipboard.writeText(this.createdLink()!.url).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  formatExpiry(iso: string | null): string {
    if (!iso) return this.translate.instant('files.create_link.never');
    return new Date(iso).toLocaleString();
  }
}
