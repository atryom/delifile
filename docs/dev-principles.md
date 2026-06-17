# Принципы разработки DeliFile

Документ описывает архитектурные принципы и конвенции, принятые в проекте DeliFile.
Цель — переносимость на новые проекты без потери знаний.

---

## 1. Общая архитектура проекта

Проектор состоит из трёх независимых приложений, разделяющих один REST API:

```
delifile/
├── backend/      # Laravel 13 (PHP 8.3) — API-сервер
├── frontend/     # Angular 21 SPA — web-клиент
└── mobile/       # Expo SDK 54 (React Native 0.81) — мобильное приложение
```

- Каждое приложение — отдельный `package.json` / `composer.json` со своими зависимостями.
- Web и мобильный клиент общаются с backend исключительно через REST API (`/api/v1/*`).
- Frontend и backend развёрнуты на одном домене (`delifile.ru`), Separate-проекты на одном сервере.
- Мобильное приложение подключается к `https://delifile.ru/api/v1` (fallback в `EXPO_PUBLIC_API_URL`).

---

## 2. Backend (Laravel 13 / PHP 8.3)

### 2.1. Структура

```
backend/app/
├── Http/Controllers/    # 17 доменов (Auth, Files, Contacts, Admin, SharedFolders, …)
├── Http/Middleware/      # SuperUserMiddleware + стандартные
├── Http/Requests/       # FormRequest (только для критичных точек входа)
├── Http/Traits/         # ApiResponseTrait — единый формат ответов
├── Services/            # 16 сервисов — бизнес-логика
├── Models/              # 39 Eloquent-моделей
├── Enums/               # 11 backed string enum'ов
├── Jobs/                # 5 очередных задач
├── Mail/                # 4 Mailable-класса
├── Console/Commands/    # 7 Artisan-команд
└── Exceptions/           # Кастомный Handler (JSON-ответы)
```

### 2.2. Принципы

| Принцип | Реализация |
|---------|-----------|
| **Архитектура** | Controller → Service → Model. Контроллеры тонкие, бизнес-логика в сервисах |
| **API-ответы** | Единый формат `{result, message, data}` через `ApiResponseTrait`. Успех: `result: "success"`, данные в `data`. Ошибка: `result: "error"`, код и детали в `data: {code, errors}` |
| **Первичные ключи** | ULID (через `HasUlids`) в большинстве моделей (22 из 39). Bigint — в сводных таблицах и моделях без ULID |
| **Soft Deletes** | Минимально — только `File` (остальное физическое удаление) |
| **Enum** | PHP 8.1 backed string enums, кастуются через `casts()` в моделях. Хранятся в БД как строки, не как int |
| **Авторизация** | Manual ownership checks (`where('owner_id', $user->id)`, `$model->isOwnedBy()`), middleware `auth:sanctum` + `SuperUserMiddleware`. Политики (Policy) не используются |
| **Валидация** | Гибридная: `FormRequest` для register/login/upload, `$request->validate()` для остальных эндпоинтов |
| **Аутентификация** | Laravel Sanctum (`HasApiTokens`), токен в `Bearer` header, управление сессиями через `DeviceSession` |
| **Хранилище файлов** | S3 (default disk), `visibility: private`, presigned URL через `S3UrlService` |
| **Очереди** | `database` driver (таблица `jobs`), 5 Job-классов |
| **Версионирование API** | Явный префикс `/api/v1/` через `Route::prefix` |
| **Middleware** | `auth:sanctum` (защищённые роуты), `SuperUserMiddleware` (admin), `throttle:api` и `throttle:auth` (rate limiting), `HandleCors` |
| **Ошибки** | Централизованный `Handler` рендерит все исключения в JSON `{result, message, data}` |

---

## 3. Frontend (Angular 21)

### 3.1. Структура

```
frontend/src/app/
├── core/
│   ├── api/            # ApiService (базовый) + 17 доменных API-сервисов
│   ├── auth/           # AuthStateService (signals) + auth.initializer
│   ├── guards/         # authGuard, guestGuard, adminGuard (functional)
│   ├── i18n/           # translate.initializer (@ngx-translate, fallback 'ru')
│   ├── interceptors/   # auth.interceptor (Bearer), error.interceptor
│   ├── layout/         # AppLayoutComponent (shell + sidebar)
│   ├── notifications/  # NotificationService + PushService
│   └── services/       # ThemeService, DeviceService, PwaInstallService, VersionCheckService
├── features/           # 17 бизнес-модулей (auth, files, folders, contacts, inbox, …)
└── shared/
    ├── components/     # cookie-consent, file-type-icon, footer, notification-banner, thread-comments
    ├── constants/      # limits.ts (PLAN_FILE_LIMITS)
    ├── models/         # api.models.ts — все TypeScript-интерфейсы (единственный файл)
    └── utils/          # file.ts, format.ts, tree.ts
```

