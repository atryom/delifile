# Тестирование Frontend (Angular 21)

## Быстрый старт

```bash
# Установка зависимостей
npm install

# Запуск всех тестов (Vitest)
npm test

# Запуск в watch-режиме
npm run test:watch

# Запуск с UI
npx vitest --ui
```

## Конфигурация

- **vitest.config.ts** — основная конфигурация Vitest (v3.2.4, happy-dom, @analogjs/vite-plugin-angular)
- **tsconfig.spec.json** — TypeScript конфиг для тестов
- **src/test-setup.ts** — инициализация Angular TestBed (zone.js patching)

## Структура тестов

```
src/app/
├── app.spec.ts                                              (1 тест)
├── core/
│   ├── api/
│   │   ├── api.service.spec.ts                              (7 тестов)
│   │   ├── admin-api.service.spec.ts                        (8 тестов)
│   │   ├── auth-api.service.spec.ts                         (7 тестов)
│   │   ├── comments-api.service.spec.ts                     (11 тестов)
│   │   ├── files-api.service.spec.ts                        (14 тестов)
│   │   ├── inbox-api.service.spec.ts                        (7 тестов)
│   │   ├── invitations-api.service.spec.ts                  (5 тестов)
│   │   ├── organization-api.service.spec.ts                 (6 тестов)
│   │   ├── shared-folders-api.service.spec.ts               (6 тестов)
│   │   ├── support-api.service.spec.ts                      (5 тестов)
│   │   ├── tariff-api.service.spec.ts                       (3 теста)
│   │   ├── url-files-api.service.spec.ts                    (2 теста)
│   │   └── user-settings-api.service.spec.ts                (4 теста)
│   ├── auth/
│   │   └── auth-state.service.spec.ts                       (10 тестов)
│   ├── guards/
│   │   ├── auth.guard.spec.ts                               (3 теста)
│   │   ├── admin.guard.spec.ts                              (3 теста)
│   │   └── guest.guard.spec.ts                              (2 теста)
│   └── interceptors/
│       ├── auth.interceptor.spec.ts                         (3 теста)
│       └── error.interceptor.spec.ts                        (1 тест)
├── features/
│   ├── activity/pages/activity/
│   │   └── activity.component.spec.ts                       (5 тестов)
│   ├── auth/pages/
│   │   ├── account-blocked/account-blocked.component.spec.ts (4 теста)
│   │   ├── forgot-password/forgot-password.component.spec.ts (13 тестов)
│   │   ├── login/login.component.spec.ts                    (10 тестов)
│   │   ├── pin-setup/pin-setup.component.spec.ts            (6 тестов)
│   │   ├── register/register.component.spec.ts              (9 тестов)
│   │   └── reset-password/reset-password.component.spec.ts  (10 тестов)
│   ├── contacts/pages/contacts/
│   │   └── contacts.component.spec.ts                       (7 тестов)
│   ├── files/
│   │   ├── dialogs/create-link/
│   │   │   └── create-link-dialog.component.spec.ts         (8 тестов)
│   │   ├── pages/file-list/
│   │   │   └── file-list.component.spec.ts                  (23 теста)
│   │   └── pages/public-link/
│   │       └── public-link.component.spec.ts                (11 тестов)
│   ├── invitations/pages/invite-accept/
│   │   └── invite-accept.component.spec.ts                  (10 тестов)
│   ├── legal/pages/privacy/
│   │   └── privacy.component.spec.ts                        (2 теста)
│   ├── settings/pages/security/
│   │   └── security.component.spec.ts                       (14 тестов)
│   └── tags/pages/tags-list/
│       └── tags-list.component.spec.ts                      (13 тестов)
└── shared/
    └── components/
        ├── cookie-consent/cookie-consent.component.spec.ts  (3 теста)
        ├── file-type-icon/file-type-icon.component.spec.ts  (6 тестов)
        └── footer/footer.component.spec.ts                  (2 теста)

**Всего: 38 файлов, 263 теста**

## Запуск

```bash
# Все тесты
npx vitest run

# Конкретный файл
npx vitest run src/app/core/api/auth-api.service.spec.ts

# С таймером
npx vitest run --reporter=verbose
```

## Соглашения

1. Все тесты используют `TestBed` для компонентов, `HttpClientTestingController` для API
2. Файлы тестов имеют расширение `.spec.ts`
3. Используем `describe`/`it`/`expect` (глобально доступны из Vitest)
4. Для моков HTTP используем `HttpClientTestingController.expectOne()`
5. Для шпионов используем `vi.fn()` (вместо `jasmine.createSpy`)
6. Для boolean-ассертов используем `toBe(true)`/`toBe(false)` (вместо `toBeTrue()`/`toBeFalse()`)
7. Guard-функции тестируются через `TestBed.runInInjectionContext()`
8. Interceptor-функции тестируются через `provideHttpClient(withInterceptors([...]))`
9. Названия тестов: `should ...` на английском

## Пример теста API сервиса

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AuthApiService } from './auth-api.service';

describe('AuthApiService', () => {
  let service: AuthApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AuthApiService,
      ],
    });
    service = TestBed.inject(AuthApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('should send login request', () => {
    service.login('test@test.com', 'password').subscribe((res) => {
      expect(res.result).toBe('success');
    });

    const req = httpMock.expectOne('/api/v1/auth/login');
    expect(req.request.method).toBe('POST');
    req.flush({ result: 'success', message: 'OK', data: {} });
  });
});
```
