import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PushService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  get isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window;
  }

  async subscribe(): Promise<void> {
    if (!this.isSupported) {
      console.warn('[Push] Not supported: serviceWorker or PushManager missing');
      return;
    }

    const vapidKey = await this.fetchVapidKey();
    if (!vapidKey) {
      console.warn('[Push] Could not fetch VAPID key');
      return;
    }

    let registration: ServiceWorkerRegistration;
    try {
      registration = await navigator.serviceWorker.ready;
    } catch (e) {
      console.error('[Push] serviceWorker.ready failed:', e);
      return;
    }

    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      await existing.unsubscribe();
    }

    let subscription: PushSubscription;
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlB64ToUint8Array(vapidKey),
      });
    } catch (e) {
      console.error('[Push] pushManager.subscribe() failed:', e);
      return;
    }

    const json = subscription.toJSON();
    try {
      await firstValueFrom(
        this.http.post(`${this.base}/push/subscribe`, {
          endpoint: subscription.endpoint,
          p256dh:   json.keys?.['p256dh'],
          auth:     json.keys?.['auth'],
        })
      );
      console.info('[Push] Subscription saved to server');
    } catch (e) {
      console.error('[Push] POST /push/subscribe failed:', e);
    }
  }

  async unsubscribe(): Promise<void> {
    if (!this.isSupported) return;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await firstValueFrom(
      this.http.delete(`${this.base}/push/unsubscribe`, { body: { endpoint } })
    );
  }

  private async fetchVapidKey(): Promise<string | null> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ data: { public_key: string } }>(`${this.base}/push/vapid-key`)
      );
      return res.data?.public_key ?? null;
    } catch {
      return null;
    }
  }

  private urlB64ToUint8Array(base64: string): ArrayBuffer {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(b64);
    const arr = new Uint8Array([...raw].map(c => c.charCodeAt(0)));
    return arr.buffer as ArrayBuffer;
  }
}
