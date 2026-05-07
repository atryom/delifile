import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class VersionCheckService {
  private currentHash: string | null = null;
  private initialized = false;

  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Read hash that postbuild.js injected into index.html
    this.currentHash = (window as unknown as Record<string, unknown>)['__BUILD_HASH__'] as string ?? null;

    // Dev builds have no hash — skip checks
    if (!this.currentHash) return;

    // Reload when user returns to the tab / resumes the PWA
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.checkVersion();
      }
    });

    // Reload immediately when the Service Worker signals it was updated
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', event => {
        if ((event.data as { type?: string })?.type === 'SW_UPDATED') {
          window.location.reload();
        }
      });
    }
  }

  private checkVersion(): void {
    fetch(`/version.json?_=${Date.now()}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then((data: { hash?: string } | null) => {
        if (data?.hash && data.hash !== this.currentHash) {
          window.location.reload();
        }
      })
      .catch(() => { /* network unavailable — skip */ });
  }
}
