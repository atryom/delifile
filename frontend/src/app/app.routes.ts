import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/files',
    pathMatch: 'full',
  },

  // ─── Auth (guest only) ───────────────────────────────────────────────────
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/pages/login/login.component').then(
        (m) => m.LoginComponent
      ),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/pages/register/register.component').then(
        (m) => m.RegisterComponent
      ),
  },
  {
    path: 'pin-setup',
    loadComponent: () =>
      import('./features/auth/pages/pin-setup/pin-setup.component').then(
        (m) => m.PinSetupComponent
      ),
  },

  // ─── Protected ──────────────────────────────────────────────────────────
  {
    path: 'files',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/files/pages/file-list/file-list.component').then(
        (m) => m.FileListComponent
      ),
  },
  {
    path: 'files/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/files/pages/file-detail/file-detail.component').then(
        (m) => m.FileDetailComponent
      ),
  },
  {
    path: 'contacts',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/contacts/pages/contacts/contacts.component').then(
        (m) => m.ContactsComponent
      ),
  },
  {
    path: 'activity',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/activity/pages/activity/activity.component').then(
        (m) => m.ActivityComponent
      ),
  },
  {
    path: 'settings/security',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/settings/pages/security/security.component').then(
        (m) => m.SecurityComponent
      ),
  },

  // ─── Public link flow ────────────────────────────────────────────────────
  {
    path: 'link/:token',
    loadComponent: () =>
      import('./features/files/pages/public-link/public-link.component').then(
        (m) => m.PublicLinkComponent
      ),
  },

  {
    path: '**',
    redirectTo: '/files',
  },
];
