import { Component, inject, signal, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthApiService } from '../../../../core/api/auth-api.service';
import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { UserSettingsApiService } from '../../../../core/api/user-settings-api.service';
import { LockPassApiService, ProjectQR } from '../../../../core/api/lockpass-api.service';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { DeviceSession, ContactRequestItem } from '../../../../shared/models/api.models';

@Component({
  selector: 'app-security',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, ReactiveFormsModule, TranslateModule],
  templateUrl: './security.component.html',
  styleUrl: './security.component.scss',
})
export class SecurityComponent implements OnInit, OnDestroy {
  private readonly authApi        = inject(AuthApiService);
  readonly authState              = inject(AuthStateService);
  private readonly fb             = inject(FormBuilder);
  private readonly router         = inject(Router);
  private readonly translate      = inject(TranslateService);
  private readonly settingsApi    = inject(UserSettingsApiService);
  private readonly lockPassApi    = inject(LockPassApiService);
  readonly notifService           = inject(NotificationService);

  // 2FA
  readonly twoFaQR        = signal<ProjectQR | null>(null);
  readonly loadingQR      = signal(false);
  readonly twoFaEnabling  = signal(false);
  readonly twoFaDisabling = signal(false);
  readonly showAppInfo    = signal(false);
  readonly twoFaPolling   = signal(false);

  private twoFaTempToken: string | null  = null;
  private connectPollSub: Subscription | null = null;

  toggleAppInfo(): void {
    this.showAppInfo.update(v => !v);
  }
  readonly twoFaError     = signal<string | null>(null);
  readonly twoFaSuccess   = signal<string | null>(null);
  readonly showQRSection  = signal(false);

  readonly sessions        = signal<DeviceSession[]>([]);
  readonly loadingSessions = signal(false);
  readonly changingPwd     = signal(false);
  readonly loggingOutAll   = signal(false);
  readonly pwdError        = signal<string | null>(null);
  readonly pwdSuccess      = signal(false);

  readonly resending       = signal(false);
  readonly resentOk        = signal(false);
  readonly showChangeEmail = signal(false);
  readonly changingEmail   = signal(false);
  readonly emailError      = signal<string | null>(null);
  readonly emailSuccess    = signal(false);

  readonly savingSettings  = signal(false);
  readonly settingsSaved   = signal(false);

  // Notification toggles (mirrored from user state for local editing)
  readonly notificationsEnabled   = signal(true);
  readonly notifyNewFiles               = signal(true);
  readonly notifyFolderShared           = signal(true);
  readonly notifySharedFolderUpdates    = signal(true);
  readonly notifyComments               = signal(true);
  readonly notifyMentions         = signal(true);
  readonly notifySupportReply     = signal(true);
  readonly notifyContactsAdded    = signal(true);
  readonly notifyTaskAssigned     = signal(true);

  // Contact settings
  readonly allowContactsWithout   = signal(true);

  // Privacy
  readonly autoAddReceivedFiles   = signal(true);

  // Contact requests
  readonly contactRequests        = signal<ContactRequestItem[]>([]);
  readonly loadingRequests        = signal(false);

  readonly pwdForm = this.fb.group({
    current_password:      ['', [Validators.required]],
    password:              ['', [Validators.required, Validators.minLength(8)]],
    password_confirmation: ['', [Validators.required]],
  }, {
    validators: (g) => {
      const p = g.get('password')?.value;
      const c = g.get('password_confirmation')?.value;
      return p && c && p !== c ? { mismatch: true } : null;
    },
  });

  readonly emailForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  ngOnInit(): void {
    this.loadSessions();
    this._syncSettingsFromUser();
    this._loadContactRequests();
  }

  private _syncSettingsFromUser(): void {
    const user = this.authState.user();
    if (!user) return;

    // "Global notifications" should reflect ACTUAL browser permission.
    // Even if backend says enabled, the toggle stays OFF when browser hasn't granted permission.
    const browserPermission = ('Notification' in window) ? Notification.permission : 'denied';
    const backendEnabled    = user.notifications_enabled ?? true;
    this.notificationsEnabled.set(browserPermission === 'granted' && backendEnabled);

    // Sub-settings keep their backend-stored state regardless of browser permission
    this.notifyNewFiles.set(user.notify_new_files ?? true);
    this.notifyFolderShared.set(user.notify_folder_shared ?? true);
    this.notifySharedFolderUpdates.set(user.notify_shared_folder_updates ?? true);
    this.notifyComments.set(user.notify_comments ?? true);
    this.notifyMentions.set(user.notify_mentions ?? true);
    this.notifySupportReply.set(user.notify_support_reply ?? true);
    this.notifyContactsAdded.set(user.notify_contacts_added ?? true);
    this.notifyTaskAssigned.set(user.notify_task_assigned ?? true);
    this.allowContactsWithout.set(user.allow_contacts_without_confirmation ?? true);
    this.autoAddReceivedFiles.set(user.auto_add_received_files ?? true);
  }

