import { Injectable, signal, computed } from '@angular/core';
import { AccountStatus, CurrentUser } from '../../shared/models/api.models';

const TOKEN_KEY = 'auth_token';

@Injectable({ providedIn: 'root' })
export class AuthStateService {
  private readonly _user  = signal<CurrentUser | null>(null);
  private readonly _token = signal<string | null>(localStorage.getItem(TOKEN_KEY));

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

  setUser(user: CurrentUser, token: string): void {
    this._user.set(user);
    this._token.set(token);
    localStorage.setItem(TOKEN_KEY, token);
  }

  updateUser(user: CurrentUser): void {
    this._user.set(user);
  }

  clearUser(): void {
    this._user.set(null);
    this._token.set(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('fs_device_pin');
  }

  restoreUser(user: CurrentUser): void {
    this._user.set(user);
  }
}
