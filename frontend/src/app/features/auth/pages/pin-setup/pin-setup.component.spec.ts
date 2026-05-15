import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { PinSetupComponent } from './pin-setup.component';

describe('PinSetupComponent', () => {
  const mockRouter = { navigate: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [PinSetupComponent],
      providers: [
        provideTranslateService(),
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(PinSetupComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should validate pin as 4-6 digits', () => {
    const fixture = TestBed.createComponent(PinSetupComponent);
    const pin = fixture.componentInstance.form.get('pin');
    pin?.setValue('123');
    expect(pin?.errors?.['pattern']).toBeTruthy();
    pin?.setValue('123456');
    expect(pin?.valid).toBe(true);
    pin?.setValue('');
    expect(pin?.errors?.['required']).toBe(true);
  });

  it('should validate pin confirmation match', () => {
    const fixture = TestBed.createComponent(PinSetupComponent);
    fixture.componentInstance.form.setValue({ pin: '1234', pin_confirm: '5678' });
    expect(fixture.componentInstance.form.errors?.['pinMismatch']).toBe(true);
  });

  it('should store pin locally and navigate on submit', () => {
    const fixture = TestBed.createComponent(PinSetupComponent);
    fixture.componentInstance.form.setValue({ pin: '1234', pin_confirm: '1234' });
    fixture.componentInstance.submit();

    expect(localStorage.getItem('fs_device_pin')).toBe(btoa('1234'));
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/files']);
  });

  it('should skip and navigate', () => {
    const fixture = TestBed.createComponent(PinSetupComponent);
    fixture.componentInstance.skip();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/files']);
  });

  it('should not submit invalid form', () => {
    const fixture = TestBed.createComponent(PinSetupComponent);
    fixture.componentInstance.submit();
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });
});
