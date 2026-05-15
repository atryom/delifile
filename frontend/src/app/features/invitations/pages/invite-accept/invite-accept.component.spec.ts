import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { provideTranslateService } from '@ngx-translate/core';
import { InvitationsApiService } from '../../../../core/api/invitations-api.service';
import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { InviteAcceptComponent } from './invite-accept.component';

describe('InviteAcceptComponent', () => {
  const mockInvApi = { get: vi.fn(), accept: vi.fn() };
  const mockAuthState = { isAuthenticated: vi.fn() };
  const mockRouter = { navigate: vi.fn() };
  let mockRoute: { snapshot: { paramMap: { get: ReturnType<typeof vi.fn> } } };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRoute = { snapshot: { paramMap: { get: vi.fn() } } };
  });

  async function createComponent() {
    await TestBed.configureTestingModule({
      imports: [InviteAcceptComponent],
      providers: [
        provideTranslateService(),
        { provide: InvitationsApiService, useValue: mockInvApi },
        { provide: AuthStateService, useValue: mockAuthState },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockRoute },
      ],
    }).compileComponents();
    return TestBed.createComponent(InviteAcceptComponent);
  }

  // ─── Init states ────────────────────────────────────────────────

  it('should create', async () => {
    mockRoute.snapshot.paramMap.get.mockReturnValue('tok');
    mockInvApi.get.mockReturnValue(of({
      data: { invitation: { status: 'pending' }, user_exists: false },
    }));
    mockAuthState.isAuthenticated.mockReturnValue(false);

    const fixture = await createComponent();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should go to not_found when invitation not found', async () => {
    mockRoute.snapshot.paramMap.get.mockReturnValue('bad-tok');
    mockInvApi.get.mockReturnValue(throwError(() => ({})));

    const fixture = await createComponent();
    fixture.detectChanges();

    expect(fixture.componentInstance.state()).toBe('not_found');
  });

  it('should go to expired when invitation expired', async () => {
    mockRoute.snapshot.paramMap.get.mockReturnValue('tok');
    mockInvApi.get.mockReturnValue(of({
      data: { invitation: { status: 'expired' }, user_exists: false },
    }));

    const fixture = await createComponent();
    fixture.detectChanges();

    expect(fixture.componentInstance.state()).toBe('expired');
  });

  it('should go to accepted when already accepted', async () => {
    mockRoute.snapshot.paramMap.get.mockReturnValue('tok');
    mockInvApi.get.mockReturnValue(of({
      data: { invitation: { status: 'accepted' }, user_exists: false },
    }));

    const fixture = await createComponent();
    fixture.detectChanges();

    expect(fixture.componentInstance.state()).toBe('accepted');
  });

  it('should go to error for unknown status', async () => {
    mockRoute.snapshot.paramMap.get.mockReturnValue('tok');
    mockInvApi.get.mockReturnValue(of({
      data: { invitation: { status: 'cancelled' }, user_exists: false },
    }));

    const fixture = await createComponent();
    fixture.detectChanges();

    expect(fixture.componentInstance.state()).toBe('error');
  });

  it('should go to need_login when not authenticated and user exists', async () => {
    mockRoute.snapshot.paramMap.get.mockReturnValue('tok');
    mockInvApi.get.mockReturnValue(of({
      data: { invitation: { status: 'pending' }, user_exists: true },
    }));
    mockAuthState.isAuthenticated.mockReturnValue(false);

    const fixture = await createComponent();
    fixture.detectChanges();

    expect(fixture.componentInstance.state()).toBe('need_login');
  });

  it('should go to need_register when not authenticated and user does not exist', async () => {
    mockRoute.snapshot.paramMap.get.mockReturnValue('tok');
    mockInvApi.get.mockReturnValue(of({
      data: { invitation: { status: 'pending' }, user_exists: false },
    }));
    mockAuthState.isAuthenticated.mockReturnValue(false);

    const fixture = await createComponent();
    fixture.detectChanges();

    expect(fixture.componentInstance.state()).toBe('need_register');
  });

  it('should go to ready when authenticated', async () => {
    mockRoute.snapshot.paramMap.get.mockReturnValue('tok');
    mockInvApi.get.mockReturnValue(of({
      data: { invitation: { status: 'pending' }, user_exists: true },
    }));
    mockAuthState.isAuthenticated.mockReturnValue(true);

    const fixture = await createComponent();
    fixture.detectChanges();

    expect(fixture.componentInstance.state()).toBe('ready');
  });

  // ─── Accept ─────────────────────────────────────────────────────

  it('should accept invitation', async () => {
    mockRoute.snapshot.paramMap.get.mockReturnValue('tok');
    mockInvApi.get.mockReturnValue(of({
      data: { invitation: { status: 'pending' }, user_exists: true },
    }));
    mockAuthState.isAuthenticated.mockReturnValue(true);
    mockInvApi.accept.mockReturnValue(of({}));

    const fixture = await createComponent();
    fixture.detectChanges();

    fixture.componentInstance.accept();
    expect(mockInvApi.accept).toHaveBeenCalledWith('tok');
    expect(fixture.componentInstance.state()).toBe('done');
  });

  it('should show error on accept failure', async () => {
    mockRoute.snapshot.paramMap.get.mockReturnValue('tok');
    mockInvApi.get.mockReturnValue(of({
      data: { invitation: { status: 'pending' }, user_exists: true },
    }));
    mockAuthState.isAuthenticated.mockReturnValue(true);
    mockInvApi.accept.mockReturnValue(throwError(() => ({
      message: 'Already accepted',
    })));

    const fixture = await createComponent();
    fixture.detectChanges();

    fixture.componentInstance.accept();
    expect(fixture.componentInstance.state()).toBe('ready');
    expect(fixture.componentInstance.errorMsg()).toBe('Already accepted');
  });
});
