import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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
  imports: [ReactiveFormsModule, TranslateModule],
  templateUrl: './pin-setup.component.html',
  styleUrl: './pin-setup.component.scss',
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
