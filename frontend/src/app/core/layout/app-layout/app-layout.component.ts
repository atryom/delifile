import {Component, inject, computed, signal, ChangeDetectionStrategy} from '@angular/core';
import {RouterLink, RouterLinkActive, Router} from '@angular/router';
import {TranslateModule} from '@ngx-translate/core';
import {AuthStateService} from '../../auth/auth-state.service';
import {AuthApiService} from '../../api/auth-api.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, TranslateModule],
  template: `
    <div class="app-shell">

      @if (isAuth()) {
        <!-- Email verification banner -->
        @if (needsVerification() && !resent()) {
          <div class="verify-banner" role="alert">
            <span class="verify-text">
              ⚠️ {{ 'layout.verify_banner.text' | translate }}
              @if (deadline()) {
                {{ 'layout.verify_banner.deadline' | translate : {date: deadline()} }}
              }
            </span>
            <button class="btn-resend" (click)="resendVerification()" [disabled]="resending()">
              {{ resending() ? ('layout.verify_banner.resending' | translate) : ('layout.verify_banner.resend_btn' | translate) }}
            </button>
          </div>
        }
        @if (resent()) {
          <div class="verify-banner verify-banner--sent" role="status">
            ✅ {{ 'layout.verify_banner.sent' | translate }}
          </div>
        }

        <!-- Mobile top bar -->
        <header class="mobile-header">
          <span class="mobile-brand">
            <span>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                   class="lucide lucide-file-symlink-icon lucide-file-symlink"><path
                d="M4 11V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h7"/><path
                d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="m10 18 3-3-3-3"/></svg>
            </span>
            <span>DeliFile</span>
          </span>
          <button
            class="burger-btn"
            (click)="toggleSidebar()"
            [attr.aria-expanded]="sidebarOpen()"
            [attr.aria-label]="'nav.menu' | translate">
            {{ sidebarOpen() ? '✕' : '☰' }}
          </button>
        </header>

        <!-- Backdrop -->
        <div
          class="backdrop"
          [class.visible]="sidebarOpen()"
          (click)="closeSidebar()"
          aria-hidden="true">
        </div>

        <!-- Sidebar -->
        <nav class="sidebar" [class.open]="sidebarOpen()">
          <div class="sidebar-brand">
            <span class="brand-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
                                          fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                          stroke-linejoin="round"
                                          class="lucide lucide-file-symlink-icon lucide-file-symlink"><path
              d="M4 11V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h7"/><path
              d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="m10 18 3-3-3-3"/></svg></span>
            <span class="brand-name">DeliFile</span>
          </div>

          <ul class="nav-links">
            <li>
              <a routerLink="/files" routerLinkActive="active" class="nav-link" (click)="closeSidebar()">
                <span class="nav-icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                                            viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2"
                                            stroke-linecap="round" stroke-linejoin="round"
                                            class="lucide lucide-folder-heart-icon lucide-folder-heart"><path
                  d="M10.638 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v3.417"/><path
                  d="M14.62 18.8A2.25 2.25 0 1 1 18 15.836a2.25 2.25 0 1 1 3.38 2.966l-2.626 2.856a.998.998 0 0 1-1.507 0z"/></svg></span>
                <span>{{ 'nav.files' | translate }}</span>
              </a>
            </li>
            <li>
              <a routerLink="/folders" routerLinkActive="active" class="nav-link" (click)="closeSidebar()">
                <span class="nav-icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                                            viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2"
                                            stroke-linecap="round" stroke-linejoin="round"
                                            class="lucide lucide-folder-bookmark-icon lucide-folder-bookmark"><path
                  d="M12 6v8l3-3 3 3V6"/><path
                  d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/></svg></span>
                <span>{{ 'nav.folders' | translate }}</span>
              </a>
            </li>
            <li>
              <a routerLink="/tags" routerLinkActive="active" class="nav-link" (click)="closeSidebar()">
                <span class="nav-icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                                            viewBox="0 0 24 24" fill="none" stroke="#dc1818" stroke-width="2"
                                            stroke-linecap="round" stroke-linejoin="round"
                                            class="lucide lucide-tag-icon lucide-tag"><path
                  d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle
                  cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg></span>
                <span>{{ 'nav.tags' | translate }}</span>
              </a>
            </li>
            <li>
              <a routerLink="/contacts" routerLinkActive="active" class="nav-link" (click)="closeSidebar()">
                <span class="nav-icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                                            viewBox="0 0 24 24" fill="none" stroke="#9126d9" stroke-width="2"
                                            stroke-linecap="round" stroke-linejoin="round"
                                            class="lucide lucide-users-icon lucide-users"><path
                  d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path
                  d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/></svg></span>
                <span>{{ 'nav.contacts' | translate }}</span>
              </a>
            </li>
            <li>
              <a routerLink="/activity" routerLinkActive="active" class="nav-link" (click)="closeSidebar()">
                <span class="nav-icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                                            viewBox="0 0 24 24" fill="none" stroke="#d6d5dd" stroke-width="2"
                                            stroke-linecap="round" stroke-linejoin="round"
                                            class="lucide lucide-scroll-text-icon lucide-scroll-text"><path
                  d="M15 12h-5"/><path d="M15 8h-5"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/><path
                  d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"/></svg></span>
                <span>{{ 'nav.activity' | translate }}</span>
              </a>
            </li>
            <li>
              <a routerLink="/settings/security" routerLinkActive="active" class="nav-link" (click)="closeSidebar()">
                <span class="nav-icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                                            viewBox="0 0 24 24" fill="none" stroke="#a89d1f" stroke-width="2"
                                            stroke-linecap="round" stroke-linejoin="round"
                                            class="lucide lucide-lock-keyhole-icon lucide-lock-keyhole"><circle cx="12"
                                                                                                                cy="16"
                                                                                                                r="1"/><rect
                  x="3" y="10" width="18" height="12" rx="2"/><path d="M7 10V7a5 5 0 0 1 10 0v3"/></svg></span>
                <span>{{ 'nav.security' | translate }}</span>
              </a>
            </li>
          </ul>

          <div class="sidebar-footer">
            <span class="user-email" [title]="userEmail()">{{ userEmail() }}</span>
            @if (!emailVerified()) {
              <span class="unverified-badge">{{ 'layout.sidebar.unverified' | translate }}</span>
            }
            <button class="btn-logout" (click)="logout()">{{ 'nav.logout' | translate }}</button>
          </div>
        </nav>
      }

      <!-- Main content -->
      <main class="main-content" [class.no-sidebar]="!isAuth()" [class.has-banner]="needsVerification() || resent()">
        <ng-content/>
      </main>
    </div>
  `,
  styles: [`
    .app-shell {
      display: flex;
      min-height: 100vh; min-height: 100svh;
      background: #f8f9fa;
    }

    /* ── Email verification banner ──────────────────────────── */
    .verify-banner {
      position: fixed;
      top: 0;
      left: 240px;
      right: 0;
      z-index: 200;
      background: #fef3c7;
      border-bottom: 1px solid #f59e0b;
      padding: 10px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      font-size: 0.88rem;
      color: #92400e;
    }

    .verify-banner--sent {
      background: #d1fae5;
      border-color: #10b981;
      color: #065f46;
    }

    .verify-text {
      flex: 1;
    }

    .btn-resend {
      white-space: nowrap;
      background: #f59e0b;
      border: none;
      color: #fff;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-resend:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* ── Sidebar ────────────────────────────────────────────── */
    .sidebar {
      width: 240px;
      min-height: 100vh; min-height: 100svh;
      background: #1a1a2e;
      color: #e0e0e0;
      display: flex;
      flex-direction: column;
      position: fixed;
      left: 0;
      top: 0;
      bottom: 0;
      z-index: 100;
      transition: transform 0.25s ease;
    }

    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 24px 20px 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      font-size: 1.15rem;
      font-weight: 700;
      color: #fff;
    }

    .brand-icon {
      font-size: 1.4rem;
    }

    .nav-links {
      list-style: none;
      padding: 12px 0;
      margin: 0;
      flex: 1;
    }

    .nav-links li {
      margin: 2px 10px;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 8px;
      color: #b0b0c0;
      text-decoration: none;
      font-size: 0.92rem;
      transition: background 0.15s, color 0.15s;
    }

    .nav-link:hover {
      background: rgba(255, 255, 255, 0.07);
      color: #fff;
    }

    .nav-link.active {
      background: rgba(99, 102, 241, 0.25);
      color: #a5b4fc;
    }

    .nav-icon {
      font-size: 1.05rem;
      width: 20px;
      text-align: center;
    }

    .sidebar-footer {
      padding: 16px 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .user-email {
      font-size: 0.78rem;
      color: #888;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .unverified-badge {
      font-size: 0.72rem;
      background: rgba(245, 158, 11, 0.2);
      color: #fbbf24;
      border-radius: 4px;
      padding: 2px 7px;
      display: inline-block;
    }

    .btn-logout {
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
      padding: 7px 14px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.85rem;
      transition: background 0.15s;
    }

    .btn-logout:hover {
      background: rgba(239, 68, 68, 0.22);
    }

    /* ── Main content ───────────────────────────────────────── */
    .main-content {
      margin-left: 240px;
      flex: 1;
      min-height: 100vh; min-height: 100svh;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .main-content.no-sidebar {
      margin-left: 0;
    }

    .main-content.has-banner {
      padding-top: 42px;
    }

    /* ── Mobile header ──────────────────────────────────────── */
    .mobile-header {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 56px;
      background: #1a1a2e;
      align-items: center;
      padding: 0 16px;
      z-index: 110;
      justify-content: space-between;
    }

    .mobile-brand {
      font-size: 1rem;
      font-weight: 700;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .burger-btn {
      background: none;
      border: none;
      color: #fff;
      font-size: 1.4rem;
      cursor: pointer;
      padding: 6px 10px;
      border-radius: 6px;
      line-height: 1;
    }

    .burger-btn:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    /* ── Backdrop ───────────────────────────────────────────── */
    .backdrop {
      display: none;
    }

    .backdrop.visible {
      display: block;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 99;
    }

    /* ── Mobile breakpoint ──────────────────────────────────── */
    @media (max-width: 768px) {
      .mobile-header {
        display: flex;
      }

      .verify-banner {
        left: 0;
        top: 56px;
      }

      .sidebar {
        transform: translateX(-100%);
        top: 0;
        z-index: 100;
      }

      .sidebar.open {
        transform: translateX(0);
      }

      .main-content {
        margin-left: 0;
        padding-top: 56px;
      }

      .main-content.has-banner {
        padding-top: calc(56px + 42px);
      }
    }
  `],
})
export class AppLayoutComponent {
  private readonly authState = inject(AuthStateService);
  private readonly authApi = inject(AuthApiService);
  private readonly router = inject(Router);

  readonly isAuth = this.authState.isAuthenticated;
  readonly needsVerification = this.authState.needsEmailVerification;
  readonly emailVerified = this.authState.isEmailVerified;
  readonly userEmail = computed(() => this.authState.user()?.email ?? '');
  readonly sidebarOpen = signal(false);
  readonly resending = signal(false);
  readonly resent = signal(false);

  readonly deadline = computed(() => {
    const d = this.authState.verificationDeadline();
    if (!d) return null;
    return new Date(d).toLocaleString('ru-RU', {day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit'});
  });

  toggleSidebar(): void {
    this.sidebarOpen.update(v => !v);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  resendVerification(): void {
    if (this.resending()) return;
    this.resending.set(true);
    this.authApi.resendVerification().subscribe({
      next: () => {
        this.resending.set(false);
        this.resent.set(true);
      },
      error: () => this.resending.set(false),
    });
  }

  logout(): void {
    this.authApi.logout().subscribe({
      complete: () => {
        this.authState.clearUser();
        this.router.navigate(['/login']);
      },
    });
  }
}