### 3.2. Принципы

| Принцип | Реализация |
|---------|-----------|
| **Компоненты** | Все standalone, без NgModules |
| **Структура** | Feature-based: `core/` (инфра), `features/` (бизнес), `shared/` (реюз) |
| **State** | Angular Signals (`signal`, `computed`). Никакого NgRx/NGXS |
| **Роутинг** | Ленивая загрузка через `loadComponent` для всех маршрутных компонентов. `withComponentInputBinding()` + `withViewTransitions()` |
| **Guards** | Functional (`CanActivateFn`), не классовые |
| **Interceptors** | Functional (`HttpInterceptorFn`), не классовые |
| **HTTP** | `withFetch()` (fetch API вместо XHR). Базовый `ApiService` с типизированными методами, все наследники — доменные сервисы |
| **API-контракт** | `ApiResponse<T>` = `{result: 'success'\|'error', message, data: T}` — зеркалит backend |
| **Токен** | JWT в `localStorage` (с «Запомнить») или `sessionStorage`. Interceptor подставляет `Authorization: Bearer <token>` |
| **401** | Interceptor очищает сессию и редиректит на `/login` |
| **i18n** | `@ngx-translate` с JSON-словарями `ru.json` (741 строка) + `en.json` (711 строк). Версионирование через query `?v=__BUILD_HASH__` |
| **Стили** | SCSS, CSS Custom Properties для тем (light/dark). Переменные в `_variables.scss`, тема в `_theme.scss` |
| **PWA** | Manifest, Service Worker, Web Push, share-target |
| **Окружения** | `environment.ts` (dev) и `environment.production.ts` — оба с `apiUrl: '/api/v1'`. Production активируется через `fileReplacements` в `angular.json` |

---

## 4. Mobile (Expo SDK 54 / React Native 0.81)

### 4.1. Структура

```
mobile/
├── app/                    # Expo Router (file-based routing)
│   ├── _layout.tsx         # Root: QueryClient, fonts, NetworkStore, ShareIntent
│   ├── index.tsx           # Redirect по auth
│   ├── share.tsx           # Share Intent processing
│   ├── (auth)/             # Login, Register, Forgot/Reset password
│   └── (app)/             # Bottom Tabs: Files, Connections, Settings, Profile
│       ├── files/          # File list, detail, view, edit, PDF, comments, shared-folders
│       ├── connections/    # Inbox + Contacts + File Requests
│       ├── settings/      # Tags, Notifications, Security, Support
│       └── profile/       # User profile
├── src/
│   ├── api/               # Axios клиент + 14 доменных API-модулей
│   ├── hooks/             # React Query hooks (useQuery/useMutation)
│   ├── store/             # Zustand: authStore, networkStore
│   ├── types/             # TypeScript-интерфейсы (11 доменных + index.ts + assets.d.ts)
│   ├── utils/             # format.ts, device.ts, file.ts, errors.ts
│   ├── components/        # UI-компоненты: Button, Input, Spinner, DatePickerModal, Gallery*, MovieCard
│   └── native/            # shareIntent.ts — мост к iOS/Android нативным модулям
├── plugins/               # Expo Config Plugins
│   ├── withShareExtension.js      # iOS Share Extension target в Xcode
│   ├── withAndroidShareIntent.js  # onNewIntent в MainActivity
│   ├── withAndroidEditorAsset.js  # Копирует editor.html в assets
│   └── share-extension/           # Шаблоны ShareViewController.swift, Info.plist, entitlements
├── modules/share-intent/           # Expo Module (Android/Kotlin) — чтение Share Intent
└── ios/                    # Xcode-проект (генерируется Expo prebuild)
```

### 4.2. Принципы

