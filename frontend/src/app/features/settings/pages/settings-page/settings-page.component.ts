import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, TranslateModule],
  template: `
    <div class="settings-shell">
      <div class="tabs" role="tablist">
        <a
          routerLink="tags"
          routerLinkActive="tab-btn--active"
          class="tab-btn"
          role="tab">
          {{ 'nav.tags' | translate }}
        </a>
        <a
          routerLink="security"
          routerLinkActive="tab-btn--active"
          class="tab-btn"
          role="tab">
          {{ 'nav.security' | translate }}
        </a>
        <a
          routerLink="support"
          routerLinkActive="tab-btn--active"
          class="tab-btn"
          role="tab">
          {{ 'nav.support' | translate }}
        </a>
      </div>
      <router-outlet />
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; flex: 1; }

    .settings-shell {
      display: flex;
      flex-direction: column;
      flex: 1;
    }

    .tabs {
      display: flex;
      gap: 4px;
      border-bottom: 2px solid var(--border);
      padding: 0 16px;
      background: var(--surface);
    }

    .tab-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 12px 16px;
      border: none;
      background: none;
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--text-dim);
      cursor: pointer;
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      border-radius: 4px 4px 0 0;
      transition: color 0.15s;
      text-decoration: none;

      &:hover { color: var(--text); }

      &.tab-btn--active {
        color: var(--accent);
        border-bottom-color: var(--accent);
      }
    }

    @media (max-width: 480px) {
      .tabs { padding: 0 8px; gap: 0; }
      .tab-btn { padding: 10px 10px; font-size: 0.78rem; }
    }
  `],
})
export class SettingsPageComponent {}