  private _loadContactRequests(): void {
    this.loadingRequests.set(true);
    this.settingsApi.getContactRequests().subscribe({
      next: res => {
        this.contactRequests.set(res.data.items);
        this.loadingRequests.set(false);
      },
      error: () => this.loadingRequests.set(false),
    });
  }

  loadSessions(): void {
    this.loadingSessions.set(true);
    this.authApi.sessions().subscribe({
      next: (res) => {
        this.sessions.set(res.data.items);
        this.loadingSessions.set(false);
      },
      error: () => this.loadingSessions.set(false),
    });
  }

  resendVerification(): void {
    this.resending.set(true);
    this.authApi.resendVerification().subscribe({
      next: () => {
        this.resending.set(false);
        this.resentOk.set(true);
        setTimeout(() => this.resentOk.set(false), 5000);
      },
      error: () => this.resending.set(false),
    });
  }

  changeEmail(): void {
    if (this.emailForm.invalid || this.changingEmail()) return;
    this.changingEmail.set(true);
    this.emailError.set(null);
    this.emailSuccess.set(false);

    const { email } = this.emailForm.getRawValue();
    this.authApi.changeEmail({ email: email! }).subscribe({
      next: (res) => {
        this.changingEmail.set(false);
        this.authState.updateUser(res.data.user);
        this.emailSuccess.set(true);
        this.emailForm.reset();
        setTimeout(() => {
          this.emailSuccess.set(false);
          this.showChangeEmail.set(false);
        }, 3000);
      },
      error: (err) => {
        this.changingEmail.set(false);
        this.emailError.set(err?.message ?? 'Не удалось сменить email');
      },
    });
  }

  changePassword(): void {
    this.pwdForm.markAllAsTouched();
    if (this.pwdForm.invalid || this.changingPwd()) return;

    this.changingPwd.set(true);
    this.pwdError.set(null);
    this.pwdSuccess.set(false);

    const { current_password, password, password_confirmation } = this.pwdForm.getRawValue();

    this.authApi.changePassword({
      current_password: current_password!,
      password: password!,
      password_confirmation: password_confirmation!,
    }).subscribe({
      next: () => {
        this.changingPwd.set(false);
        this.pwdSuccess.set(true);
        this.pwdForm.reset();
        setTimeout(() => this.pwdSuccess.set(false), 5000);
      },
      error: (err) => {
        this.changingPwd.set(false);
        this.pwdError.set(err?.message ?? this.translate.instant('security.password.error'));
      },
    });
  }

  deleteSession(session: DeviceSession): void {
    this.authApi.deleteSession(session.id).subscribe(() => {
      this.sessions.update((ss) => ss.filter((s) => s.id !== session.id));
    });
  }

  logoutAll(): void {
    if (!confirm(this.translate.instant('security.sessions.logout_all_confirm'))) return;
    this.loggingOutAll.set(true);
    this.authApi.logoutAll().subscribe({
      next: () => {
        this.authState.clearUser();
        this.router.navigate(['/login']);
      },
      error: () => this.loggingOutAll.set(false),
    });
  }

  async toggleGlobalNotifications(enabled: boolean): Promise<void> {
    if (enabled) {
      const perm = this.notifService.permission();
      if (perm !== 'granted') {
        // Must request browser permission — only enable toggle if browser grants it
        const result = await this.notifService.requestPermission();
        if (result !== 'granted') {
          // Browser denied or dismissed — do not enable
          return;
        }
      }
    }
    this.notificationsEnabled.set(enabled);
    this._saveSettings();
  }

  toggleNotifyNewFiles(value: boolean): void {
    this.notifyNewFiles.set(value);
    this._saveSettings();
  }

  toggleNotifyFolderShared(value: boolean): void {
    this.notifyFolderShared.set(value);
    this._saveSettings();
  }

  toggleNotifySharedFolderUpdates(value: boolean): void {
    this.notifySharedFolderUpdates.set(value);
    this._saveSettings();
  }

  toggleNotifyComments(value: boolean): void {
    this.notifyComments.set(value);
    this._saveSettings();
  }

  toggleNotifyMentions(value: boolean): void {
    this.notifyMentions.set(value);
    this._saveSettings();
  }

  toggleNotifySupportReply(value: boolean): void {
    this.notifySupportReply.set(value);
    this._saveSettings();
  }

  toggleNotifyContacts(value: boolean): void {
    this.notifyContactsAdded.set(value);
    this._saveSettings();
  }