| Принцип | Реализация |
|---------|-----------|
| **Навигация** | Expo Router v6 (file-based routing). Группы: `(auth)` — неавторизованные, `(app)` — авторизованные с Bottom Tabs |
| **State** | Zustand для auth и network. React Query для серверного кэша (`retry: 1`, `staleTime: 2 мин`, `gcTime: 24ч`, `networkMode: 'offlineFirst'`) |
| **Персистенция кэша** | `PersistQueryClientProvider` + `createAsyncStoragePersister` (ключ `rq-cache` в AsyncStorage) |
| **API-клиент** | Axios в `src/api/client.ts`. Base URL: `EXPO_PUBLIC_API_URL ?? 'https://delifile.ru/api/v1'`. Timeout: 15 сек. Interceptor подставляет `Authorization: Bearer <token>` из Zustand store |
| **401** | Response interceptor вызывает `clearAuth()` + `router.replace('/(auth)/login')` |
| **Токен** | SecureStore (`auth_token`, `auth_user`) ↔ Zustand `useAuthStore`. При старте: `loadToken()` из SecureStore → Zustand |
| **Нативные модули** | `share-intent` (Expo Module, Kotlin для Android) + `ShareIntentModule.swift` (iOS bridge через NativeModules). Единый интерфейс: `{getSharedData, clearSharedData}` |
| **Share Extension** | iOS: `ShareViewController.swift` → App Group → `delifile://share` deep link. Android: `ShareIntentModule.kt` + `intentFilters` в `app.json` |
| **UUID** | `expo-crypto` (`Crypto.randomUUID()`), не `Math.random()` |
| **Типы** | Строгая типизация в `src/types/`: `ApiResponse<T>`, `Pagination`, `PaginatedData<T>`, доменные типы |
| **Deep link** | Схема `delifile://`. Обработка в `_layout.tsx` через `Linking.getInitialURL()` + `Linking.addEventListener('url')` |
| **Версия** | `app.json` → `expo.version`. `scripts/bump-version.mjs` инкрементирует patch + versionCode + buildNumber |
| **TipTap-редактор** | WebView с инлайн-HTML. Android: `file:///android_asset/editor.html`. iOS: `expo-asset` загружает `editor-inline.html`. Скрипт `build-editor-inline.mjs` инлайнит JS-бандл в HTML (внешний `<script src>` не работает на iOS с `file://`) |
| **Офлайн-режим** | React Query `networkMode: 'offlineFirst'`. Кэш дерева папок и тегов — `staleTime: Infinity`, файлов — `staleTime: 2 мин`, inbox count — `staleTime: 30 с`. `OfflineBanner` при потере сети |
| **Клавиатура на Android** | Во всех формах ввода используется паттерн «абсолютный бар»: панель с `position: 'absolute'` + `bottom: kbHeight`. События `keyboardDidShow` / `keyboardDidHide` (не `Will*` — Android их не генерирует). При закрытии формы: `Keyboard.dismiss()` **перед** сбросом состояния |
| **Генерация иконок** | `scripts/generate-icon.mjs` — SVG→PNG (@resvg/resvg-js). Логотип: синий скруглённый квадрат (`#2563EB`) + белая иконка folder-symlink. Foreground для adaptive-icon: прозрачный фон + белый символ |
| **Офлайн-режим** | React Query `networkMode: 'offlineFirst'`. Кэш дерева папок и тегов — `staleTime: Infinity`, файлов — `staleTime: 2 мин`, inbox count — `staleTime: 30 с`. `OfflineBanner` при потере сети |

---

## 5. Сборка и деплой

### 5.1. Web-деплой (продакшн)

**Триггер:** `git push` в `master` с изменениями в `backend/**` или `frontend/**`.

```
git push → GitHub Actions → self-hosted runner (Linux, прод-сервер)
  → git reset --hard origin/master
  → ./deploy
     ├─ composer install --no-interaction
     ├─ php artisan migrate --force
     ├─ php artisan config/route/view/cache:clear
     ├─ npm ci (frontend)
     ├─ node scripts/bump-version.js
     ├─ npm run build:prod
     └─ cp -r dist/. → public/ (сохраняя public/backend/)
  → supervisorctl restart delifile-worker:
```

**Детали:**
- Раннер: self-hosted Linux на прод-сервере (метка `[self-hosted, Linux]`)
- Деплой «на месте» — `git reset --hard` в рабочем каталоге, а не через `actions/checkout`
- Конкарренция: `web-deploy` группа, `cancel-in-progress: false` — деплои не пересекаются
- `bump-version.js` не коммитит изменения — на следующем деплое `git reset --hard` их сбрасывает
- Workflow: `.github/workflows/deploy.yml`
- Подробности: `docs/github-actions-deploy.md`

### 5.2. Сборка APK (Android)

#### Локальная сборка (WSL2) — основной метод

**Зависимости:** JDK 17, Android SDK в `~/android-sdk/`, NDK 27.1 (ставится автоматически при первой сборке), WSL2 минимум 8 ГБ RAM.

**Шаг 1 — Prebuild** (только если менялись `app.json` или нативные модули):
```bash
cd /var/www/delifile/mobile
npx expo prebuild --platform android
```

**Шаг 2 — Сборка APK:**
```bash
cd /var/www/delifile/mobile/android
GRADLE_OPTS="-Xmx1200m -XX:MaxMetaspaceSize=256m" \
  ./gradlew assembleRelease --no-daemon --max-workers=1 -Dorg.gradle.parallel=false
```

Выход: `android/app/build/outputs/apk/release/app-release.apk`

Debug-сборка (для тестирования):
```bash
./gradlew assembleDebug --no-daemon --max-workers=1
```

**Важно:** в `android/app/build.gradle` должна быть строка `debuggableVariants = []`. Без неё debug-сборка не бандлит JS и приложение не запустится без Metro-сервера.

