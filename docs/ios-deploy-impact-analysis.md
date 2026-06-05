# Анализ влияния iOS-деплоя на Android-приложение

**Дата:** 04.06.2026  
**Диапазон коммитов:** HEAD~15 → HEAD (7b7080d)  
**Проект:** DeliFile Mobile (Expo/React Native)

---

## Общая информация

Мобильное приложение DeliFile — кроссплатформенное (Expo SDK ~54, React Native). Последние 15 коммитов содержали масштабные изменения, преимущественно связанные с деплоем iOS-версии в App Store. Ниже — детальный разбор того, как эти изменения затрагивают Android.

---

## 1. КРИТИЧЕСКИЕ проблемы

### 1.1. Смена API URL (исправление)

**Файл:** `mobile/src/api/client.ts`

```diff
- export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.delifile.com/api/v1';
+ export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://delifile.ru/api/v1';
```

**Влияние:** Обе платформы.  
**Контекст:** Домен `api.delifile.com` нам не принадлежит. Старый fallback был ошибочным — правильный домен: `delifile.ru`. Изменение исправляет баг, а не создаёт риск.  
**Единственный риск:** Если у пользователей установлены старые сборки с fallback `api.delifile.com`, они не смогут подключиться к серверу (этот домен им не принадежит). Необходимо выпустить обновление и по возможности распространить его.  
**Для новых сборок:** Проблемы нет, `delifile.ru` — корректный домен.

---

### 1.2. WebView редактора: `originWhitelist` и `allowFileAccess`

**Файл:** `mobile/app/(app)/files/edit/[id].tsx`

```diff
- originWhitelist={['*']}
- allowUniversalAccessFromFileURLs
+ originWhitelist={['file://*']}
+ allowFileAccessFromFileURLs
```

**Влияние:** Обе платформы.  
**Риск:**  
- `originWhitelist: ['*']` разрешал загрузку контента из любых источников в WebView. Смена на `['file://*']` может заблокировать загрузку изображений и других ресурсов по `http(s)://` внутри редактора.
- `allowUniversalAccessFromFileURLs` — deprecated-флаг в Android WebView, разрешавший кросс-оригин запросы из `file://`. Замена на `allowFileAccessFromFileURLs` — более безопасная, но может сломать загрузку картинок в TipTap-редакторе (если редактор загружает их по HTTP).

**Рекомендация:** Протестировать на Android открытие документа с изображениями. Если изображения не грузятся — вернуть `allowUniversalAccessFromFileURLs` для Android через `Platform.OS`-проверку.

---

## 2. СРЕДНИЕ риски

### 2.1. Убрана проверка `Platform.OS` для Share Intent

**Файл:** `mobile/app/_layout.tsx`

```diff
- if (Platform.OS !== 'android') return;
  const mod = NativeModules.ShareIntent;
```

Раньше шаринг через `ShareIntent` работал **только на Android**. Теперь код пытается вызвать `NativeModules.ShareIntent` на обеих платформах. На iOS добавлен нативный модуль `ShareIntent` (через `ShareIntentModule.swift` + App Groups), на Android уже был `ShareIntentModule.kt`.

**Влияние:** Обе платформы.  
**Риск:** На iOS `ShareIntentModule.swift` передаёт данные через `UserDefaults(suiteName: "group.com.delifile.app")`, а на Android — через `Intent.EXTRA_STREAM` / `Intent.EXTRA_TEXT`. Логика разных, но интерфейс `NativeModules.ShareIntent` одинаковый. Если iOS-расширение не зарегистрировано в Bridge корректно, приложение может зависнуть при проверке `getSharedData()`.

**Рекомендация:** Проверить, что на iOS Share Extension корректно пробрасывает данные через App Groups и нативный модуль зарегистрирован.

---

### 2.2. Авторизация через Zustand-стор

**Файл:** `mobile/src/api/client.ts`

```diff
- const token = await SecureStore.getItemAsync('auth_token');
+ const token = useAuthStore.getState().token;
```

Вместо асинхронного чтения из SecureStore при каждом запросе, токен теперь берётся синхронно из Zustand-стора. Это корректно работает, если при старте приложения вызывается `loadToken()`, который загружает токен из SecureStore в стор.

**Влияние:** Обе платформы.  
**Риск:** Если между запросами токен в стореDidChange (например, при logout), интерцептор может использовать устаревший токен. Но `clearAuth()` в обработчике 401 решает это.  
**Статус:** Безопасно, но требует проверки, что `loadToken()` вызывается в корневом layout при каждом запуске приложения.

---

### 2.3. Push-уведомления: `getDevicePushTokenAsync` вместо `getExpoPushTokenAsync`

**Файл:** `mobile/app/(app)/profile/index.tsx`

