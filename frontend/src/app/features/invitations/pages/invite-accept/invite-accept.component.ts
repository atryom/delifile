import {
  Component, inject, signal, computed, OnInit, ChangeDetectionStrategy,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { InvitationsApiService, InvitationInfo } from '../../../../core/api/invitations-api.service';
import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { ApiError } from '../../../../shared/models/api.models';

type PageState =
  | 'loading'
  | 'not_found'
  | 'expired'
  | 'accepted'
  | 'need_login'
  | 'need_register'
  | 'ready'
  | 'accepting'
  | 'done'
  | 'error';

@Component({
  selector: 'app-invite-accept',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule, RouterLink],
  template: `
    <div class="invite-page">
      <div class="invite-card">

        <div class="invite-header">
          <span class="invite-logo"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
                                         fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                         stroke-linejoin="round"
                                         class="lucide lucide-file-symlink-icon lucide-file-symlink"><path
            d="M4 11V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h7"/><path
            d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="m10 18 3-3-3-3"/></svg></span>
          <h1>DeliFile</h1>
        </div>

        @switch (state()) {

          @case ('loading') {
            <p class="info-text">{{ 'invite.loading' | translate }}</p>
          }
          @case ('not_found') {
            <div class="state-block">
              <span class="state-icon">❌</span>
              <h2>{{ 'invite.not_found' | translate }}</h2>
              <p>{{ 'invite.not_found_desc' | translate }}</p>
              <a routerLink="/login" class="btn-primary">{{ 'invite.go_login' | translate }}</a>
            </div>
          }
          @case ('expired') {
            <div class="state-block">
              <span class="state-icon">⏰</span>
              <h2>{{ 'invite.expired' | translate }}</h2>
              <p>{{ 'invite.expired_desc' | translate }}</p>
            </div>
          }
          @case ('accepted') {
            <div class="state-block">
              <span class="state-icon">✅</span>
              <h2>{{ 'invite.already_accepted' | translate }}</h2>
            </div>
          }
          @case ('need_login') {
            <div class="state-block">
              <span class="state-icon">🔑</span>
              <h2>{{ 'invite.need_login_title' | translate }}</h2>
              <p>
                {{ 'invite.sender' | translate }} <strong>{{ info()?.sender?.name }}</strong>
                {{ 'invite.invited_you' | translate }}
              </p>
              @if (info()?.invitation?.file_id) {
                <p class="small-note">{{ 'invite.has_file' | translate }}</p>
              }
              <a [routerLink]="['/login']" [queryParams]="{ invite: token() }" class="btn-primary btn-full">
                {{ 'invite.login_btn' | translate }}
              </a>
              <a [routerLink]="['/register']" [queryParams]="{ invite: token(), email: info()?.target_email }"
                 class="btn-secondary btn-full">
                {{ 'invite.register_instead' | translate }}
              </a>
            </div>
          }
          @case ('need_register') {
            <div class="state-block">
              <span class="state-icon">👋</span>
              <h2>{{ 'invite.need_register_title' | translate }}</h2>
              <p>
                {{ 'invite.sender' | translate }} <strong>{{ info()?.sender?.name }}</strong>
                {{ 'invite.invited_you' | translate }}
              </p>
              <a
                [routerLink]="['/register']"
                [queryParams]="{ invite: token(), email: info()?.target_email }"
                class="btn-primary btn-full"
              >
                {{ 'invite.register_btn' | translate }}
              </a>
              <a [routerLink]="['/login']" [queryParams]="{ invite: token() }" class="btn-secondary btn-full">
                {{ 'invite.have_account' | translate }}
              </a>
            </div>
          }
          @case ('ready') {
            <div class="state-block">
              <span class="state-icon">🎉</span>
              <h2>{{ 'invite.ready_title' | translate }}</h2>
              <p>
                {{ 'invite.sender' | translate }} <strong>{{ info()?.sender?.name }}</strong>
                {{ 'invite.invited_you' | translate }}
              </p>
              @if (info()?.invitation?.file_id) {
                <p class="small-note">{{ 'invite.has_file' | translate }}</p>
              }
              @if (errorMsg()) {
                <div class="alert-error">{{ errorMsg() }}</div>
              }
              <button class="btn-primary btn-full" (click)="accept()" [disabled]="state() === 'accepting'">
                {{ 'invite.accept_btn' | translate }}
              </button>
            </div>
          }
          @case ('accepting') {
            <p class="info-text">{{ 'invite.accepting' | translate }}</p>
          }
          @case ('done') {
            <div class="state-block">
              <span class="state-icon">✅</span>
              <h2>{{ 'invite.done_title' | translate }}</h2>
              <a routerLink="/files" class="btn-primary">{{ 'invite.go_files' | translate }}</a>
            </div>
          }
          @case ('error') {
            <div class="state-block">
              <span class="state-icon">⚠️</span>
              <h2>{{ 'invite.error' | translate }}</h2>
              <p>{{ errorMsg() }}</p>
              <a routerLink="/files" class="btn-primary">{{ 'invite.go_files' | translate }}</a>
            </div>
          }

        }

      </div>
    </div>
  `,
  styles: [`
    .invite-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f9fafb;
      padding: 24px;
    }
    .invite-card {
      background: #fff;
      border-radius: 16px;
      max-width: 440px;
      width: 100%;
      padding: 40px 36px;
      box-shadow: 0 2px 16px rgba(0,0,0,.08);
    }
    .invite-header {
      text-align: center;
      margin-bottom: 28px;
    }
    .invite-logo { font-size: 2.5rem; }
    .invite-header h1 {
      font-size: 1.5rem; font-weight: 800; margin: 4px 0 0; color: #111;
    }
    .state-block { text-align: center; }
    .state-icon { font-size: 2.8rem; display: block; margin-bottom: 12px; }
    h2 { font-size: 1.2rem; font-weight: 700; margin: 0 0 12px; color: #111; }
    p { color: #374151; font-size: 0.95rem; line-height: 1.6; margin: 0 0 16px; }
    .small-note { font-size: 0.82rem; color: #6b7280; }
    .info-text { text-align: center; color: #6b7280; }
    .btn-primary {
      display: block; width: 100%; text-align: center; background: #6366f1; color: #fff;
      text-decoration: none; font-weight: 600; font-size: 0.97rem;
      padding: 13px 0; border-radius: 8px; border: none; cursor: pointer;
      margin-top: 12px; box-sizing: border-box;
    }
    .btn-primary:hover { background: #4f46e5; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-secondary {
      display: block; width: 100%; text-align: center; background: #f3f4f6;
      color: #374151; text-decoration: none; font-weight: 500; font-size: 0.92rem;
      padding: 12px 0; border-radius: 8px; border: 1px solid #d1d5db; cursor: pointer;
      margin-top: 10px; box-sizing: border-box;
    }
    .btn-secondary:hover { background: #e5e7eb; }
    .btn-full { width: 100%; }
    .alert-error {
      background: #fef2f2; border: 1px solid #fca5a5; color: #dc2626;
      border-radius: 6px; padding: 10px 14px; font-size: 0.88rem; margin-bottom: 12px;
    }
  `],
})
export class InviteAcceptComponent implements OnInit {
  private readonly route      = inject(ActivatedRoute);
  private readonly router     = inject(Router);
  private readonly invApi     = inject(InvitationsApiService);
  private readonly authState  = inject(AuthStateService);