**Keystore для подписи release:**
```
Файл:  ~/android-sdk/delifile-release.keystore
Alias: delifile
Pass:  delifile123
```

**Ограничение WSL2:** При 4 ГБ RAM Gradle daemon падает на CMake-компиляции нативного кода. Решение — добавить в `C:\Users\<user>\.wslconfig`:
```ini
[wsl2]
memory=8GB
swap=2GB
```
Затем `wsl --shutdown` в PowerShell.

#### EAS Build (облачная сборка)

```bash
cd mobile
npm ci
eas build --platform android --profile preview    # APK (internal distribution)
eas build --platform android --profile production  # AAB (Google Play)
```

Конфигурация: `mobile/eas.json`.

| Профиль | Тип сборки | Распространение |
|---------|-----------|-----------------|
| `development` | APK | internal |
| `preview` | APK | internal |
| `production` | AAB | Google Play (`track: internal`) |

OTA-обновления (только JS, без пересборки):
```bash
npx eas update --branch preview
```

#### Передача APK в DeliFile

После локальной сборки APK переименовывается и загружается через API в shared folder «Android Builds».

Имя файла: `delifile_<версия>.apk` (версию смотреть в `mobile/app.json` → `expo.version`).

Folder ID: `01kthtznmcakp23njmbv9vabw5`

```bash
DELIFILE_TOKEN="<твой Bearer токен>"
FOLDER_ID="01kthtznmcakp23njmbv9vabw5"
APK_FILE="delifile_1.1.34.apk"
APK_SIZE=$(wc -c < "$APK_FILE" | tr -d ' ')

# Шаг 1 — инициализация
INIT=$(curl -sf -X POST "https://delifile.ru/api/v1/shared-folders/${FOLDER_ID}/init-upload" \
  -H "Authorization: Bearer ${DELIFILE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"original_name\": \"${APK_FILE}\", \"size\": ${APK_SIZE}, \"mime_type\": \"application/vnd.android.package-archive\"}")

FILE_ID=$(echo "$INIT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['file']['id'])")
UPLOAD_URL=$(echo "$INIT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['upload']['url'])")

# Шаг 2 — загрузка в S3
curl -sf -X PUT "$UPLOAD_URL" \
  -H "Content-Type: application/vnd.android.package-archive" \
  --data-binary @"$APK_FILE"

# Шаг 3 — завершение
curl -sf -X POST "https://delifile.ru/api/v1/shared-folders/${FOLDER_ID}/complete-upload" \
  -H "Authorization: Bearer ${DELIFILE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"file_id\": \"${FILE_ID}\"}"
```

### 5.3. Сборка IPA (iOS)

**Триггер:** `git push` в `master` с изменениями в `mobile/**`.

```
git push → GitHub Actions → self-hosted runner (macOS, MacBook)
  → npm ci + npm install -g eas-cli
  → security unlock-keychain + set-key-partition-list (macOS 14 fix)
  → eas build --platform ios --profile production --local (~15–30 мин)
  → eas submit → Apple TestFlight
  → лог → DeliFile API (init-upload → PUT S3 → complete-upload)
```

**Макет MacBook (подробности в `docs/mac-ios-build-setup.md` и `docs/mobile/ios-cicd.md`):**

| Компонент | Значение |
|-----------|---------|
| Runner | MacBook Pro Alina (self-hosted, macOS) |
| Xcode | Последняя версия из App Store |
| EAS CLI | Глобально установленный |
| Keychain | Автоматическая разблокировка через секрет `MAC_KEYCHAIN_PASSWORD` |
| Build number | `github.run_number` (устанавливается перед сборкой в `app.json`) |
| Code signing | Distribution certificate через EAS remote credentials |
| App Store Connect | API Key (`24HF4XV68L`), appId `6776556322` |

**Нестандартные решения iOS:**
1. **Патч keychain.js** — macOS 14 не возвращает идентити при `security find-identity -v`. Workflow патчит все копии `keychain.js` в `~/.npm/_npx/`, убирая флаг `-v`. Если EAS обновился и кэш сбросился — патч применится заново автоматически.
2. **ShareExtension версия** — EAS обновляет version только в основном target. Плагин `withShareExtension.js` синхронизирует `CFBundleShortVersionString` в `Info.plist` ShareExtension. Отдельный `withDangerousMod` не работает — выполняется в LIFO-порядке до `withXcodeProject`, то есть раньше, чем файл создаётся.
3. **EAS keychain auto-lock prevention** — фоновый watcher (`Start EAS keychain auto-lock prevention` шаг в workflow) следит за появлением `eas-build-*.keychain-db` и устанавливает таймаут блокировки 24ч через `security set-keychain-settings -t 86400`. Без этого macOS блокирует keychain через ~15 мин сборки, и `xcodebuild` зависает на codesign с интерактивным диалогом.
4. **Share Extension → Host App** — `ShareViewController.swift` открывает host-приложение через responder chain (`findHostApplication()` — ищет живой `UIApplication` процесса расширения) **до** `completeRequest`. Завершение extension (`complete()`) вызывается только в completion-handler'е `application.open` при `success` — поэтому моргания нет. Если `UIApplication` не найден — fallback на `extensionContext.open`. Если открыть не удалось — подсказка «Откройте DeliFile вручную» с автозакрытием через 2с.
5. **Apple WWDR сертификаты** — шаг «Install Apple WWDR certificates» в workflow скачивает G4, G5, G6 сертификаты и импортирует их в login.keychain, т.к. на чистом macOS они отсутствуют и EAS не может верифицировать code signing.

