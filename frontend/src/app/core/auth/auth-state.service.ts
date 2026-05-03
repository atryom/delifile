import { Injectable, signal, computed } from '@angular/core';
import { CurrentUser } from '../../shared/models/api.models';

const TOKEN_KEY = 'auth_token';

@Injectable({ providedIn: 'root' })
export class AuthStateService {
  private readonly _user  = signal<CurrentUser | null>(null);
  private readonly _token = signal<string | null>(localStorage.getItem(TOKEN_KEY));

  readonly user            = this._user.asReadonly();
  readonly token           = this._token.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  setUser(user: CurrentUser, token: string): void {
    this._user.set(user);
    this._token.set(token);
    localStorage.setItem(TOKEN_KEY, token);
  }

  clearUser(): void {
    this._user.set(null);
    this._token.set(null);
    localStorage.removeItem(TOKEN_KEY);
  }

  restoreUser(user: CurrentUser): void {
    this._user.set(user);
  }
}