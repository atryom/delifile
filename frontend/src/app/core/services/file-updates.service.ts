import { Injectable, signal } from '@angular/core';

export interface FileNameUpdate {
  id: string;
  display_name: string | null;
  original_name: string;
}

@Injectable({ providedIn: 'root' })
export class FileUpdatesService {
  readonly lastRename = signal<FileNameUpdate | null>(null);

  notifyRenamed(update: FileNameUpdate): void {
    this.lastRename.set(update);
  }
}
