import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { VersionCheckService } from './core/services/version-check.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

describe('AppComponent', () => {
  const mockVersionCheck = { init: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: VersionCheckService, useValue: mockVersionCheck },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
        { provide: TranslateService, useValue: { instant: (k: string) => k, get: () => of(''), getCurrentLang: () => 'ru', getParsedResult: (key: string) => key, onTranslationChange: { subscribe: () => ({ unsubscribe: () => {} }) }, onLangChange: { subscribe: () => ({ unsubscribe: () => {} }) }, onFallbackLangChange: { subscribe: () => ({ unsubscribe: () => {} }) } } },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should call versionCheck.init on init', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect(mockVersionCheck.init).toHaveBeenCalledTimes(1);
  });
});
