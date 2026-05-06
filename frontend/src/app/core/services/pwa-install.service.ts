import { Injectable, DestroyRef, inject, signal, computed } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PwaInstallService {
  private readonly destroyRef = inject(DestroyRef);

  private readonly _prompt    = signal<BeforeInstallPromptEvent | null>(null);
  private readonly _installed = signal(
    typeof window !== 'undefined' &&
    window.matchMedia('(display-mode: standalone)').matches
  );

  /** iOS Safari — no beforeinstallprompt, needs manual instruction */
  readonly isIos = typeof window !== 'undefined' &&
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !('MSStream' in window);

  /** True when Chrome-style native install prompt is available */
  readonly canInstall = computed(() => this._prompt() !== null && !this._installed());

  /** Show iOS "how to install" hint when not already installed */
  readonly showIosHint = computed(() => this.isIos && !this._installed());

  /** True when either prompt or iOS hint is relevant */
  readonly showInstallUI = computed(() => this.canInstall() || this.showIosHint());

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

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
