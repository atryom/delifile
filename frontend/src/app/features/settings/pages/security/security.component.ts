import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthApiService } from '../../../../core/api/auth-api.service';
import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { UserSettingsApiService } from '../../../../core/api/user-settings-api.service';
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
export class SecurityComponent implements OnInit {
  private readonly authApi        = inject(AuthApiService);
  readonly authState              = inject(AuthStateService);
  private readonly fb             = inject(FormBuilder);
  private readonly router         = inject(Router);
  private readonly translate      = inject(TranslateService);
  private readonly settingsApi    = inject(UserSettingsApiService);
  readonly notifService           = inject(NotificationService);

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
  readonly notifyNewFiles         = signal(true);
  readonly notifyFolderShared     = signal(true);
  readonly notifyComments         = signal(true);
  readonly notifyMentions         = signal(true);
  readonly notifySupportReply     = signal(true);
  readonly notifyContactsAdded    = signal(true);

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
    this.notifyComments.set(user.notify_comments ?? true);
    this.notifyMentions.set(user.notify_mentions ?? true);
    this.notifySupportReply.set(user.notify_support_reply ?? true);
    this.notifyContactsAdded.set(user.notify_contacts_added ?? true);
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
      notify_comments:                     this.notifyComments(),
      notify_mentions:                     this.notifyMentions(),
      notify_support_reply:                this.notifySupportReply(),
      notify_contacts_added:               this.notifyContactsAdded(),
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

}
