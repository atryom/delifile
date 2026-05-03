import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgIf } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

/**
 * PinSetupComponent
 *
 * Optional screen shown after registration / first login.
 * PIN is a local device convenience only — not a server-side auth mechanism.
 * Per spec: can be skipped, disabled via feature flag.
 */
@Component({
  selector: 'app-pin-setup',
  standalone: true,
  imports: [ReactiveFormsModule, NgIf, TranslateModule],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-header">
          <span class="auth-logo">🔑</span>
          <h1>{{ 'auth.pin_setup.title' | translate }}</h1>
          <p>{{ 'auth.pin_setup.subtitle' | translate }}</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" class="auth-form" novalidate>

          <div class="pin-notice">
            {{ 'auth.pin_setup.hint' | translate }}
          </div>

          <div class="field">
            <label for="pin">{{ 'auth.pin_setup.pin_label' | translate }}</label>
            <input
              id="pin"
              type="password"
              formControlName="pin"
              [placeholder]="'auth.pin_setup.pin_placeholder' | translate"
              inputmode="numeric"
              maxlength="6"
              [class.input-error]="form.get('pin')?.touched && form.get('pin')?.invalid"
            />
            <span class="field-error" *ngIf="form.get('pin')?.touched && form.get('pin')?.invalid">
              {{ 'auth.pin_setup.pin_error' | translate }}
            </span>
          </div>

          <div class="field">
            <label for="pin_confirm">{{ 'auth.pin_setup.confirm_label' | translate }}</label>
            <input
              id="pin_confirm"
              type="password"
              formControlName="pin_confirm"
              [placeholder]="'auth.pin_setup.confirm_placeholder' | translate"
              inputmode="numeric"
              maxlength="6"
              [class.input-error]="form.errors?.['pinMismatch'] && form.get('pin_confirm')?.touched"
            />
            <span class="field-error"
              *ngIf="form.errors?.['pinMismatch'] && form.get('pin_confirm')?.touched">
              {{ 'auth.pin_setup.confirm_error' | translate }}
            </span>
          </div>

          <button type="submit" class="btn-primary btn-full" [disabled]="form.invalid">
            {{ 'auth.pin_setup.submit' | translate }}
          </button>

          <button type="button" class="btn-secondary btn-full" (click)="skip()">
            {{ 'auth.pin_setup.skip' | translate }}
          </button>

        </form>
      </div>
    </div>
  `,
  styles: [`
    @import url('../../../../../styles/auth.shared.css');
    .pin-notice {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 12px 14px;
      font-size: 0.82rem;
      color: #92400e;
      margin-bottom: 4px;
    }
  `],
})
export class PinSetupComponent {
  private readonly fb     = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly form = this.fb.group({
    pin:         ['', [Validators.required, Validators.pattern(/^\d{4,6}$/)]],
    pin_confirm: ['', [Validators.required]],
  }, {
    validators: (g) => {
      const pin  = g.get('pin')?.value;
      const conf = g.get('pin_confirm')?.value;
      return pin && conf && pin !== conf ? { pinMismatch: true } : null;
    },
  });

  submit(): void {
    if (this.form.invalid) return;
    // In MVP: store PIN locally (e.g. hashed in localStorage for device-local check)
    // Not sent to server — per spec PIN is NOT a backend-auth mechanism
    const pin = this.form.getRawValue().pin!;
    const pinHash = btoa(pin); // naive local storage — production would use crypto
    localStorage.setItem('fs_device_pin', pinHash);
    this.router.navigate(['/files']);
  }

  skip(): void {
    this.router.navigate(['/files']);
  }
}
