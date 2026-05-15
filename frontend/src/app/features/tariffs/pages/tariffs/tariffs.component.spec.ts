import { TestBed } from '@angular/core/testing';
import { TariffsComponent } from './tariffs.component';
import { TariffApiService } from '../../../../core/api/tariff-api.service';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

describe('TariffsComponent', () => {
  const mockTariffApi = {
    getUsage: vi.fn(() => of({
      result: 'success',
      message: 'OK',
      data: {
        storage_used_bytes: 1048576,
        storage_limit_bytes: 1073741824,
        device_count: 2,
        device_limit: 5,
        max_file_size_bytes: 1048576,
        file_size_limit_bytes: 52428800,
      },
    })),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [TariffsComponent],
      providers: [
        { provide: TariffApiService, useValue: mockTariffApi },
        { provide: TranslateService, useValue: { instant: (k: string) => k, get: () => of(''), getCurrentLang: () => 'ru', getParsedResult: (key: string) => key, onTranslationChange: { subscribe: () => ({ unsubscribe: () => {} }) }, onLangChange: { subscribe: () => ({ unsubscribe: () => {} }) }, onFallbackLangChange: { subscribe: () => ({ unsubscribe: () => {} }) } } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
      ],
    }).compileComponents();
  });

  it('should create and load usage', () => {
    const fixture = TestBed.createComponent(TariffsComponent);
    expect(fixture.componentInstance).toBeTruthy();
    expect(mockTariffApi.getUsage).toHaveBeenCalledTimes(1);
  });

  it('should compute storage percent', () => {
    const fixture = TestBed.createComponent(TariffsComponent);
    expect(fixture.componentInstance.storagePercent()).toBe(0);
  });

  it('should format bytes', () => {
    const fixture = TestBed.createComponent(TariffsComponent);
    expect(fixture.componentInstance.formatBytes(0)).toBe('0 МБ');
    expect(fixture.componentInstance.formatBytes(1048576)).toContain('МБ');
    expect(fixture.componentInstance.formatBytes(1073741824)).toContain('ГБ');
  });
});
