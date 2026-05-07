import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppLayoutComponent } from './core/layout/app-layout/app-layout.component';
import { CookieConsentComponent } from './shared/components/cookie-consent/cookie-consent.component';
import { NotificationBannerComponent } from './shared/components/notification-banner/notification-banner.component';
import { VersionCheckService } from './core/services/version-check.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AppLayoutComponent, CookieConsentComponent, NotificationBannerComponent],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  private readonly versionCheck = inject(VersionCheckService);

  ngOnInit(): void {
    this.versionCheck.init();
  }
}
