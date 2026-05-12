import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <footer class="app-footer">
      <span class="footer-copy">@DeliFile.RU 2026</span>
      <a routerLink="/privacy" class="footer-link">Политика конфиденциальности</a>
    </footer>
  `,
  styles: [`
    .app-footer {
      position: fixed;
      bottom: 0;
      left: 240px;
      right: 0;
      z-index: 50;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 20px;
      padding: 10px 24px;
      background: var(--surface);
      border-top: 1px solid var(--border);
      font-size: 0.78rem;
      color: var(--text-muted);
      flex-wrap: wrap;
    }
    .footer-copy { color: var(--text-muted); }
    .footer-link { color: var(--text-dim); text-decoration: none; }
    .footer-link:hover { color: var(--accent-text); text-decoration: underline; }

    @media (max-width: 768px) {
      .app-footer { left: 0; }
    }
  `],
})
export class FooterComponent {}
