# Аудит мобильного приложения DeliFile (iOS/Apple)

**Дата:** 4 июня 2026  
**Стек:** Expo SDK 54 + expo-router, TypeScript, React Native, React Query v5, Zustand, Axios  
**Строк кода:** ~3 100  

---

## Сводка

| Критичность | Количество |
|-------------|:----------:|
| 🔴 CRITICAL | 6 |
| 🟠 HIGH | 12 |
| 🟡 MEDIUM | 34 |
| 🔵 LOW | 12 |
| **Итого** | **64** |

---

## 🔴 CRITICAL — исправить немедленно

### C-1. Push-токен: рассинхронизация при logout

**Файл:** `src/hooks/usePushNotifications.ts:47` vs `app/(app)/profile/index.tsx:55`

Регистрация использует `getDevicePushTokenAsync()` (сырой APNs-токен), а отмена — `getExpoPushTokenAsync()` (Expo-токен). Это **разные форматы**. Бэкенд не найдёт Expo-токен в таблице device_tokens → unregister не сработает. Пользователь будет получать уведомления после выхода.

**Исправление:** в `profile/index.tsx:55` заменить `getExpoPushTokenAsync` на `getDevicePushTokenAsync` и передавать сырой токен в `pushApi.unregisterToken`.

---

### C-2. 401 интерцептор не очищает zustand-стор и не перенаправляет

**Файл:** `src/api/client.ts:20-27`

При 401 удаляется только `auth_token` из SecureStore. Zustand-стор (`user`, `token`) остаётся в памяти → пользователь «зависает»: UI показывает авторизованный интерфейс, но все запросы падают.

**Исправление:** интегрировать zustand-стор в interceptor (через внешний референс, не импорт) и вызывать `clearAuth()` + `router.replace('/(auth)/login')`.

```typescript
// Вариант: модульный референс
let logoutFn: (() => Promise<void>) | null = null;
export const setLogoutFn = (fn: () => Promise<void>) => { logoutFn = fn; };

// В interceptor:
if (error.response?.status === 401) {
  await SecureStore.deleteItemAsync('auth_token');
  if (logoutFn) await logoutFn();
}
```

---

### C-3. JSON.parse без try-catch в auth store

**Файл:** `src/store/auth.ts:37`

Если `auth_user` в SecureStore повреждён, `JSON.parse` выбросит исключение, `isLoading` навсегда останется `true` → бесконечный спиннер.

**Исправление:**

```typescript
try {
  const user = userJson ? (JSON.parse(userJson) as User) : null;
  set({ user, token, isLoading: false });
} catch {
  await SecureStore.deleteItemAsync('auth_token');
  await SecureStore.deleteItemAsync('auth_user');
  set({ user: null, token: null, isLoading: false });
}
```

---

### C-4. Логическая ошибка в reset-password

**Файл:** `app/(auth)/reset-password.tsx:28`

`!verify.data.result` — `result` это строка `'success'|'error'`, не boolean. Непустая строка всегда truthy → условие **никогда не выполняется**. Сброс пароля сломан.

**Исправление:** заменить `!verify.data.result` на `verify.data.result !== 'success'`.

---

### C-5. Promise.all для мутаций в handleMoveFolder

**Файл:** `app/(app)/files/[id].tsx:203-206`

`Promise.all([removeFile, addFile])` — если одна операция упадёт, файл останется в несогласованном состоянии (удалён из старой папки, но не добавлен в новую).

**Исправление:** выполнять последовательно: сначала `removeFile`, затем `addFile`, с откатом при ошибке второго.

---

### C-6. Apple ID email в git-репозитории

**Файл:** `eas.json:27`

`"appleId": "atryomb@gmail.com"` — персональная информация в открытом виде. Риск фишинга и социальной инженерии.

**Исправление:** вынести в EAS Secrets: `eas secret:create --name APPLE_ID --value "atryomb@gmail.com"`, в eas.json использовать `"appleId": "%APPLE_ID%"`.

---

## 🟠 HIGH — ближайший спринт

### H-1. Нет `UIBackgroundModes: ["remote-notification"]`

**Файл:** `app.json` (ios-секция)

Без этого ключа iOS не будет будить приложение для обработки push-уведомлений в фоне.

**Исправление:** добавить в `app.json` → `ios.infoPlist`:

```json
"UIBackgroundModes": ["remote-notification"]
```

---

### H-2. Нет `buildNumber` для iOS

**Файл:** `app.json`, `scripts/bump-version.mjs`

Скрипт обновляет только Android `versionCode`. iOS `buildNumber` (CFBundleVersion) не инкрементируется → App Store Connect отклонит повторный билд.

**Исправление:** добавить в `app.json` → `ios`:

```json
"buildNumber": "1"
```

И обновить `bump-version.mjs` для инкремента `ios.buildNumber`.

---

### H-3. Share Intent не работает на iOS

**Файл:** `app/share.tsx`, `src/hooks/useShareIntent.ts:16`

`NativeModules.ShareIntent` — Android-only нативный модуль. На iOS приём файлов/ссылок из других приложений отсутствует.

**Исправление:** реализовать iOS Share Extension через `expo-share-extension` или кастомный нативный модуль.

---

### H-4. Токен читается из SecureStore на каждый HTTP-запрос

**Файл:** `src/api/client.ts:12-18`

На каждый запрос вызывается `SecureStore.getItemAsync()`. Токен уже хранится в zustand-сторе — нужно брать оттуда, избегая лишних I/O.

**Исправление:** использовать zustand-стор как единый источник токена для axios-интерцептора:

```typescript
// В auth store добавить getter
getState: () => ({ token }),
// В interceptor:
const token = useAuthStore.getState().token;
```

---

### H-5. Нет Error Boundary

Ни в одном экране нет `<ErrorBoundary>`. Любой необработанный throw в рендере крашит всё приложение.

**Исправление:** добавить React Error Boundary в `app/_layout.tsx`:

```tsx
import { ErrorBoundary } from 'react-error-boundary';
// Обернуть RootLayoutInner в <ErrorBoundary FallbackComponent={ErrorFallback}>
```

---

### H-6. Нет NSAppTransportSecurity конфигурации

S3 pre-signed URL могут использовать другие домены. Нет явной конфигурации ATS.

**Исправление:** добавить в `app.json` → `ios.infoPlist`:

```json
"NSAppTransportSecurity": {
  "NSExceptionDomains": {
    "delifile.ru": { "NSIncludesSubdomains": true },
    "s3.amazonaws.com": { "NSIncludesSubdomains": true }
  }
}
```

Или проверить, что все S3 URL используют HTTPS.

---

### H-7. appVersionSource конфликтует с bump-скриптом

**Файл:** `eas.json:4`

`"appVersionSource": "remote"` — EAS управляет версией на сервере, но `bump-version.mjs` также инкрементирует локальную версию.

**Исправление:** выбрать один источник. Если `"remote"` — убрать локальный bump-скрипт. Если `"local"` — bump-скрипт должен быть единственным источником.

---

### H-8. Нет refresh-token механизма

**Файл:** `src/store/auth.ts`, `src/api/auth.ts`

Токен хранится бесконечно. При истечении TTL на сервере — внезапный разлогин без предупреждения.

**Исправление:** либо реализовать refresh-token flow на бэкенде, либо добавить проактивный перезапрос `auth/me` при `AppState='active'` и истечении порога TTL.

---

### H-9. Upload tasks без cleanup при размонтировании

**Файлы:** `app/(app)/files/add.tsx:94-177`, `app/(app)/files/shared-folders/add.tsx:80-161`

`FileSystem.UploadTask` не отменяется при уходе со экрана. Только `share.tsx` имеет правильный cleanup.

**Исправление:** добавить `useEffect` cleanup во все upload-экраны:

```typescript
useEffect(() => {
  return () => { uploadTaskRef.current?.cancelAsync().catch(() => {}); };
}, []);
```

---

### H-10. supportsTablet: false без requireFullScreen

**Файл:** `app.json:17`

Apple может отклонить iPhone-only приложение без явного `requireFullScreen: true`.

**Исправление:** добавить в `app.json` → `ios`:

```json
"requireFullScreen": true
```

---

### H-11. Нет Universal Links для iOS

Только `scheme: "delifile"` (deep links). Нет `associatedDomains` для `applinks:delifile.ru`.

**Исправление:** добавить в `app.json` → `ios`:

```json
"associatedDomains": ["applinks:delifile.ru"]
```

И настроить Apple App Site Association на сервере.

---