```diff
- const tokenData = await Notifications.getExpoPushTokenAsync({ projectId: '...' });
- await pushApi.unregisterToken(tokenData.data);
+ const tokenData = await Notifications.getDevicePushTokenAsync();
+ await pushApi.unregisterToken(tokenData.data as string);
```

**Влияние:** Обе платформы.  
**Риск:** `getDevicePushTokenAsync()` возвращает нативный FCM/APNs токен вместо Expo-токена. Если бэкенд ожидает Expo-формат токена, отвязка при выходе не сработает.  
**Рекомендация:** Убедиться, что регистрация push-уведомлений тоже использует `getDevicePushTokenAsync()`, а бэкенд корректно обрабатывает нативные токены.

---

### 2.4. Регистрация push-уведомлений: обработка `canAskAgain`

**Файл:** `mobile/src/hooks/usePushNotifications.ts`

```diff
+ const { status, canAskAgain } = await Notifications.requestPermissionsAsync();
+ if (status !== 'granted') {
+   if (!canAskAgain) {
+     Alert.alert('Уведомления отключены', '...', [..., { text: 'Открыть настройки', onPress: () => Linking.openSettings() }]);
+   }
+   return;
+ }
```

**Влияние:** Обе платформы.  
**Риск:** Нет. `Linking.openSettings()` работает на Android и iOS. Добавление информативного Alert для пользователей, которые уже отклонили запрос на уведомления — улучшение UX.

---

## 3. НИЗКИЙ риск / Безопасные изменения

### 3.1. Загрузка редактора через `resolveEditorUri()`

**Файл:** `mobile/app/(app)/files/edit/[id].tsx`

```typescript
async function resolveEditorUri(): Promise<string> {
  if (Platform.OS === 'android') {
    return 'file:///android_asset/editor.html';
  }
  const [asset] = await Asset.loadAsync([require('../../../../assets/editor/editor-inline.html')]);
  return asset.localUri!;
}
```

Android продолжит загружать `editor.html` из Android assets. iOS — инлайн-версию через `expo-asset`. Платформы разделены корректно.

---

### 3.2. Share Extension: `data.name` для iOS

**Файл:** `mobile/app/share.tsx`

```diff
- const fileName = data.fileName ?? 'file';
+ const fileName = data.fileName ?? data.name ?? 'file';
```

Безопасный fallback. На Android передаётся `fileName` (из Kotlin-модуля), на iOS — `name` (из ShareViewController.swift).

---

### 3.3. Новые зависимости

| Пакет | Кроссплатформенный | Примечание |
|---|---|---|
| `@react-native-community/datetimepicker` | Да | DatePicker для задач |
| `expo-haptics` | Да | Тактильная отзывчивость |
| `expo-crypto` | Да | Замена Math.random() для UUID |
| `expo-build-properties` | Да | Настройки сборки (iOS deployment target, пустой Android) |
| `@tanstack/react-query-persist-client` | Да | Персистенция кэша через AsyncStorage |
| `@react-native-async-storage/async-storage` | Да | Уже использовался |

---

### 3.4. `AppErrorBoundary` и `PersistQueryClientProvider`

**Файл:** `mobile/app/_layout.tsx`

Добавлена обёртка ErrorBoundary и персистентный кэш React Query через AsyncStorage. Обе фичи кроссплатформенные.

---

### 3.5. `crypto.randomUUID()` вместо `Math.random()`

**Файл:** `mobile/src/utils/device.ts`

```diff
- return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ...);
+ return Crypto.randomUUID();
```

`expo-crypto` работает на обеих платформах. UUID теперь соответствует RFC 4122.

---

### 3.6. Форматирование и утилиты

**Файл:** `mobile/src/utils/format.ts`

- `formatFileSize`: исправлено `bytes === 0` → `bytes <= 0`
- Добавлены `isValidEmail()`, `pluralFiles()` — кроссплатформенные утилиты
- Дублирующиеся локальные функции `formatSize()`/`pluralFiles()` убраны из компонентов, заменены на импорт из `@/utils/format`

---

### 3.7. Обработка ошибок: `getApiError()` вместо `e.response?.data?.message`

Повсеместная замена `catch (e: any) { e.response?.data?.message }` на типобезопасный `getApiError(e, fallback)` с использованием `isAxiosError`. Улучшает DX и безопасность типов, не ломает функционал.

---

### 3.8. Валидация форм

- В `_layout.tsx` (login, register, forgot-password) добавлена валидация email через `isValidEmail()` и inline-ошибки вместо `Alert`
- Безопасно для обеих платформ

---

### 3.9. Safe Area Insets

В `connections/index.tsx`, `login.tsx`, `register.tsx`, `profile/index.tsx` добавлено использование `useSafeAreaInsets()` для корректного позиционирования под статус-бар. На Android Insets также корректны (начиная с API 28+).

---

### 3.10. Новые бизнес-фичи (кроссплатформенные)