**Управление runner на Mac:**
```bash
launchctl list | grep actions.runner                    # проверить статус
launchctl stop  com.github.actions.runner.atryom-delifile.MacBook-Pro-Alina
launchctl start com.github.actions.runner.atryom-delifile.MacBook-Pro-Alina
cat ~/actions-runner/_diag/Runner_*.log | tail -50     # логи runner'а
```
Runner запускается автоматически при входе пользователя `alinabel` в систему (LaunchAgent, `LimitLoadToSessionType: Aqua`).

**GitHub Secrets для iOS:**

| Secret | Назначение |
|--------|-----------|
| `EXPO_TOKEN` | Токен Expo для `eas build` и `eas submit` |
| `MAC_KEYCHAIN_PASSWORD` | Пароль от login keychain |
| `ASC_API_KEY_P8_BASE64` | App Store Connect API Key (p8) |
| `ASC_KEY_ID` | App Store Connect Key ID |
| `ASC_ISSUER_ID` | App Store Connect Issuer ID |
| `DELIFILE_TOKEN` | Bearer-токен для загрузки логов в DeliFile |

### 5.4. Версионирование мобильного приложения

**Файл:** `mobile/app.json` → `expo.version`

**Скрипт:** `mobile/scripts/bump-version.mjs` инкрементирует:
- `version` в `app.json`: `1.1.34` → `1.1.35`
- `versionCode` в `android/app/build.gradle`: +1
- `buildNumber` в `app.json` (iOS): +1

Запуск: `npm run bump` (из `mobile/`).

**В CI:** `github.run_number` записывается как `buildNumber` в `app.json` перед iOS-сборкой (изменение не коммитится). В `eas.json` установлено `"appVersionSource": "local"` — EAS читает build number из `app.json`.

### 5.5. Передача файлов в DeliFile через API

Процесс загрузки файлов (используется и для логов, и для APK):

```
Шаг 1: POST /api/v1/shared-folders/{folder_id}/init-upload
        Body: {original_name, size, mime_type}
        → {data: {file: {id}, upload: {url}}}

Шаг 2: PUT {upload_url}  (прямая загрузка в S3)
        Body: бинарное содержимое файла
        Content-Type: соответствующий MIME

Шаг 3: POST /api/v1/shared-folders/{folder_id}/complete-upload
        Body: {file_id}
        → Файл доступен в DeliFile
```

---

## 6. Общие принципы, общие для всех платформ

### 6.1. API-контракт

Все три клиента (web, iOS, Android) работают с единым REST API:

- **Формат ответа:** `{result: "success"|"error", message: string, data: T}`
- **Версионирование:** `/api/v1/*`
- **Аутентификация:** `Authorization: Bearer <token>` (Sanctum)
- **Ошибка 401:** Клиент очищает сессию и перенаправляет на логин
- **Пагинация:** `{page, per_page, total}` → `PaginatedData<T>`

### 6.2. TypeScript-типы (единые конракты)

Типы зеркалируют backend-enum'ы и модели:

| Backend (PHP Enum) | Frontend (TS type) | Mobile (TS type) |
|--------------------|--------------------|------------------|
| `FileStatus` | `FileStatus` (union) | `FileStatus` (union) |
| `AccessType` | `AccessType` (union) | `AccessType` (union) |
| `TariffPlan` | `TariffPlan` (union) | `TariffPlan` (union) |
| `CommentScope` | `CommentScope` (union) | `CommentScope` (union) |
| `ShareLinkStatus` | `ShareLinkStatus` (union) | `ShareLinkStatus` (union) |
| `SharedFolderAccessType` | `SharedFolderAccessType` (union) | `SharedFolderAccessType` (union) |
| `NotificationType` | `NotificationType` (union) | (отсутствует на момент ревью) |

Все enum-значения — **строки**, не числа. Это критично для согласованности между платформами.

### 6.3. Обработка ошибок

