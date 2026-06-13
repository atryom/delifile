import { Component, inject, signal, input, output, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { FileRequestsApiService } from '../../../../core/api/file-requests-api.service';
import { FileRequestItem } from '../../../../shared/models/api.models';

@Component({
  selector: 'app-create-file-request-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './create-file-request-dialog.component.html',
  styleUrl: './create-file-request-dialog.component.scss',
})
export class CreateFileRequestDialogComponent {
  readonly folderId = input<string | null>(null);
  readonly closed   = output<void>();

  private readonly api = inject(FileRequestsApiService);
  private readonly fb  = inject(FormBuilder);

  readonly createdRequest = signal<FileRequestItem | null>(null);
  readonly submitting     = signal(false);
  readonly error          = signal<string | null>(null);
  readonly copied         = signal(false);

  readonly form = this.fb.group({
    description:    ['', [Validators.required, Validators.maxLength(1000)]],
    ttl_hours:      [168, [Validators.required, Validators.min(1)]],
    allow_multiple: [false],
  });

  submit(): void {
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);

    const { description, ttl_hours, allow_multiple } = this.form.getRawValue();

    this.api.create(description!, ttl_hours!, this.folderId(), allow_multiple ?? false).subscribe({
      next: res => {
        this.createdRequest.set(res.data.request);
        this.submitting.set(false);
      },
      error: err => {
        this.error.set(err?.error?.message ?? 'Не удалось создать запрос');
        this.submitting.set(false);
      },
    });
  }

  copyLink(): void {
    const url = this.createdRequest()!.url;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 2000);
      });
    } else {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        document.execCommand('copy');
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 2000);
      } finally {
        document.body.removeChild(ta);
      }
    }
  }

  formatExpiry(iso: string | null): string {
    if (!iso) return 'бессрочно';
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }
}
