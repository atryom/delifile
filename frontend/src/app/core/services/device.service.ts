import { Injectable } from '@angular/core';

const DEVICE_ID_KEY = 'df_device_id';
const DEVICE_ID_COOKIE = 'df_did';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds

@Injectable({ providedIn: 'root' })
export class DeviceService {
  getDeviceId(): string {
    let id = localStorage.getItem(DEVICE_ID_KEY) ?? this.readCookie(DEVICE_ID_COOKIE);
    if (!id) {
      id = crypto.randomUUID();
    }
    localStorage.setItem(DEVICE_ID_KEY, id);
    this.writeCookie(DEVICE_ID_COOKIE, id, COOKIE_MAX_AGE);
    return id;
  }

  private readCookie(name: string): string | null {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  private writeCookie(name: string, value: string, maxAge: number): void {
    document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; SameSite=Strict`;
  }

  getDeviceType(): string {
    const ua = navigator.userAgent;
    const isPWA =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    const os = this.detectOS(ua);
    const isMobile =
      /android|iphone|ipad|ipod/i.test(ua) ||
      (navigator as unknown as { userAgentData?: { mobile?: boolean } }).userAgentData?.mobile === true;

    if (isPWA) return `PWA (${os})`;
    if (isMobile) return `Mobile (${os})`;
    return `Desktop (${os})`;
  }

  private detectOS(ua: string): string {
    const uaData = (navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData;
    const platform = uaData?.platform ?? navigator.platform ?? '';

    if (/android/i.test(ua)) return 'Android';
    if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
    if (/windows/i.test(ua) || /win/i.test(platform)) return 'Windows';
    if (/macintosh|mac os x/i.test(ua) || /mac/i.test(platform)) return 'macOS';
    if (/linux/i.test(ua) || /linux/i.test(platform)) return 'Linux';
    return 'Unknown';
  }
}