- **Backend:** Централизованный `Handler` → JSON. Контроллеры используют `ApiResponseTrait::error()` с кодами: `NOT_FOUND`, `FORBIDDEN`, `UNAUTHORIZED`.
- **Frontend:** `error.interceptor` нормализует HTTP-ошибки в `ApiError`. Компоненты показывают уведомления через `NotificationService`.
- **Mobile:** `src/api/client.ts` — response interceptor при 401 вызывает `clearAuth()` + redirect. Общая утилита `getApiError(e, fallback)` вместо `e.response?.data?.message`.

### 6.4. Файловая загрузка

Все три клиента используют единую схему:

1. `POST /files/init-upload` — получение presigned S3 URL
2. `PUT {presigned_url}` — прямая загрузка в S3 (без авторизации, без base URL)
3. `POST /files/complete-upload` — завершение загрузки, создание записи в БД

На frontend типизированный метод `putExternal(url, body, headers)` в `ApiService` для прямых PUT-запросов в S3.

### 6.5. Deep-linking

- **Схема:** `delifile://`
- **Android:** Зарегистрирована в `app.json` (`intentFilters`), обрабатывается в `MainActivity.onNewIntent`
- **iOS:** Зарегистрирована в Xcode через Expo Config Plugin, обрабатывается через `Linking.getInitialURL()` + `Linking.addEventListener('url')` в корневом `_layout.tsx`
- **Роуты:** `/share` (share intent), `/link/:token` (публичные ссылки), `/invite/:token` (приглашения), `/file-request/:token` (запросы файлов)
- **Share Extension (iOS):** `ShareViewController.swift` → App Group → `delifile://share` → retry-механизм в `_layout.tsx`

### 6.6. Push-уведомления

- **Web:** Web Push (VAPID) через `PushService` + `navigator.serviceWorker`
- **Mobile:** `expo-notifications` + `getDevicePushTokenAsync()` (возвращает нативный FCM/APNs токен)
- **Backend:** `PushNotificationService` + `DevicePushToken` модель + очередь (`SendPushNotification`)

---

## 7. Инфраструктура и DevOps

### 7.1. Окружения

| Файл | Назначение |
|------|-----------|
| `backend/.env` | Локальная разработка |
| `backend/.env.testing` | Тестирование (PHPUnit) |
| `backend/.env.prod` | Продакшн |
| `mobile/.env` | Мобильная разработка |
| `mobile/.env.example` | Шаблон для мобильного окружения |
| `frontend/src/environments/environment.ts` | Dev (`production: false`) |
| `frontend/src/environments/environment.production.ts` | Prod (`production: true`) |

### 7.2. CI/CD

| Workflow | Триггер | Runner | Результат |
|----------|---------|--------|-----------|
| `deploy.yml` | push в `master` + `backend/**` или `frontend/**` | self-hosted Linux (прод) | Деплой web |
| `ios-build.yml` | push в `master` + `mobile/**` | self-hosted macOS (MacBook) | IPA → TestFlight + лог в DeliFile |

### 7.3. Деплой-скрипт `./deploy`

Расположение: корень репозитория. Выполняет:
1. `composer install --no-interaction --prefer-dist --optimize-autoloader`
2. `php artisan migrate --force`
3. Очистка кешей (`config:clear`, `route:clear`, `view:clear`, `cache:clear`)
4. `chmod -R 775 storage/ bootstrap/cache/`
5. `npm ci` (frontend)
6. `node scripts/bump-version.js`
7. `npm run build:prod` (Angular SSR → browser)
8. Копирование `dist/delifile/browser/` → `public/` (с сохранением `public/backend/`)
9. `supervisorctl restart delifile-worker:`

### 7.4. Тестирование

**Backend:**
- PHPUnit 12, Feature-тесты (64 файла, ~9855 строк)
- `composer test` → `php artisan test`
- Unit-тесты — только заглушка

**Frontend:**
- Vitest 4 + jsdom/happy-dom
- `npm run test` / `npm run test:watch`

**Mobile:**
- Нет автоматических тестов (ручное тестирование на устройствах)

---

## 8. Безопасность

| Аспект | Реализация |
|--------|-----------|
| **Аутентификация** | Laravel Sanctum, JWT-токены, управление устройствами (`DeviceSession`) |
| **Авторизация** | Ownership checks в контроллерах/сервисах. `SuperUserMiddleware` для admin. Без Policy-классов |
| **API-токены** | Отдельный `ApiTokenController` для управления личными токенами |
| **Валидация** | FormRequest для критичных точек, `$request->validate()` для остальных |
| **Mass Assignment** | `$fillable` во всех моделях (white-list). `User::$fillable` не содержит `is_superuser` (CRITICAL-фикс из аудита) |
| **CORS** | `HandleCors` middleware ( Sanctum `statefulApi`) |
| **S3** | `visibility: private`, presigned URL с TTL 1 час |
| **Rate Limiting** | `throttle:api` (общий), `throttle:auth` (для регистрации/логина) |