  toggleNotifyTaskAssigned(value: boolean): void {
    this.notifyTaskAssigned.set(value);
    this._saveSettings();
  }

  toggleAllowContacts(value: boolean): void {
    this.allowContactsWithout.set(value);
    this._saveSettings();
  }

  toggleAutoAddReceivedFiles(value: boolean): void {
    this.autoAddReceivedFiles.set(value);
    this._saveSettings();
  }

  private _saveSettings(): void {
    if (this.savingSettings()) return;
    this.savingSettings.set(true);
    this.settingsApi.updateSettings({
      notifications_enabled:               this.notificationsEnabled(),
      notify_new_files:                    this.notifyNewFiles(),
      notify_folder_shared:                this.notifyFolderShared(),
      notify_shared_folder_updates:        this.notifySharedFolderUpdates(),
      notify_comments:                     this.notifyComments(),
      notify_mentions:                     this.notifyMentions(),
      notify_support_reply:                this.notifySupportReply(),
      notify_contacts_added:               this.notifyContactsAdded(),
      notify_task_assigned:                this.notifyTaskAssigned(),
      allow_contacts_without_confirmation: this.allowContactsWithout(),
      auto_add_received_files:             this.autoAddReceivedFiles(),
    }).subscribe({
      next: res => {
        this.savingSettings.set(false);
        this.authState.updateUser(res.data.user);
        this.settingsSaved.set(true);
        setTimeout(() => this.settingsSaved.set(false), 2000);
      },
      error: () => this.savingSettings.set(false),
    });
  }

  acceptContactRequest(id: string): void {
    this.settingsApi.acceptContactRequest(id).subscribe(() => {
      this.contactRequests.update(rs => rs.filter(r => r.id !== id));
    });
  }

  rejectContactRequest(id: string): void {
    this.settingsApi.rejectContactRequest(id).subscribe(() => {
      this.contactRequests.update(rs => rs.filter(r => r.id !== id));
    });
  }

  // ─── 2FA ─────────────────────────────────────────────────────────────────

  qrImageUrl(payload: string): string {
    return 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(payload);
  }

  loadQR(): void {
    if (this.twoFaQR() && this.twoFaTempToken) {
      this.showQRSection.set(true);
      this.startConnectPolling();
      return;
    }
    this.loadingQR.set(true);
    this.twoFaError.set(null);
    this.lockPassApi.initConnect().subscribe({
      next: (res) => {
        this.twoFaQR.set({
          qr_payload: res.data.qr_payload,
          deep_link:  res.data.deep_link,
          app_store:  '',
          ru_store:   '',
        });
        this.twoFaTempToken = res.data.temp_token;
        this.showQRSection.set(true);
        this.loadingQR.set(false);
        this.startConnectPolling();
      },
      error: () => {
        this.twoFaError.set('Не удалось загрузить QR-код. Попробуйте позже.');
        this.loadingQR.set(false);
      },
    });
  }

  private startConnectPolling(): void {
    this.stopConnectPolling();
    const tempToken = this.twoFaTempToken;
    if (!tempToken) return;
    this.twoFaPolling.set(true);
    this.connectPollSub = interval(2000).pipe(
      switchMap(() => this.lockPassApi.pollConnect(tempToken)),
      takeWhile((res) => res.data.status !== 'connected', true),
    ).subscribe({
      next: (res) => {
        if (res.data.status === 'connected' && res.data.user) {
          this.authState.updateUser(res.data.user);
          this.twoFaSuccess.set('2FA успешно включена.');
          this.showQRSection.set(false);
          this.twoFaQR.set(null);
          this.twoFaTempToken = null;
          this.twoFaPolling.set(false);
        }
      },
      error: () => {
        this.twoFaError.set('Ошибка при ожидании подключения. Попробуйте снова.');
        this.twoFaPolling.set(false);
      },
      complete: () => this.twoFaPolling.set(false),
    });
  }

  private stopConnectPolling(): void {
    this.connectPollSub?.unsubscribe();
    this.connectPollSub = null;
  }

  ngOnDestroy(): void {
    this.stopConnectPolling();
  }

  disableTwoFa(): void {
    this.twoFaDisabling.set(true);
    this.twoFaError.set(null);
    this.twoFaSuccess.set(null);
    this.lockPassApi.disable().subscribe({
      next: (res) => {
        this.authState.updateUser(res.data.user);
        this.twoFaSuccess.set('2FA отключена.');
        this.twoFaDisabling.set(false);
      },
      error: () => {
        this.twoFaError.set('Не удалось отключить 2FA.');
        this.twoFaDisabling.set(false);
      },
    });
  }

}
