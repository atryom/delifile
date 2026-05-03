import { HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { AuthStateService } from '../auth/auth-state.service';

const isExternalRequest = (req: HttpRequest<unknown>): boolean =>
  req.url.startsWith('http') && !req.url.includes(window.location.hostname);

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const router    = inject(Router);
  const authState = inject(AuthStateService);

  if (isExternalRequest(req)) {
    return next(req);
  }

  const token = authState.token();

  const cloned = req.clone({
    withCredentials: true,
    ...(token ? { setHeaders: { Authorization: `Bearer ${token}` } } : {}),
  });

  return next(cloned).pipe(
    catchError((error) => {
      if (error.status === 401) {
        authState.clearUser();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