---

## 9. Ключевые технологии

| Компонент | Web | Mobile |
|-----------|-----|--------|
| Framework | Angular 21 | Expo SDK 54 (React Native 0.81) |
| Language | TypeScript 5.9 | TypeScript 5.9 |
| State | Angular Signals | Zustand + React Query |
| HTTP | Angular HttpClient (fetch) | Axios |
| Auth storage | localStorage / sessionStorage | SecureStore (expo-secure-store) |
| Routing | Angular Router (lazy) | Expo Router v6 (file-based) |
| i18n | @ngx-translate (JSON) | Встроенная (строки в компонентах) |
| Styles | SCSS + CSS Custom Properties | StyleSheet (React Native) |
| Push | Web Push (VAPID) | expo-notifications |
| Editor | TipTap (native DOM) | TipTap (WebView inline) |
| Build | Angular CLI → SSR/browser | EAS Build → APK/IPA |
| Tests | Vitest | Нет |

---

## 10. Таблица соответствия сущностей

| Сущность | Backend Model | Frontend Type | Mobile type |
|----------|--------------|---------------|-------------|
| Файл | `File` | `FileListItem`, `FileCard` | `FileListItem`, `FileCard` |
| Пользователь | `User` | `CurrentUser` | `User` |
| Общая папка | `SharedFolder` | `SharedFolder` | `SharedFolder` |
| Контакт | `Contact` | `Contact` | `Contact` |
| Приглашение | `Invitation` | — | — |
| Ссылка доступа | `ShareLink` | `ShareLink` | `ShareLink` |
| Комментарий | `Comment` | `Comment` | `Comment` |
| Задача | `File.task_*` поля | `TaskStatus` | `TaskStatus` |
| Тег | `Tag` | `Tag` | `Tag` |
| Уведомление | `UserNotification` | `NotificationItem` | — |

---

## 11. Структура git-репозитория

```
delifile/                          # Монорепозиторий
├── .github/workflows/
│   ├── deploy.yml                 # Web-деплой (Linux runner)
│   └── ios-build.yml              # iOS сборка (Mac runner)
├── backend/                       # Laravel 13
├── frontend/                      # Angular 21
├── mobile/                        # Expo SDK 54
│   ├── android/                   # Android-проект (генерируется Expo)
│   ├── ios/                       # iOS-проект (генерируется Expo)
│   ├── plugins/                   # Expo Config Plugins
│   ├── modules/share-intent/      # Expo Module (Kotlin)
│   ├── scripts/                   # bump-version, build-editor, generate-icon
│   └── src/                       # Исходный код мобильного приложения
├── public/                        # Деплой-цель (Angular SSR output)
├── deploy                         # Деплой-скрипт
└── docs/                          # Документация
```

---

## 12. Мобильная разработка — паттерны и принципы

### 13.1. Формы ввода над клавиатурой (Android)

**Проблема:** Обычный `<Modal>` на Android не поднимается автоматически при появлении клавиатуры — клавиатура перекрывает поля ввода. `KeyboardAvoidingView` ведёт себя непредсказуемо внутри Modal.

**Решение — паттерн «абсолютный бар»:**
```tsx
// 1. Слушаем keyboardDidShow (НЕ WillShow — Android не генерирует)
useEffect(() => {
  const show = Keyboard.addListener('keyboardDidShow', (e) => setKbHeight(e.endCoordinates.height));
  const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
  return () => { show.remove(); hide.remove(); };
}, []);

// 2. Панель прилипает над клавиатурой
<View style={[styles.inputBar, { bottom: kbHeight }]}>
  ...
</View>

// 3. FlatList/ScrollView — отступ, чтобы контент не прятался за панелью
<FlatList contentContainerStyle={editMode ? { paddingBottom: 140 } : undefined} ... />
```

**Ключевые правила:**
- Всегда `keyboardDidShow` / `keyboardDidHide` — на Android `Will*`-события не приходят
- При закрытии формы: `Keyboard.dismiss()` **перед** сбросом состояния
- `paddingBottom` на списке = высота панели + запас

### 13.2. Навигация по полям через клавиатуру

При нескольких полях: первое — `returnKeyType="next"` + `onSubmitEditing={() => nextRef.current?.focus()}`, последнее — `returnKeyType="done"` + `onSubmitEditing={handleSubmit}`.

### 13.3. Автофокус при открытии формы

`autoFocus` на TextInput срабатывает при монтировании — достаточно рендерить поле только когда форма открыта. Дополнительный `ref.current?.focus()` нужен только если поле было смонтировано до открытия формы.

### 13.4. Состояние pending-мутаций

