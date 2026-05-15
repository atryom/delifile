import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { translateInitializer } from './translate.initializer';
import { of } from 'rxjs';

describe('translateInitializer', () => {
  const translateMock = {
    use: vi.fn(() => of('ru')),
    instant: vi.fn(),
    get: vi.fn(),
    getCurrentLang: vi.fn(() => 'ru'),
    getParsedResult: vi.fn(),
    onTranslationChange: { subscribe: () => ({ unsubscribe: () => {} }) },
    onLangChange: { subscribe: () => ({ unsubscribe: () => {} }) },
    onFallbackLangChange: { subscribe: () => ({ unsubscribe: () => {} }) },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: TranslateService, useValue: translateMock },
      ],
    });
  });

  it('should set language to ru', async () => {
    const fn = TestBed.runInInjectionContext(translateInitializer);
    await fn();

    expect(translateMock.use).toHaveBeenCalledWith('ru');
  });
});