### H-12. WebView в редакторе — небезопасная конфигурация

**Файл:** `app/(app)/files/edit/[id].tsx:308-314`

`originWhitelist={['*']}`, `allowFileAccessFromFileURLs`, `allowUniversalAccessFromFileURLs`, `mixedContentMode="always"` — все разрешения открыты.

**Исправление:** ограничить `originWhitelist` конкретными доменами, убрать `allowFileAccessFromFileURLs` и `allowUniversalAccessFromFileURLs`.

---

## 🟡 MEDIUM — планировать

### M-1. NSCameraUsageDescription и NSPhotoLibraryUsageDescription объявлены, но не используются

**Файл:** `app.json:19-22`

Камера и фотогалерея не запрашиваются в коде (используется только DocumentPicker). Apple может reject за неиспользуемые разрешения.

**Исправление:** либо убрать из Info.plist, либо добавить использование через `expo-image-picker`.

---

### M-2. catch (e: any) — 15+ вхождений без типизации

**Файлы:** Все экраны в `app/`

`any` полностью отключает проверку типов. Доступ к `e.response?.data?.message` не типизирован.

**Исправление:** использовать `axios.isAxiosError(e)` и тип `AxiosError<ApiResponse>`.

---

### M-3. loadToken() без .catch()

**Файл:** `app/_layout.tsx:29-31`

При ошибке приложение зависает на сплэшскрине.

**Исправление:** добавить `.catch(() => { set({ user: null, token: null, isLoading: false }); })`.

---

### M-4. Несоответствие API URL

**Файл:** `src/api/client.ts:4`

Fallback: `https://api.delifile.com/api/v1`, `.env`: `https://delifile.ru/api/v1`, `.env.example`: `https://api.delifile.com/api/v1` — три разных значения.

**Исправление:** унифицировать. `.env.example` должен содержать тот же домен, что и production `.env`, или явно документировать разницу.

---

### M-5. Хардкод IP разработчика в package.json

**Файл:** `package.json:8`

`REACT_NATIVE_PACKAGER_HOSTNAME=192.168.50.126` — не должен быть в git.

**Исправление:** убрать из package.json scripts, использовать `.env.local` или переменные окружения.

---

### M-6. Опечатка «ДеliFile»

**Файл:** `app/share.tsx:42`

Смешаны кириллица и латиница.

**Исправление:** заменить на `DeliFile` или `ДелиFile` — consistently.

---

### M-7. Некорректный тип в getQueryData

**Файл:** `app/(app)/files/shared-folders/[id].tsx:23`

`getQueryData<SharedFolder[]>()` — реальный тип `{ items: SharedFolder[] }`, а не `SharedFolder[]`.

---

### M-8. .env в git

**Файл:** `.env`

Production URL `https://delifile.ru/api/v1` может попасть в git.

**Исправление:** добавить `.env` в `.gitignore` (если ещё не добавлен).

---

### M-9. Нет SafeAreaView — контент перекрывается нотчем

**Файлы:** Все экраны

Захардкоженные `paddingTop: 56` вместо использования safe area insets. На iPhone X+ контент перекрывается.

**Исправление:** использовать `useSafeAreaInsets()` из `react-native-safe-area-context` или `SafeAreaView`.

---

### M-10. DatePickerModal — некорректная реализация для iOS

**Файл:** `src/components/ui/DatePickerModal.tsx:95-105`

На iOS рендерится голый `DateTimePicker` в режиме `display="spinner"` без модальной обёртки, без кнопок «Готово»/«Отмена». Состояние `phase` не сбрасывается при повторном открытии.

---

### M-11. 200+ захардкожанных русских строк без i18n

Все экраны содержат inline русские строки.

**Исправление:** внедрить `expo-localization` + `i18n-js` или `react-intl`. Начать с `src/i18n/` и вынести ключевые строки.

---

### M-12. Монолитный экран files/[id].tsx — 1189 строк

**Файл:** `app/(app)/files/[id].tsx`

20+ `useState` хуков. Каждый `setPanel()`, `setSelectedTagIds()` вызывает полный ререндер всего компонента.

**Исправление:** разбить на подкомпоненты: `VersionPanel`, `TagsPanel`, `AccessPanel`, `MoveFolderModal` и т.д.

---

### M-13. Math.random() для UUID

**Файл:** `src/utils/device.ts:7-13`

