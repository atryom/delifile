import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

const STORAGE_KEY = 'cookie_consent';

@Component({
  selector: 'app-cookie-consent',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslateModule],
  template: `
    @if (visible()) {
      <div class="cookie-banner" role="dialog" aria-live="polite" aria-label="Cookie consent">
        <p class="cookie-text">
          {{ 'cookie.text' | translate }}
          <a routerLink="/privacy" class="cookie-link">{{ 'cookie.policy_link' | translate }}</a>.
        </p>
        <button type="button" class="cookie-btn" (click)="accept()">
          {{ 'cookie.accept' | translate }}
        </button>
      </div>
    }
  `,
  styles: [`
    .cookie-banner {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 9999;
      background: #1a1a2e;
      color: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 16px 24px;
      box-shadow: 0 -2px 12px rgba(0,0,0,.35);
    }
    .cookie-text {
      margin: 0;
      font-size: 0.875rem;
      line-height: 1.5;
    }
    .cookie-link {
      color: #818cf8;
      text-decoration: underline;
    }
    .cookie-link:hover { color: #a5b4fc; }
    .cookie-btn {
      flex-shrink: 0;
      background: #6366f1;
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 8px 20px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }
    .cookie-btn:hover { background: #4f46e5; }
    @media (max-width: 540px) {
      .cookie-banner { flex-direction: column; align-items: flex-start; }
    }
  `],
})
export class CookieConsentComponent {
  readonly visible = signal(!localStorage.getItem(STORAGE_KEY));

  accept(): void {
    localStorage.setItem(STORAGE_KEY, '1');
    this.visible.set(false);
  }
}
