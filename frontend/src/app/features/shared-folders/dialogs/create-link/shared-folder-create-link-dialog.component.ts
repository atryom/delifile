import { Component, input, output, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DatePipe } from '@angular/common';
import { SharedFoldersApiService } from '../../../../core/api/shared-folders-api.service';
import { SharedFolderLink, SharedFolderAccessType } from '../../../../shared/models/api.models';

@Component({
  selector: 'app-shared-folder-create-link-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslateModule, DatePipe],
  template: `
    <div class="dialog-overlay" (click)="closed.emit()">
      <div class="dialog" (click)="$event.stopPropagation()" role="dialog" [attr.aria-label]="'shared_folders.create_link_title' | translate">
        <div class="dialog-header">
          <h2>{{ 'shared_folders.create_link_title' | translate }}</h2>
          <button class="dialog-close" (click)="closed.emit()" aria-label="Закрыть">✕</button>
        </div>

        @if (!createdLink()) {
          <div class="dialog-body" [formGroup]="form">
            <div class="field-row">
              <label class="field-label">Тип доступа</label>
              <div class="btn-group" role="group" aria-label="Тип доступа">
                <button type="button" class="btn-group-item" [class.active]="accessType() === 'view'" (click)="accessType.set('view')">
                  {{ 'shared_folders.access_type_view' | translate }}
                </button>
                <button type="button" class="btn-group-item" [class.active]="accessType() === 'edit'" (click)="accessType.set('edit')">
                  {{ 'shared_folders.access_type_edit' | translate }}
                </button>
              </div>
            </div>

            <div class="field">
              <label for="ttl" class="field-label">{{ 'shared_folders.create_link_expires_label' | translate }}</label>
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
                {{ 'shared_folders.create_link_allow_save' | translate }}
              </label>
              <p class="check-hint">{{ 'shared_folders.create_link_allow_save_hint' | translate }}</p>
            </div>

            @if (error()) {
              <div class="error-msg">{{ error() }}</div>
            }
          </div>
        }

        @if (createdLink()) {
          <div class="dialog-body success-state">
            <div class="success-icon">✅</div>
            <p class="success-title">{{ 'shared_folders.create_link_created' | translate }}</p>
            <div class="link-display">
              <input type="text" [value]="createdLink()!.url" readonly class="link-input" />
              <button class="btn-copy" (click)="copyLink()">
                {{ copied() ? ('shared_folders.create_link_copied' | translate) : ('shared_folders.create_link_copy' | translate) }}
              </button>
            </div>
            <p class="link-meta">
              {{ createdLink()!.expires_at | date:'d MMM y, HH:mm' }}
              · <strong>{{ createdLink()!.access_type === 'view' ? ('shared_folders.access_type_view' | translate) : ('shared_folders.access_type_edit' | translate) }}</strong>
            </p>
          </div>
        }

        <div class="dialog-footer">
          @if (!createdLink()) {
            <button class="btn-secondary" (click)="closed.emit()">{{ 'common.cancel' | translate }}</button>
            <button class="btn-primary" (click)="submit()" [disabled]="submitting()">
              {{ submitting() ? ('shared_folders.create_link_submitting' | translate) : ('shared_folders.create_link_submit' | translate) }}
            </button>
          }
          @if (createdLink()) {
            <button class="btn-secondary" (click)="closed.emit()">{{ 'common.cancel' | translate }}</button>
            <button class="btn-primary" (click)="created.emit(); closed.emit()">Готово</button>
          }
        </div>
      </div>
    </div>
  `,
  styleUrl: './shared-folder-create-link-dialog.component.scss',
})
export class SharedFolderCreateLinkDialogComponent {
  readonly folderId = input.required<string>();
  readonly closed   = output<void>();
  readonly created  = output<void>();

  private readonly sfApi = inject(SharedFoldersApiService);
  private readonly fb    = inject(FormBuilder);

  readonly submitting  = signal(false);
  readonly error       = signal<string | null>(null);
  readonly createdLink = signal<SharedFolderLink | null>(null);
  readonly copied      = signal(false);
  readonly accessType  = signal<SharedFolderAccessType>('view');

  readonly form = this.fb.group({
    ttl_hours: [12],
    allow_save: [false],
  });

  submit(): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);

    const v = this.form.value;
    this.sfApi.createLink(this.folderId(), {
      access_type: this.accessType(),
      ttl_hours: +(v.ttl_hours ?? 12),
      allow_save: !!v.allow_save,
    }).subscribe({
      next: (res) => { this.submitting.set(false); this.createdLink.set(res.data.link); },
      error: (err) => { this.submitting.set(false); this.error.set(err.message ?? 'Ошибка'); },
    });
  }

  copyLink(): void {
    const url = this.createdLink()?.url;
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }
}