  readonly token    = signal<string>('');
  readonly state    = signal<PageState>('loading');
  readonly info     = signal<InvitationInfo | null>(null);
  readonly errorMsg = signal<string | null>(null);

  ngOnInit(): void {
    const t = this.route.snapshot.paramMap.get('token') ?? '';
    this.token.set(t);
    this.loadInvitation(t);
  }

  private loadInvitation(token: string): void {
    this.invApi.get(token).subscribe({
      next: (res) => {
        this.info.set(res.data);
        const inv = res.data.invitation;

        if (inv.status === 'expired') { this.state.set('expired'); return; }
        if (inv.status === 'accepted') { this.state.set('accepted'); return; }
        if (inv.status !== 'pending') { this.state.set('error'); return; }

        // Determine next step
        if (!this.authState.isAuthenticated()) {
          // Not logged in
          this.state.set(res.data.user_exists ? 'need_login' : 'need_register');
        } else {
          this.state.set('ready');
        }
      },
      error: () => this.state.set('not_found'),
    });
  }

  accept(): void {
    this.state.set('accepting');
    this.errorMsg.set(null);

    this.invApi.accept(this.token()).subscribe({
      next: () => this.state.set('done'),
      error: (err: ApiError) => {
        this.state.set('ready');
        this.errorMsg.set(err.message ?? 'Ошибка принятия приглашения');
      },
    });
  }
}
