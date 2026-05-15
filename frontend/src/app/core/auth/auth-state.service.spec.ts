import { TestBed } from '@angular/core/testing';
import { AuthStateService } from './auth-state.service';

describe('AuthStateService', () => {
  let service: AuthStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AuthStateService],
    });
    service = TestBed.inject(AuthStateService);
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with no user', () => {
    expect(service.isAuthenticated()).toBe(false);
    expect(service.user()).toBeNull();
    expect(service.token()).toBeNull();
  });

  it('should set user and token', () => {
    const user = { id: '1', email: 'test@test.com' } as any;
    service.setUser(user, 'token-123', true);

    expect(service.isAuthenticated()).toBe(true);
    expect(service.user()).toEqual(user);
    expect(service.token()).toBe('token-123');
    expect(localStorage.getItem('auth_token')).toBe('token-123');
  });

  it('should store token in sessionStorage when remember is false', () => {
    const user = { id: '1', email: 'test@test.com' } as any;
    service.setUser(user, 'token-456', false);

    expect(sessionStorage.getItem('auth_token')).toBe('token-456');
    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  it('should clear user and token', () => {
    service.setUser({ id: '1' } as any, 'token', true);
    expect(service.isAuthenticated()).toBe(true);

    service.clearUser();

    expect(service.isAuthenticated()).toBe(false);
    expect(service.user()).toBeNull();
    expect(service.token()).toBeNull();
  });

  it('should update user', () => {
    service.setUser({ id: '1', email: 'old@test.com' } as any, 'token', true);
    service.updateUser({ id: '1', email: 'new@test.com' } as any);

    expect(service.user()?.email).toBe('new@test.com');
  });

  it('should restore user', () => {
    const user = { id: '1', email: 'test@test.com' } as any;
    service.restoreUser(user);

    expect(service.isAuthenticated()).toBe(true);
    expect(service.user()).toEqual(user);
  });

  it('should compute isEmailVerified', () => {
    const unverified = { id: '1', email_verified: false } as any;
    service.setUser(unverified, 'token', true);
    expect(service.isEmailVerified()).toBe(false);

    const verified = { id: '1', email_verified: true } as any;
    service.setUser(verified, 'token', true);
    expect(service.isEmailVerified()).toBe(true);
  });

  it('should compute isBlocked', () => {
    const blocked = { id: '1', account_status: 'blocked_unverified_email' } as any;
    service.setUser(blocked, 'token', true);
    expect(service.isBlocked()).toBe(true);

    const active = { id: '2', account_status: 'active' } as any;
    service.setUser(active, 'token', true);
    expect(service.isBlocked()).toBe(false);
  });

  it('should compute isSuperUser', () => {
    const regular = { id: '1', is_superuser: false } as any;
    service.setUser(regular, 'token', true);
    expect(service.isSuperUser()).toBe(false);

    const admin = { id: '2', is_superuser: true } as any;
    service.setUser(admin, 'token', true);
    expect(service.isSuperUser()).toBe(true);
  });
});
