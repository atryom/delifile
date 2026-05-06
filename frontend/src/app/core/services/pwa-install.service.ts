import { Injectable, DestroyRef, inject, signal, computed } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PwaInstallService {
  private readonly destroyRef = inject(DestroyRef);

  private readonly _prompt    = signal<BeforeInstallPromptEvent | null>(null);
  private readonly _installed = signal(
    typeof window !== 'undefined' &&
    window.matchMedia('(display-mode: standalone)').matches
  );

  /** True when the native install prompt is available and app is not yet installed. */
  readonly canInstall = computed(() => this._prompt() !== null && !this._installed());

  private readonly _onBeforeInstall = (e: Event) => {
    e.preventDefault();
    this._prompt.set(e as BeforeInstallPromptEvent);
  };

  private readonly _onAppInstalled = () => {
    this._prompt.set(null);
    this._installed.set(true);
  };

  constructor() {
    if (typeof window === 'undefined') return;

    // Pick up prompt captured before Angular bootstrapped (see index.html)
    const early = (window as any).__pwaInstallPrompt as BeforeInstallPromptEvent | undefined;
    if (early) {
      this._prompt.set(early);
      (window as any).__pwaInstallPrompt = null;
    }

    window.addEventListener('beforeinstallprompt', this._onBeforeInstall);
    window.addEventListener('appinstalled', this._onAppInstalled);

    this.destroyRef.onDestroy(() => {
      window.removeEventListener('beforeinstallprompt', this._onBeforeInstall);
      window.removeEventListener('appinstalled', this._onAppInstalled);
    });
  }

  async install(): Promise<void> {
    const prompt = this._prompt();
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      this._prompt.set(null);
      this._installed.set(true);
    }
  }
}

// Browser-native type not yet in all TS lib versions
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
