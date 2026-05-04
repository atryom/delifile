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
  templateUrl: './invite-accept.component.html',
  styleUrl: './invite-accept.component.scss',
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
