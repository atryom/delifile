import { inject } from '@angular/core';
import { AuthApiService } from '../api/auth-api.service';
import { AuthStateService } from '../auth/auth-state.service';
import { catchError, of } from 'rxjs';

/**
 * APP_INITIALIZER factory.
 * On every app load, tries /auth/me to restore session from Sanctum cookie.
 * If it fails (401), user stays unauthenticated — no redirect here, guards handle it.
 */
export function authInitializer(): () => Promise<void> {
  const authApi   = inject(AuthApiService);
  const authState = inject(AuthStateService);

  return () =>
    new Promise((resolve) => {
      authApi
        .me()
        .pipe(catchError(() => of(null)))
        .subscribe((res) => {
          if (res?.result === 'success' && res.data?.user) {
            authState.restoreUser(res.data.user);
          }
          resolve();
        });
    });
}
