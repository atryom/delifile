import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

const STORAGE_KEY = 'cookie_consent';

@Component({
  selector: 'app-cookie-consent',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslateModule],
  templateUrl: './cookie-consent.component.html',
  styleUrl: './cookie-consent.component.scss',
})
export class CookieConsentComponent {
  readonly visible = signal(!localStorage.getItem(STORAGE_KEY));

  accept(): void {
    localStorage.setItem(STORAGE_KEY, '1');
    this.visible.set(false);
  }
}
