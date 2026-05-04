import { Injectable, signal, computed } from '@angular/core';
import { AccountStatus, CurrentUser } from '../../shared/models/api.models';

const TOKEN_KEY = 'auth_token';
const REMEMBER_KEY = 'auth_remember';

@Injectable({ providedIn: 'root' })
export class AuthStateService {
  private readonly _user  = signal<CurrentUser | null>(null);
  private readonly _token = signal<string | null>(
    localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY)
  );

  readonly user            = this._user.asReadonly();
  readonly token           = this._token.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  readonly isEmailVerified = computed(() => this._user()?.email_verified ?? false);

  readonly accountStatus = computed<AccountStatus | null>(() => this._user()?.account_status ?? null);

  readonly isBlocked = computed(() => this._user()?.account_status === 'blocked_unverified_email');

  readonly needsEmailVerification = computed(() =>
    this._user()?.account_status === 'pending_email_verification' && !this._user()?.email_verified
  );

  readonly verificationDeadline = computed(() =>
    this._user()?.email_verification_deadline_at ?? null
  );

  setUser(user: CurrentUser, token: string, remember = true): void {
    this._user.set(user);
    this._token.set(token);
    if (remember) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(REMEMBER_KEY, '1');
      sessionStorage.removeItem(TOKEN_KEY);
    } else {
      sessionStorage.setItem(TOKEN_KEY, token);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REMEMBER_KEY);
    }
  }

  updateUser(user: CurrentUser): void {
    this._user.set(user);
  }

  clearUser(): void {
    this._user.set(null);
    this._token.set(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REMEMBER_KEY);
    localStorage.removeItem('fs_device_pin');
    sessionStorage.removeItem(TOKEN_KEY);
  }

  restoreUser(user: CurrentUser): void {
    this._user.set(user);
  }
}
