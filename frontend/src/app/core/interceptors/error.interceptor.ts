import { HttpInterceptorFn, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  return next(req).pipe(
    catchError((error) => {
      // Normalize error shape for downstream consumers
      const apiError = error.error ?? { result: 'error', message: 'Network error', data: { code: 'NETWORK_ERROR', errors: {} } };
      return throwError(() => apiError);
    })
  );
};
