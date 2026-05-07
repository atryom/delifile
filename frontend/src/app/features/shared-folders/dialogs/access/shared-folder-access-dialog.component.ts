import { Component, input, output, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { SharedFoldersApiService } from '../../../../core/api/shared-folders-api.service';
import { SharedFolderAccess, SharedFolderLink } from '../../../../shared/models/api.models';
import { SharedFolderAddContactDialogComponent } from '../add-contact/shared-folder-add-contact-dialog.component';
import { SharedFolderCreateLinkDialogComponent } from '../create-link/shared-folder-create-link-dialog.component';

@Component({
  selector: 'app-shared-folder-access-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, TranslateModule, SharedFolderAddContactDialogComponent, SharedFolderCreateLinkDialogComponent],
  templateUrl: './shared-folder-access-dialog.component.html',
  styleUrl: './shared-folder-access-dialog.component.scss',
})
export class SharedFolderAccessDialogComponent implements OnInit {
  readonly folderId   = input.required<string>();
  readonly folderName = input<string>('');
  readonly closed     = output<void>();

  private readonly sfApi = inject(SharedFoldersApiService);

  readonly accesses        = signal<SharedFolderAccess[]>([]);
  readonly links           = signal<SharedFolderLink[]>([]);
  readonly loadingAccesses = signal(true);
  readonly loadingLinks    = signal(true);
  readonly showAddContact  = signal(false);
  readonly showCreateLink  = signal(false);
  readonly copiedLinkId    = signal<string | null>(null);

  ngOnInit(): void {
    this.loadAccesses();
    this.loadLinks();
  }

  private loadAccesses(): void {
    this.loadingAccesses.set(true);
    this.sfApi.listAccesses(this.folderId()).subscribe({
      next: (res) => { this.accesses.set(res.data.items); this.loadingAccesses.set(false); },
      error: () => this.loadingAccesses.set(false),
    });
  }

  private loadLinks(): void {
    this.loadingLinks.set(true);
    this.sfApi.listLinks(this.folderId()).subscribe({
      next: (res) => { this.links.set(res.data.items); this.loadingLinks.set(false); },
      error: () => this.loadingLinks.set(false),
    });
  }

  removeAccess(accessId: string): void {
    this.sfApi.removeAccess(this.folderId(), accessId).subscribe({
      next: () => this.loadAccesses(),
    });
  }

  disableLink(linkId: string): void {
    this.sfApi.disableLink(this.folderId(), linkId).subscribe({
      next: () => this.loadLinks(),
    });
  }

  copyLink(url: string, linkId: string): void {
    navigator.clipboard.writeText(url).then(() => {
      this.copiedLinkId.set(linkId);
      setTimeout(() => this.copiedLinkId.set(null), 2000);
    });
  }

  onContactAdded(): void {
    this.loadAccesses();
  }

  onLinkCreated(): void {
    this.loadLinks();
  }

  accessTypeLabel(t: string): string {
    return t === 'view' ? 'Просмотр' : 'Редактирование';
  }
}
