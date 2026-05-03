import { Component, inject, computed, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthStateService } from '../../auth/auth-state.service';
import { AuthApiService } from '../../api/auth-api.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslateModule],
  template: `
    <div class="app-shell">

      @if (isAuth()) {
        <!-- Mobile top bar -->
        <header class="mobile-header">
          <span class="mobile-brand">
            <span>🗂</span>
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
            <span class="brand-icon">🗂</span>
            <span class="brand-name">DeliFile</span>
          </div>

          <ul class="nav-links">
            <li>
              <a routerLink="/files" routerLinkActive="active" class="nav-link" (click)="closeSidebar()">
                <span class="nav-icon">📁</span>
                <span>{{ 'nav.files' | translate }}</span>
              </a>
            </li>
            <li>
              <a routerLink="/contacts" routerLinkActive="active" class="nav-link" (click)="closeSidebar()">
                <span class="nav-icon">👥</span>
                <span>{{ 'nav.contacts' | translate }}</span>
              </a>
            </li>
            <li>
              <a routerLink="/activity" routerLinkActive="active" class="nav-link" (click)="closeSidebar()">
                <span class="nav-icon">📋</span>
                <span>{{ 'nav.activity' | translate }}</span>
              </a>
            </li>
            <li>
              <a routerLink="/settings/security" routerLinkActive="active" class="nav-link" (click)="closeSidebar()">
                <span class="nav-icon">🔒</span>
                <span>{{ 'nav.security' | translate }}</span>
              </a>
            </li>
          </ul>

          <div class="sidebar-footer">
            <span class="user-phone">{{ userPhone() }}</span>
            <button class="btn-logout" (click)="logout()">{{ 'nav.logout' | translate }}</button>
          </div>
        </nav>
      }

      <!-- Main content -->
      <main class="main-content" [class.no-sidebar]="!isAuth()">
        <ng-content />
      </main>
    </div>
  `,
  styles: [`
    .app-shell {
      display: flex;
      min-height: 100vh;
      background: #f8f9fa;
    }

    /* ── Sidebar ────────────────────────────────────────────── */
    .sidebar {
      width: 240px;
      min-height: 100vh;
      background: #1a1a2e;
      color: #e0e0e0;
      display: flex;
      flex-direction: column;
      position: fixed;
      left: 0; top: 0; bottom: 0;
      z-index: 100;
      transition: transform 0.25s ease;
    }

    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 24px 20px 20px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      font-size: 1.15rem;
      font-weight: 700;
      color: #fff;
    }

    .brand-icon { font-size: 1.4rem; }

    .nav-links {
      list-style: none;
      padding: 12px 0;
      margin: 0;
      flex: 1;
    }

    .nav-links li { margin: 2px 10px; }

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

    .nav-link:hover { background: rgba(255,255,255,0.07); color: #fff; }
    .nav-link.active { background: rgba(99,102,241,0.25); color: #a5b4fc; }

    .nav-icon { font-size: 1.05rem; width: 20px; text-align: center; }

    .sidebar-footer {
      padding: 16px 20px;
      border-top: 1px solid rgba(255,255,255,0.08);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .user-phone {
      font-size: 0.8rem;
      color: #888;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .btn-logout {
      background: rgba(239,68,68,0.12);
      border: 1px solid rgba(239,68,68,0.3);
      color: #f87171;
      padding: 7px 14px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.85rem;
      transition: background 0.15s;
    }
    .btn-logout:hover { background: rgba(239,68,68,0.22); }

    /* ── Main content ───────────────────────────────────────── */
    .main-content {
      margin-left: 240px;
      flex: 1;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .main-content.no-sidebar { margin-left: 0; }

    /* ── Mobile header ──────────────────────────────────────── */
    .mobile-header {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0;
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
    .burger-btn:hover { background: rgba(255,255,255,0.1); }

    /* ── Backdrop ───────────────────────────────────────────── */
    .backdrop {
      display: none;
    }
    .backdrop.visible {
      display: block;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      z-index: 99;
    }

    /* ── Mobile breakpoint ──────────────────────────────────── */
    @media (max-width: 768px) {
      .mobile-header { display: flex; }

      .sidebar {
        transform: translateX(-100%);
        top: 0;
        z-index: 100;
      }
      .sidebar.open { transform: translateX(0); }

      .main-content {
        margin-left: 0;
        padding-top: 56px;
      }
    }
  `],
})
export class AppLayoutComponent {
  private readonly authState = inject(AuthStateService);
  private readonly authApi   = inject(AuthApiService);
  private readonly router    = inject(Router);

  readonly isAuth      = this.authState.isAuthenticated;
  readonly userPhone   = computed(() => this.authState.user()?.phone ?? '');
  readonly sidebarOpen = signal(false);

  toggleSidebar(): void { this.sidebarOpen.update(v => !v); }
  closeSidebar(): void  { this.sidebarOpen.set(false); }

  logout(): void {
    this.authApi.logout().subscribe({
      complete: () => {
        this.authState.clearUser();
        this.router.navigate(['/login']);
      },
    });
  }
}