Кнопка «Сохранить/Отправить» дизейблится через `disabled={mutation.isPending}` + стиль `opacity: 0.6`. Двойной сабмит не нужно обрабатывать отдельно — TanStack Query не дублирует очередь при disabled.

### 13.5. Офлайн-стратегия

| Данные | staleTime | gcTime |
|--------|-----------|--------|
| Дерево папок, теги | `Infinity` | 24ч |
| Список файлов | 2 мин | 24ч |
| Inbox count | 30 с | 24ч |
| Скачивание файла | **требует сеть** | — |

`networkMode: 'offlineFirst'` — TanStack Query возвращает кэш без попытки запроса если сеть недоступна. `OfflineBanner` — жёлтая плашка вверху при отсутствии подключения.

### 13.6. Share Intent — кроссплатформенный мост

**Android:** `ShareIntentModule.kt` (Expo Module) читает `ACTION_SEND` из `currentActivity.intent`. Для `text/*` возвращает `{type: "text", text}`, для файлов — копирует `content://` URI в кэш, возвращает `{type: "file", uri: "file://...", fileName, mimeType}`. Плагин `withAndroidShareIntent` патчит `MainActivity`, добавляя `onNewIntent` с `setIntent(intent)`.

**iOS:** `ShareViewController.swift` читает `extensionContext.inputItems`, определяет тип контента (`public.file-url`, `public.url`, `public.plain-text`, `public.data`), копирует файл в App Group container (`group.com.delifile.app`), записывает metadata в `UserDefaults(suiteName)`, открывает host-приложение через `delifile://share` deep link. `ShareIntentModule.swift/.m` — Objective-C bridge для чтения данных из App Group через `NativeModules.ShareIntent`.

**Единый интерфейс:** `src/native/shareIntent.ts` абстрагирует платформы — `NativeModules.ShareIntent` на iOS, `require('share-intent').default` на Android. Методы: `getSharedData()`, `clearSharedData()`.

---

## 13. Ссылки на документацию

| Документ | Содержание |
|----------|-----------|
| `docs/build-process.md` | Пошаговая инструкция сборки APK (WSL2) и iOS (CI/CD) |
| `docs/mac-ios-build-setup.md` | Настройка MacBook для автоматической сборки iOS |
| `docs/mobile/ios-cicd.md` | iOS CI/CD — устройство, эксплуатация, управление runner |
| `docs/mobile/tz.md` | Техническое задание мобильного приложения |
| `docs/github-actions-deploy.md` | Настройка self-hosted runner для web-деплоя |
| `docs/ios-deploy-impact-analysis.md` | Анализ влияния iOS-деплоя на Android |
| `docs/iOS-share-extension-fix.md` | Исправление моргания iOS Share Extension |
| `docs/typed-folders-mobile-fix-2026-06-08.md` | Исправления по типам папок и просмотру файлов |
| `docs/file-request-feature.md` | Функционал запроса файлов |
| `docs/manual-check.md` | Чек-лист ручного тестирования |

---

## 14. Чеклист для переноса на новый проект

При создании нового проекта по этим принципам:

- [ ] Backend: Controller → Service → Model, `ApiResponseTrait` для единых ответов
- [ ] Backend: ULID для PK, backed string enums, `$fillable` во всех моделях
- [ ] Backend: S3 с presigned URL, `visibility: private`
- [ ] Frontend: Standalone-компоненты, Signals, functional guards/interceptors
- [ ] Frontend: Feature-based структура (`core/`, `features/`, `shared/`)
- [ ] Frontend: единый тип `ApiResponse<T>` = `{result, message, data}`
- [ ] Mobile: Expo Router (file-based), Zustand + React Query
- [ ] Mobile: SecureStore для токена, Axios interceptor для 401
- [ ] Mobile: `EXPO_PUBLIC_API_URL` для override base URL
- [ ] Mobile: Офлайн-режим через `networkMode: 'offlineFirst'` + `OfflineBanner`
- [ ] Mobile: Паттерн «абсолютный бар» для форм над клавиатурой (Android)
- [ ] CI/CD: self-hosted runners (Linux — web, macOS — iOS)
- [ ] CI/CD: единый `./deploy` скрипт для web-деплоя
- [ ] iOS: EAS Build + local keychain watcher + ShareExtension version sync
- [ ] iOS: Share Extension открывает host-app через responder chain до `completeRequest`
- [ ] Android: `debuggableVariants = []` в `build.gradle` для бандла JS в debug-сборках
- [ ] Android: `GRADLE_OPTS="-Xmx1200m -XX:MaxMetaspaceSize=256m"` для сборки в WSL2
- [ ] API: `/api/v1/` префикс, Bearer-токен, Sanсtum
- [ ] Кроссплатформенные enum-значения — **только строки**, не числа