- Модуль задач (`is_task`, `task_status`, `task_start_date`, `task_due_date`, `task_assigned_user_id`)
- Управление доступом к файлам (accesses CRUD)
- Управление публичными ссылками (список, отключение)
- Управление участниками общих папок (добавление, удаление, смена прав)
- DatePicker для задач (`@react-native-community/datetimepicker`)

Все новые хуки, API-методы и типы — кроссплатформенные.

---

### 3.11. Конфигурация Expo (`app.json`)

| Параметр | Влияет на Android? |
|---|---|
| `ios.supportsTablet: false` | Нет |
| `ios.bundleIdentifier` | Нет |
| `ios.appleTeamId` | Нет |
| `ios.requireFullScreen` | Нет |
| `ios.infoPlist.UIBackgroundModes` | Нет |
| `ios.infoPlist.NSAppTransportSecurity` | Нет |
| `ios.infoPlist.ITSAppUsesNonExemptEncryption` | Нет |
| `android.adaptiveIcon.backgroundColor: "#6366f1"` | **Да** — фон адаптивной иконки изменён с белого на индиго |
| `splash.backgroundColor: "#6366f1"` | **Да** — фон splash-экрана изменён с белого на индиго |
| `assetBundlePatterns` | Да — но безвредно, включает ресурсы в сборку |
| `experimental.ios.appExtensions` (Share Extension) | Нет |
| `plugins: ["./plugins/withShareExtension"]` | **Да** — плагин запускается при prebuild, но проверяет `ios` платформу внутри |

---

## 4. iOS-специфичный код (не влияет на Android)

### 4.1. Share Extension (Swift)

Файлы в `mobile/plugins/share-extension/`:
- `ShareViewController.swift` — контроллер iOS Share Extension
- `ShareIntentModule.swift` + `.m` — нативный мост для iOS
- `ShareExtension.entitlements`, `Info.plist`

### 4.2. Expo Config Plugin (`withShareExtension.js`)

Плагин экспо-конфигурации, который модифицирует Xcode-проект. Содержит проверки на `ios`-платформу и не влияет на Android-сборку.

### 4.3. `eas.json` — публикация iOS

- `ios.simulator: true` в development-профиле
- `ios.credentialsSource: "remote"` в production
- `submit.production.ios.ascAppId`, `appleTeamId`

---

## 5. Итоговая таблица рисков

| # | Проблема | Серьёзность | Платформа | Статус |
|---|---|---|---|---|
| 1 | Смена API URL на `delifile.ru` (исправление: `api.delifile.com` — не наш домен) | **КРИТИЧЕСКАЯ** для старых сборок | Обе | Новые сборки — ОК, старые не подключатся к `api.delifile.com` |
| 2 | `originWhitelist: ['file://*']` | **СРЕДНЯЯ** | Обе | Протестировать картинки в редакторе |
| 3 | `allowFileAccessFromFileURLs` вместо `allowUniversalAccessFromFileURLs` | **СРЕДНЯЯ** | Android | То же, что п.2 |
| 4 | Убрана проверка `Platform.OS` для ShareIntent | **СРЕДНЯЯ** | iOS | Проверить регистрацию нативного модуля |
| 5 | Авторизация через Zustand вместо SecureStore | **НИЗКАЯ** | Обе | Безопасно при loadToken() при старте |
| 6 | `getDevicePushTokenAsync` при logout | **НИЗКАЯ** | Обе | Проверить формат токена на бэкенде |
| 7 | Splash/Icon backgroundColor: `#6366f1` | **НИЗКАЯ** | Android | Визуальное изменение, не баг |
| 8 | iOS Share Extension код | Нет | iOS-only | Не влияет на Android |
| 9 | iOS EAS config | Нет | iOS-only | Не влияет на Android |

---

## 6. Рекомендации

1. **Обновить Android-сборку и распространить** — старые версии содержат ошибочный fallback `api.delifile.com` (чужой домен), который не работал и не будет работать. Новые сборки с `delifile.ru` подключаются корректно.
2. **Протестировать TipTap-редактор на Android**: открыть документ с изображениями и убедиться, что они загружаются. При проблемах — добавить условие:
   ```tsx
   allowUniversalAccessFromFileURLs={Platform.OS === 'android'}
   ```
3. **Проверить push-отписку при logout**: убедиться, что `getDevicePushTokenAsync()` возвращает строковый токен, а бэкенд корректно обрабатывает FCM/APNs токены (а не Expo-токены).
4. **Собрать и протестировать APK** после всех изменений: все новые зависимости кроссплатформенные, но сборка — финальная проверка.
5. При следующем релизе Android — обновить `versionCode` через `scripts/bump-version.mjs` (скрипт уже обрабатывает и `buildNumber` для iOS, и `versionCode` для Android).