import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppLayoutComponent } from './core/layout/app-layout/app-layout.component';
import { CookieConsentComponent } from './shared/components/cookie-consent/cookie-consent.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AppLayoutComponent, CookieConsentComponent],
  template: `
    <app-layout><router-outlet /></app-layout>
    <app-cookie-consent />
  `,
})
export class AppComponent {}
