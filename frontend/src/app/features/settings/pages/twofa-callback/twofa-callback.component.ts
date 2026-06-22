import { Component, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LockPassApiService } from '../../../../core/api/lockpass-api.service';
import { AuthStateService } from '../../../../core/auth/auth-state.service';

@Component({
  selector: 'app-twofa-callback',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:16px;padding:24px">
      @if (state() === 'loading') {
        <div class="spinner"></div>
        <p>Привязываем аккаунт LockPass…</p>
      }
      @if (state() === 'success') {
        <p style="color:#22c55e;font-size:1.1rem">✓ 2FA успешно подключена!</p>
        <p style="color:#64748b">Перенаправляем в настройки…</p>
      }
      @if (state() === 'error') {
        <p style="color:#ef4444">Не удалось подключить 2FA: {{ errorMsg() }}</p>
        <a href="/settings/security" style="color:#6366f1">Вернуться в настройки</a>
      }
    </div>
  `,
  styles: [`.spinner{width:36px;height:36px;border:3px solid #e2e8f0;border-top-color:#6366f1;border-radius:50%;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`],
})
export class TwoFaCallbackComponent implements OnInit {
  private readonly route     = inject(ActivatedRoute);
  private readonly router    = inject(Router);
  private readonly lockPass  = inject(LockPassApiService);
  private readonly authState = inject(AuthStateService);

  readonly state    = signal<'loading' | 'success' | 'error'>('loading');
  readonly errorMsg = signal<string | null>(null);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.queryParamMap.get('lockpass_user_id'));

    if (!id) {
      this.state.set('error');
      this.errorMsg.set('Отсутствует lockpass_user_id в URL');
      return;
    }

    this.lockPass.enable(id).subscribe({
      next: (res) => {
        this.authState.updateUser(res.data.user);
        this.state.set('success');
        setTimeout(() => this.router.navigate(['/settings/security']), 1500);
      },
      error: (err) => {
        this.state.set('error');
        this.errorMsg.set(err?.message ?? 'Неизвестная ошибка');
      },
    });
  }
}