`Math.random()` — не криптографически стойкий ГСЧ. На iOS/Android предсказуем.

**Исправление:** использовать `crypto.getRandomValues` (через polyfill) или `expo-crypto`.

---

### M-14. 15+ API-методов без типизации ответа

**Файлы:** `src/api/files.ts`, `shared-folders.ts`, `documents.ts`, `support.ts`, `push.ts`

Методы вроде `cancelUpload`, `moveFolder`, `setTags` не типизируют ответ. При изменении формата бэкенда — ошибка в runtime.

**Исправление:** добавить generic-параметры `<ApiResponse<T>>` ко всем методам.

---

### M-15. Устаревший expo-file-system/legacy

**Файлы:** `app/share.tsx:4`, `app/(app)/files/add.tsx:8`, `app/(app)/files/[id].tsx:9`, `app/(app)/files/shared-folders/add.tsx:8`

Используется устаревший API. В Expo SDK 54 доступен новый `expo-file-system` API.

---

### M-16. Нет +not-found.tsx

При переходе на несуществующий роут — белый экран или краш.

---

### M-17. При отказе от push-разрешений — молчаливый return

**Файл:** `src/hooks/usePushNotifications.ts:42-43`

Нет UI для пояснения, почему уведомления не работают, и нет функции перехода в настройки системы.

---

### M-18. 30+ отсутствующих API-методов бэкенда

Критичные отсутствующие:
- `PATCH /user/settings` — нет настроек пользователя
- `PATCH /files/{id}/description`, `PATCH /files/{id}/rename` — нет редактирования файла
- `GET /notifications` — нет экрана уведомлений
- `POST /invitations/*` — нет приглашений
- `GET /activity` — нет ленты активности

---

### M-19. User.is_superuser в клиентском типе

**Файл:** `src/types/auth.ts:16`

Флаг `is_superuser` не должен доходить до клиента. Риск privilege escalation через подмену JSON в SecureStore.

**Исправление:** `Omit<User, 'is_superuser'>` или не включать в клиентский тип.

---

### M-20. Поиск без debounce

**Файл:** `app/(app)/files/index.tsx:136-140`

`useFileList({ search: search || undefined })` — каждый ввод символа триггерит API-запрос.

**Исправление:** добавить `useDebounce` с 300ms.

---

### M-21. InboxSharedFolder.access_type: string вместо enum

**Файл:** `src/types/inbox.ts:26`

Должно быть `'view' | 'edit'`.

---

### M-22. buildFolderTree без useMemo

**Файл:** `app/(app)/files/[id].tsx:1023-1040`

Сортировка и обход дерева на каждом рендере.

---

### M-23. Нет runtime-валидации ответов API

Все API-методы используют TypeScript type assertions (`as User`, `as FileListItem[]`). Если бэкенд изменит формат — ошибка в runtime без graceful handling.

**Исправление:** добавить zod-схемы или хотя бы assertion функции в development.

---

### M-24. as any для навигации

**Файлы:** `_layout.tsx:48`, `files/index.tsx:70,229`, `files/add.tsx:53`, `view/[id].tsx:79`, `edit/[id].tsx:268`

`typedRoutes: true` включён, но `as any` отключает проверку.

**Исправление:** добавить типы в экспо-router типизацию или убрать `as any`.

---

### M-25. Дублирование formatFileSize

**Файлы:** `src/utils/format.ts`, `app/(app)/files/index.tsx:20`, `app/(app)/files/shared-folders/[id].tsx:444`

Три копии одной функции.

**Исправление:** использовать единый импорт из `@/utils/format`.

---

### M-26. Дублирование pluralFiles

**Файлы:** `app/(app)/files/index.tsx:91-95`, `app/(app)/files/shared-folders/index.tsx:243-246`

Две копии одной функции.

---

### M-27. Нет конфигурации StatusBar

**Файл:** `app/_layout.tsx`

Отсутствует `<StatusBar style="auto" />` — на iOS стиль статус-бара может конфликтовать с фоном.

---

### M-28. Отсутствие haptic-обратной связи

Ни в одном экране не используется `expo-haptics` для подтверждения деструктивных действий.

---

### M-29. Формы используют Alert для ошибок валидации

**Файлы:** `register.tsx:18-30`, `login.tsx:36-37`, `reset-password.tsx:17-24`, `settings/security.tsx:39-49`

