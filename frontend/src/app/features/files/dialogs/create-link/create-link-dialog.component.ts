import { Component, inject, signal, input, output } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FilesApiService } from '../../../../core/api/files-api.service';
import { ShareLink } from '../../../../shared/models/api.models';

@Component({
  selector: 'app-create-link-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule],
  templateUrl: './create-link-dialog.component.html',
  styleUrl: './create-link-dialog.component.scss',
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
    const url = this.createdLink()!.url;
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
    if (!iso) return this.translate.instant('files.create_link.never');
    return new Date(iso).toLocaleString();
  }
}
