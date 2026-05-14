import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { adminGuard } from './core/guards/admin.guard';

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
      import('./features/auth/pages/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/pages/register/register.component').then(m => m.RegisterComponent),
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/pages/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/pages/reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
  },

  // ─── Account blocked (accessible without auth guard to allow logout) ─────
  {
    path: 'account-blocked',
    loadComponent: () =>
      import('./features/auth/pages/account-blocked/account-blocked.component').then(
        m => m.AccountBlockedComponent
      ),
  },

  // ─── Protected ──────────────────────────────────────────────────────────
  {
    path: 'files',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/files/pages/file-list/file-list.component').then(m => m.FileListComponent),
  },
  {
    path: 'files/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/files/pages/file-detail/file-detail.component').then(m => m.FileDetailComponent),
  },
  {
    path: 'folders',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/folders/pages/folders-tree/folders-tree.component').then(
        m => m.FoldersTreeComponent
      ),
  },
  {
    path: 'tags',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/tags/pages/tags-list/tags-list.component').then(m => m.TagsListComponent),
  },
  {
    path: 'contacts',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/contacts/pages/contacts/contacts.component').then(m => m.ContactsComponent),
  },
  {
    path: 'activity',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/activity/pages/activity/activity.component').then(m => m.ActivityComponent),
  },
  {
    path: 'settings/security',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/settings/pages/security/security.component').then(m => m.SecurityComponent),
  },

  // ─── Invitation flow ─────────────────────────────────────────────────────
  {
    path: 'invite/:token',
    loadComponent: () =>
      import('./features/invitations/pages/invite-accept/invite-accept.component').then(
        m => m.InviteAcceptComponent
      ),
  },

  // ─── Tariff plans ────────────────────────────────────────────────────────
  {
    path: 'tariffs',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/tariffs/pages/tariffs/tariffs.component').then(m => m.TariffsComponent),
  },

  // ─── Support ─────────────────────────────────────────────────────────────
  {
    path: 'support',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/support/pages/support/support.component').then(m => m.SupportComponent),
  },

  // ─── Admin ───────────────────────────────────────────────────────────────
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./features/admin/pages/admin/admin.component').then(m => m.AdminComponent),
  },

  // ─── PWA Share Target ────────────────────────────────────────────────────
  {
    path: 'share-target',
    loadComponent: () =>
      import('./features/share-target/share-target.component').then(m => m.ShareTargetComponent),
  },

  // ─── Legal pages ─────────────────────────────────────────────────────────
  {
    path: 'privacy',
    loadComponent: () =>
      import('./features/legal/pages/privacy/privacy.component').then(m => m.PrivacyComponent),
  },

  // ─── Public link flow ────────────────────────────────────────────────────
  {
    path: 'link/:token',
    loadComponent: () =>
      import('./features/files/pages/public-link/public-link.component').then(
        m => m.PublicLinkComponent
      ),
  },

  // ─── Public shared folder link ───────────────────────────────────────────
  {
    path: 'shared-link/:token',
    loadComponent: () =>
      import('./features/shared-folders/pages/public-shared-link/public-shared-link.component').then(
        m => m.PublicSharedLinkComponent
      ),
  },

  {
    path: '**',
    redirectTo: '/files',
  },
];
