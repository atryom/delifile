import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { CookieConsentComponent } from './cookie-consent.component';

describe('CookieConsentComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [CookieConsentComponent],
      providers: [
        provideTranslateService(),
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
      ],
    }).compileComponents();
  });

  it('should create and be visible when no consent stored', () => {
    const fixture = TestBed.createComponent(CookieConsentComponent);
    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.componentInstance.visible()).toBe(true);
  });

  it('should be hidden when consent already stored', async () => {
    localStorage.setItem('cookie_consent', '1');
    await TestBed.configureTestingModule({
      imports: [CookieConsentComponent],
      providers: [
        provideTranslateService(),
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CookieConsentComponent);
    expect(fixture.componentInstance.visible()).toBe(false);
  });

  it('should hide on accept and store consent', () => {
    const fixture = TestBed.createComponent(CookieConsentComponent);
    expect(fixture.componentInstance.visible()).toBe(true);

    fixture.componentInstance.accept();
    expect(fixture.componentInstance.visible()).toBe(false);
    expect(localStorage.getItem('cookie_consent')).toBe('1');
  });
});
