# iOS Share Extension — исправление моргания экрана

## Задача

При использовании функции «Поделиться» (iOS Share Sheet) для отправки файла в приложение DeliFile происходило моргание экрана — Share Extension показывался на долю секунды и сразу закрывался, после чего приложение не открывалось. Файл загружался только при последующем ручном запуске DeliFile.

Требовалось: после выбора DeliFile в Share Sheet приложение должно открываться автоматически и начинать загрузку файла.

## Причина

Share Extension (`ShareViewController.swift`) пытался открыть main app двумя способами:

1. **`openURLViaResponderChain()`** — ходит по цепочке responder'ов в поисках `UIApplication`. В iOS Share Extension `UIApplication.shared` недоступен, responder chain **не содержит UIApplication**. На iOS 15+ этот метод всегда возвращает `false`.

2. **`extensionContext?.open(url)`** (fallback) — документированная Apple нестабильность при вызове из Share Extension. Часто тихо падает без ошибки, особенно если приложение не было предварительно запущено (cold start).

**Результат:** оба метода терпели неудачу → `completeRequest()` вызывался немедленно (через 0.1с) → extension схлопывался, main app не открыт. Пользователь видел фликер. Данные оставались в App Group до следующего ручного foreground'а приложения, где `checkIntent()` в `_layout.tsx` их подхватывал.

Дополнительная проблема: на JS-стороне не было обработчика deep link `delifile://share` через `Linking.addEventListener`, поэтому даже при удачном открытии URL не доставлялся в JS-код.

## Процесс исправления

### 1. `mobile/plugins/share-extension/ShareViewController.swift`

- **Удалён метод `openURLViaResponderChain()`** — мёртвый код, никогда не работал на iOS 15+.
- **Добавлен `UILabel` (`messageLabel`)** для отображения статуса пользователю (вместо пустого экрана).
- **Изменена `openMainApp()`**:
  - Задержка перед попыткой уменьшена до 0.3с (было 0.1с — слишком мало).
  - Используется только `extensionContext?.open(url)` — легитимный API.
  - При успехе → `complete()` сразу.
  - При неудаче → показываем сообщение «Файл получен. Откройте DeliFile, чтобы завершить загрузку.» и завершаем extension через 2 секунды.
  - Спиннер и сообщение дают пользователю понятную обратную связь вместо фликера.

### 2. `mobile/app/_layout.tsx`

- **Добавлен импорт `Linking`** из `react-native`.
- **Добавлена обработка deep link `delifile://share`**:
  - `Linking.getInitialURL()` на mount — ловит URL при cold start.
  - `Linking.addEventListener('url', ...)` — ловит URL при warm start (приложение уже запущено).
  - При получении URL с префиксом `delifile://` вызывается `checkIntent()`, который проверяет `NativeModules.ShareIntent.getSharedData()` и при наличии данных редиректит на `/share`.
- **Добавлен retry-механизм в `checkIntent()`**:
  - Если `getSharedData()` вернул `null` при первой проверке, повторяем с backoff: 0.5с → 1с → 2с (3 попытки).
  - Это покрывает случай, когда `UserDefaults` ещё не синхронизировался после записи из extension.
  - Счётчик retry сбрасывается при каждом foreground (`AppState 'active'`).

### 3. `mobile/app.json`

- Не изменялся. Схема `delifile` уже настроена, маппинг на роут `/share` работает через Expo Router.

### 4. `mobile/plugins/withShareExtension.js`

- Не изменялся. Плагин корректен.

## Итог

### Изменённые файлы

| Файл | Изменения |
|------|-----------|
| `mobile/plugins/share-extension/ShareViewController.swift` | Удалён `openURLViaResponderChain`, добавлен `messageLabel`, переписана `openMainApp()` с увеличенной задержкой и пользовательским сообщением |
| `mobile/app/_layout.tsx` | Добавлены `Linking.getInitialURL` + `Linking.addEventListener` для deep link `delifile://share`; добавлен retry с backoff (0.5/1/2с) в `checkIntent()` |

### Логика после исправления

```
iOS Share Sheet
  │
  ▼
ShareViewController.swift
  │  Копирует файл в App Group
  │  Пишет metadata в UserDefaults
  │  extensionContext?.open("delifile://share")
  │    ├── success → complete() (app открыт, deep link доставлен)
  │    └── fail    → показываем «Откройте DeliFile» → complete() через 2с
  ▼
Main app открывается (если open сработал)
  │
  ▼
_layout.tsx
  │  Linking.getInitialURL / Linking.addEventListener → delifile://share
  │  checkIntent() с retry (0.5/1/2с)
  │  NativeModules.ShareIntent.getSharedData() → данные есть?
  │    ├── да → router.push('/share') → загрузка
  │    └── нет → retry или ждём след. foreground
  ▼
share.tsx — загрузка файла через API
```

### Остаточные риски

- `extensionContext?.open()` может не сработать при cold start на некоторых версиях iOS (известная проблема Apple). В этом случае пользователь увидит сообщение «Файл получен. Откройте DeliFile» (вместо фликера) и должен будет открыть приложение вручную.
- Если extension не открыл приложение, данные загрузятся при первом же foreground'е приложения (через AppState 'active' → checkIntent()).

## Откат

```bash
# Откатить ShareViewController.swift
git checkout 14bb624 -- mobile/plugins/share-extension/ShareViewController.swift

# Откатить _layout.tsx
git checkout 14bb624 -- mobile/app/_layout.tsx
```

Либо откатить коммит полностью:
```bash
git revert <commit-hash>
```
