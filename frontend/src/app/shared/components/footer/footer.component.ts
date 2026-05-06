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
      background: #f8f9fa;
      border-top: 1px solid #e5e7eb;
      font-size: 0.78rem;
      color: #9ca3af;
      flex-wrap: wrap;
    }
    .footer-copy { color: #9ca3af; }
    .footer-link { color: #6b7280; text-decoration: none; }
    .footer-link:hover { color: #6366f1; text-decoration: underline; }

    @media (max-width: 768px) {
      .app-footer { left: 0; }
    }
  `],
})
export class FooterComponent {}
