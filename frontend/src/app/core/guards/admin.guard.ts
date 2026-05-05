import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStateService } from '../auth/auth-state.service';

export const adminGuard: CanActivateFn = () => {
  const authState = inject(AuthStateService);
  const router    = inject(Router);

  if (!authState.isAuthenticated() || !authState.isSuperUser()) {
    router.navigate(['/files']);
    return false;
  }
  return true;
};