Вместо inline-сообщений под полями — `Alert.alert()`. Пользователь не видит, какое именно поле с ошибкой.

---

### M-30. Нет валидации email формата

**Файлы:** `login.tsx:17`, `register.tsx:18`, `connections/index.tsx:73`

Проверяется `!email.trim()`, но не формат email.

---

### M-31. ConnectionsTabIcon вызывает 2 query на каждый рендер

**Файл:** `app/(app)/_layout.tsx:14-16`

`useInboxCount()` и `useContactRequests()` в компоненте иконки вкладки — могут вызывать лишние запросы.

---

### M-32. RefetchInterval 10с для support/[id]

**Файл:** `app/(app)/settings/support/[id].tsx:37`

`refetchInterval: 10_000` + `markRead` на каждое изменение длины сообщений = избыточные API-вызовы.

---

### M-33. Нет expo-build-properties плагина

**Файл:** `app.json` (plugins)

iOS deployment target не контролируется явно.

---

### M-34. Нет(credentialsSource: "remote") для production

**Файл:** `eas.json`

Для production-билдов стоит явно указать `credentialsSource: "remote"`, чтобы EAS хранил сертификаты безопасно.

---

## 🔵 LOW — техдолг

### L-1. App.tsx и index.ts — мёртвый код

Шаблон Expo, не используемый при expo-router. Можно удалить.

---

### L-2. Hardcoded projectId

**Файл:** `app/(app)/profile/index.tsx:56`

Вместо `Constants.expoConfig?.extra?.eas?.projectId`.

---

### L-3. Нет кастомных storeIcon для App Store

Используется единый `icon.png` (1024x1024).

---

### L-4. Дублирование TOKEN_KEY

**Файл:** `src/api/client.ts:13` хардкодит `'auth_token'`, а `src/utils/storage.ts:3` экспортирует `TOKEN_KEY`. `storage.ts` — мёртвый код.

---

### L-5. formatFileSize не обрабатывает отрицательные значения

**Файл:** `src/utils/format.ts:1-6`

При `bytes < 0` результат будет `NaN undefined`.

---

### L-6. simulator: false в development-профиле eas.json

**Файл:** `eas.json:11`

Затрудняет отладку на iOS Simulator.

---

### L-7. Нет биометрической аутентификации (Face ID/Touch ID)

Данные credentials доступны сразу при открытии приложения.

---

### L-8. Нет expo-haptics

Нет тактильной обратной связи для деструктивных действий.

---

### L-9. Нет StatusBar конфигурации

---

### L-10. StaleTime: Infinity для folders, sharedFolders, tags

**Файлы:** `src/hooks/useFolders.ts`, `useSharedFolders.ts`, `useTags.ts`

Данные никогда не устаревают. Изменения с другого устройства не отразятся без ручного pull-to-refresh.

---

### L-11. networkMode: 'offlineFirst' без persister

**Файл:** `app/_layout.tsx:20`

React Query показывает закешированные данные при offline, но без persister кэш теряется при перезапуске.

---

### L-12. Нет проверки максимального размера файла перед upload

Пользователь может выбрать файл > тарифного лимита, и ошибка придёт только от сервера.

---

## Приоритеты исправления (топ-10)

| Приоритет | Проблема | Код |
|-----------|----------|-----|
| 1 | Push-токен mismatch при logout | C-1 |
| 2 | 401 interceptor → clearAuth + redirect | C-2 |
| 3 | JSON.parse в loadToken без try-catch | C-3 |
| 4 | reset-password: `result !== 'success'` | C-4 |
| 5 | Promise.all → последовательное выполнение | C-5 |
| 6 | Apple ID из eas.json → EAS Secrets | C-6 |
| 7 | ios.buildNumber в app.json + bump-скрипт | H-2 |
| 8 | UIBackgroundModes + NSAppTransportSecurity | H-1, H-6 |
| 9 | SafeAreaView для всех экранов | M-9 |
| 10 | Error Boundary на корневом уровне | H-5 |

---

## Связанные документы

- `docs/refactoring/09-mobile-audit.md` — предыдущий аудит (май 2026)
- `.opencode/plans/mobile-folder-migration-plan.md` — план миграции папок
- `docs/refactoring/execute_plan.md` — спринты 1-28