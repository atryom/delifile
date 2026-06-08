# iOS Share Extension — исправление моргания экрана

## Задача

При использовании функции «Поделиться» (iOS Share Sheet) для отправки файла в приложение DeliFile происходило моргание экрана — Share Extension показывался на долю секунды и сразу закрывался, после чего приложение не открывалось. Файл загружался только при последующем ручном запуске DeliFile.

Требовалось: после выбора DeliFile в Share Sheet приложение должно открываться автоматически и начинать загрузку файла.

## Причина

История исправлялась в два захода.

### Заход 1 (ошибочный диагноз)

Сначала проблему объяснили так: оба способа открытия main app не работают —
`openURLViaResponderChain()` якобы мёртв, а `extensionContext?.open(url)` нестабилен.
Поэтому `openURLViaResponderChain()` **удалили** и оставили только
`extensionContext?.open(url)`. Это убрало фликер, но привело к новому симптому:
экран расширения **застревал** на надписи «Открываем DeliFile...», и приложение
так и не запускалось.

### Заход 2 (реальная причина)

`extensionContext?.open(url)` **по документации Apple работает только для
Today-виджетов и iMessage-приложений**. Для Share Extension он возвращает `false`
(или его completion-handler не вызывается вовсе) — поэтому main app не открывался,
а `messageLabel` навсегда оставался на «Открываем DeliFile...».

Метод `openURLViaResponderChain()`, наоборот, — **рабочий** способ. Несмотря на
расхожее утверждение, что `UIApplication` нет в responder chain, в share-расширении
на основе `UIViewController` цепочка responder'ов доходит до экземпляра
`UIApplication` процесса расширения, и `application.perform(openURL:)` срабатывает.
Это проверенный в продакшене подход (его использует библиотека `expo-share-intent`).

**Ключевой нюанс рабочего паттерна:** сначала `completeRequest`, и уже в его
completion-handler'е — открытие URL через responder chain. Это даёт расширению
корректно закрыться, пока хост-приложение запускается.

Дополнительная проблема (была решена ещё в заходе 1): на JS-стороне не было
обработчика deep link `delifile://share` через `Linking.addEventListener`, поэтому
даже при удачном открытии URL не доставлялся в JS-код.

## Процесс исправления

### 1. `mobile/plugins/share-extension/ShareViewController.swift`

- **Добавлен `UILabel` (`messageLabel`)** для отображения статуса пользователю (вместо пустого экрана).
- **Восстановлен метод `openURLViaResponderChain()`** — рабочий способ открытия
  main app: ищет `UIApplication` процесса расширения через цепочку responder'ов и
  вызывает селектор `openURL:`.
- **Переписана `openMainApp()`** по паттерну `expo-share-intent`:
  - Убран `extensionContext?.open(url)` — он не работает для Share Extension.
  - Сначала вызывается `extensionContext?.completeRequest(...)`, и уже в его
    completion-handler'е выполняется `openURLViaResponderChain(url)`.
  - Это позволяет расширению корректно закрыться, пока запускается хост-приложение.

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
| `mobile/plugins/share-extension/ShareViewController.swift` | Восстановлен `openURLViaResponderChain`, переписана `openMainApp()` по паттерну `expo-share-intent` (`completeRequest` → открытие через responder chain), добавлен `messageLabel` |
| `mobile/app/_layout.tsx` | Добавлены `Linking.getInitialURL` + `Linking.addEventListener` для deep link `delifile://share`; добавлен retry с backoff (0.5/1/2с) в `checkIntent()` |

### Логика после исправления

```
iOS Share Sheet
  │
  ▼
ShareViewController.swift
  │  Копирует файл в App Group
  │  Пишет metadata в UserDefaults
  │  extensionContext?.completeRequest(...) { in completion:
  │      openURLViaResponderChain("delifile://share")
  │      (UIApplication процесса расширения → openURL:)
  │  }
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

- `openURLViaResponderChain()` опирается на то, что `UIApplication` процесса расширения достижим через responder chain. На практике работает на iOS 15–18, но формально это «обход» — теоретически Apple может изменить поведение в будущих версиях.
- Если extension не открыл приложение, данные всё равно загрузятся при первом же foreground'е приложения (через AppState 'active' → checkIntent()), так что потери данных не происходит.

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
