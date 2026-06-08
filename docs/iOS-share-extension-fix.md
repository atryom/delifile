# iOS Share Extension — исправление моргания экрана

## Задача

При использовании функции «Поделиться» (iOS Share Sheet) для отправки файла в приложение DeliFile происходило моргание экрана — Share Extension показывался на долю секунды и сразу закрывался, после чего приложение не открывалось. Файл загружался только при последующем ручном запуске DeliFile.

Требовалось: после выбора DeliFile в Share Sheet приложение должно открываться автоматически и начинать загрузку файла.

## Причина

История исправлялась в несколько заходов. Ниже — итоговое, проверенное понимание.

### Что НЕ работает

1. **`extensionContext?.open(url)`** по документации Apple работает только для
   Today-виджетов и iMessage-приложений. Для Share Extension он возвращает `false`
   (или его completion-handler ведёт себя непредсказуемо) — приложение не
   открывается, экран застывает на «Открываем DeliFile...».

2. **Открытие через responder chain ПОСЛЕ `completeRequest`.** `completeRequest`
   отцепляет view controller расширения от окна. После этого цепочка responder'ов
   **обрывается** и больше не доходит до `UIApplication`, поэтому любой openURL
   проваливается. Симптом — моргание (расширение открылось и сразу закрылось), а
   приложение так и не запустилось.

3. **Устаревший селектор `openURL:`** (`application.perform(#selector(openURL:))`)
   на iOS 17/18 — тихий no-op.

### Что работает (итоговое решение)

Открывать хост-приложение нужно **до** `completeRequest`, пока view controller ещё
на экране. В этот момент цепочка responder'ов
(`self → view → window → UIWindowScene → UIApplication`) доходит до живого экземпляра
`UIApplication` процесса расширения. У него вызывается **современный**
`open(_:options:completionHandler:)`, а не устаревший селектор.

Расширение закрывается (`complete()`) только после того, как completion-handler
`open` отчитается об успехе — поэтому **моргания нет**: к моменту закрытия
расширения главное приложение уже на переднем плане. Если открыть не удалось,
показываем подсказку «Откройте DeliFile вручную».

Дополнительная проблема (решена отдельно): на JS-стороне не было обработчика deep
link `delifile://share` через `Linking.addEventListener`, поэтому даже при удачном
открытии URL не доставлялся в JS-код.

## Процесс исправления

### 1. `mobile/plugins/share-extension/ShareViewController.swift`

- **Добавлен `UILabel` (`messageLabel`)** для отображения статуса пользователю (вместо пустого экрана).
- **Добавлен `findHostApplication()`** — ищет живой `UIApplication` процесса
  расширения, проходя по цепочке responder'ов.
- **Переписана `openMainApp()`**:
  - Хост-приложение открывается **до** `completeRequest` (пока VC в окне и цепочка
    responder'ов цела).
  - Используется современный `application.open(url, options:completionHandler:)`.
  - `complete()` вызывается только в completion-handler'е `open` при `success` —
    моргания нет.
  - Если `UIApplication` в цепочке не найден — fallback на `extensionContext.open`.
  - Если открыть не удалось — подсказка «Откройте DeliFile, чтобы завершить загрузку»
    и закрытие через 2с.

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
| `mobile/plugins/share-extension/ShareViewController.swift` | Открытие хоста **до** `completeRequest` через `findHostApplication()` + современный `application.open(...)`; `complete()` только по completion-handler'у (без моргания); fallback на `extensionContext.open`; `messageLabel` для статуса |
| `mobile/app/_layout.tsx` | Добавлены `Linking.getInitialURL` + `Linking.addEventListener` для deep link `delifile://share`; добавлен retry с backoff (0.5/1/2с) в `checkIntent()` |

### Логика после исправления

```
iOS Share Sheet
  │
  ▼
ShareViewController.swift
  │  Копирует файл в App Group
  │  Пишет metadata в UserDefaults
  │  findHostApplication()  (responder chain → UIApplication)
  │  application.open("delifile://share") { success in
  │      success ? complete() : показать «Откройте DeliFile»
  │  }
  │  (открытие ДО completeRequest — цепочка responder'ов цела, моргания нет)
  ▼
Main app открывается, deep link доставлен
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

- Открытие хоста опирается на то, что `UIApplication` процесса расширения достижим через responder chain, пока VC на экране. На практике работает на iOS 15–18, но формально это «обход» — теоретически Apple может изменить поведение в будущих версиях.
- Если открыть приложение всё же не удалось, данные не теряются: они уже записаны в App Group и подхватятся при первом же foreground'е приложения (через AppState 'active' → checkIntent()).

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
