# DeliFile Mobile — Техническое задание

**Платформы:** Android, iOS  
**Стек:** React Native + Expo SDK 54  
**Бэкенд:** существующий Laravel API (`/api/v1`), без изменений для Фазы 1  
**Навигация:** Expo Router v6 (file-based)  
**Статус документа:** актуально (обновлено 2026-05-19)

---

## Общая архитектура

```
Angular (веб)  ──┐
                 ├──► Laravel API (/api/v1)
React Native   ──┘
(mobile)
```

- Angular и мобильное приложение — независимые клиенты одного API
- Shared TypeScript-типы генерируются из API-контрактов вручную (`src/types/`)
- Авторизация: Laravel Sanctum Bearer-токен, хранится в `expo-secure-store`
- Формат ответа API: `{ result: bool, message: string, data: T }`

---

## Технологический стек

| Слой | Библиотека | Назначение |
|------|-----------|-----------|
| Навигация | expo-router ~6.x | File-based routing, deep links |
| Глобальный стейт | zustand ^5 | Auth-токен + user, online/offline флаг |
| Данные / кэш | @tanstack/react-query v5 | Фетчинг, офлайн-кэш, инвалидация |
| HTTP | axios ^1 | Запросы к API, интерцепторы авторизации |
| Хранилище токена | expo-secure-store | Токен + JSON пользователя |
| Сеть | @react-native-community/netinfo | Определение online/offline |
| Файлы | expo-file-system, expo-sharing | Скачивание и шеринг файлов |
| Сборка (Android) | Gradle (локально, WSL2) | `assembleDebug` / `assembleRelease` |
| Сборка (облако) | EAS Build | Резервный вариант, iOS |

---

## Офлайн-режим

**Принцип:** приложение показывает закэшированную структуру при отсутствии сети, но требует подключения для открытия содержимого файлов.

| Данные | Кэш |
|--------|-----|
| Дерево папок | `staleTime: Infinity`, `gcTime: 24ч` |
| Теги | `staleTime: Infinity`, `gcTime: 24ч` |
| Список файлов | `staleTime: 2 мин`, `gcTime: 24ч` |
| Счётчик inbox | `staleTime: 30 с` |
| Скачивание файла | **требует сеть** — Alert при попытке офлайн |

`networkMode: 'offlineFirst'` в QueryClient — TanStack Query возвращает кэш без попытки запроса если сеть недоступна.

`OfflineBanner` — жёлтая плашка вверху экрана при отсутствии подключения.

---

## Конфигурация окружений

Файл `.env` в корне `mobile/`:

```
EXPO_PUBLIC_API_URL=https://YOUR_API_DOMAIN/api/v1
```

> **Важно для разработки на физическом устройстве:**  
> `https://delifile.local` не разрешается на телефоне — нужен реальный домен или IP сервера в локальной сети.  
> Android-эмулятор: `http://10.0.2.2/api/v1` (localhost хоста).

---

## Поэтапная разбивка

### ✅ Фаза 1 — «Просмотр, управление, связи» (выполнено)

#### Авторизация

- [x] Экран входа (email + пароль)
- [x] Экран регистрации (email + пароль + подтверждение + чекбокс политики конфиденциальности)
- [x] Экран «Забыли пароль» — отправка письма с кодом
- [x] Экран сброса пароля — ввод 6-значного кода + новый пароль
- [x] Хранение токена и данных пользователя в SecureStore
- [x] Авто-редирект при наличии/отсутствии токена
- [x] Выход из аккаунта с подтверждением и редиректом на экран входа

#### Файлы и папки (вкладка «Файлы»)

- [x] Файловый менеджер с drill-down навигацией (как в Android-проводнике)
- [x] Корень: список папок верхнего уровня + файлы без папки
- [x] Тап по папке — заход внутрь, кнопка «Назад» в шапке
- [x] Список файлов с фильтрами: Все / Мои / Полученные / Избранное
- [x] Поиск по имени файла
- [x] Карточка файла (метаданные, теги, размер, дата)
- [x] Скачать файл (через presigned S3 URL → `Linking.openURL`)
- [x] Открыть URL-файл (внешняя ссылка)
- [x] Добавить/убрать из избранного
- [x] Закрепить/открепить файл
- [x] Кнопка «+» → модальное меню: Загрузить файл (заглушка), Добавить ссылку (заглушка), Создать папку (работает → `POST /folders`)

#### Связи (вкладка «Связи»)

- [x] Segmented control: Контакты / Запросы
- [x] Список контактов с аватарами-инициалами, поиск
- [x] Пригласить контакт по email (`POST /contacts`)
- [x] Запросы на контакт: принять / отклонить (`POST /contact-requests/{id}/accept|reject`)
- [x] Входящие файлы: принять / отклонить по одному
- [x] Входящие общие папки: принять / отклонить по одному
- [x] Badge на вкладке = сумма pending contact requests + inbox.total

#### Настройки (вкладка «Настройки»)

- [x] Теги: список, создать, редактировать, удалить (`GET/POST/PATCH/DELETE /tags`)
- [x] Безопасность: смена пароля (`POST /auth/password/change`), список активных сессий (`GET /auth/sessions`), отзыв сессии (`DELETE /auth/sessions/{id}`)
- [x] Техподдержка: список тикетов с статусом и счётчиком непрочитанных, создать тикет (`POST /support/tickets`)

#### Профиль (вкладка «Профиль»)

- [x] Имя, email, тарифный план (бейдж)
- [x] Прогресс-бар использования хранилища + статистика устройств
- [x] Предупреждение о неподтверждённом email
- [x] Модал смены тарифа: список планов (`GET /tariffs`), отправить заявку (`POST /tariffs/request`)
- [x] Выход из аккаунта

#### Публичные ссылки

- [x] Deep link `delifile://link/{token}` открывает модальный экран
- [x] Просмотр метаданных файла по публичной ссылке
- [x] Скачивание по публичной ссылке

#### Брендинг

- [x] Логотип (folder-symlink, синий `#2563EB`) сгенерирован в PNG через `scripts/generate-icon.mjs`
- [x] Иконка приложения, adaptive icon, splash-icon, favicon — все заменены
- [x] Логотип отображается на экранах входа и регистрации

#### Инфраструктура

- [x] Expo Router: группы `(auth)` / `(app)`, Stack + Tabs
- [x] 4 вкладки: Файлы (Stack с drill-down), Связи, Настройки, Профиль
- [x] OfflineBanner при потере сети
- [x] Офлайн-кэш через TanStack Query (`networkMode: offlineFirst`)
- [x] Типы TypeScript из API-контрактов (`src/types/`)
- [x] Axios-клиент с интерцептором Bearer-токена
- [x] Локальные Android-сборки через Gradle (WSL2)
- [x] EAS-конфигурация (development / preview / production)

#### Не входит в Фазу 1

- Загрузка файлов (→ Фаза 2)
- Добавление URL-файлов (→ Фаза 2)
- Просмотр тикетов поддержки (только список и создание; чат внутри тикета → Фаза 2)
- Push-уведомления (→ Фаза 3, требует FCM/APNs на бэкенде)
- Markdown-редактор (→ Фаза 3)
- Admin-панель (→ Фаза 3 или только веб)

---

## Принципиальные моменты реализации (Фаза 1)

### Формы ввода над клавиатурой: паттерн «абсолютный бар»

**Проблема.** Обычный `<Modal>` на Android не поднимается автоматически при появлении клавиатуры — клавиатура перекрывает поля ввода. `KeyboardAvoidingView` ведёт себя непредсказуемо внутри Modal.

**Решение.** Во всех трёх формах (теги, техподдержка, приглашение контакта) используется **не Modal**, а панель с `position: 'absolute'`, которая программно сдвигается на высоту клавиатуры:

```tsx
// 1. Слушаем keyboardDidShow (НЕ WillShow — Android его не генерирует)
useEffect(() => {
  const show = Keyboard.addListener('keyboardDidShow', (e) => setKbHeight(e.endCoordinates.height));
  const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
  return () => { show.remove(); hide.remove(); };
}, []);

// 2. Панель прилипает над клавиатурой
<View style={[styles.inputBar, { bottom: kbHeight }]}>
  ...
</View>

// 3. FlatList/ScrollView добавляет отступ, чтобы контент не прятался за панелью
<FlatList contentContainerStyle={editMode ? { paddingBottom: 140 } : undefined} ... />
```

**Ключевые правила:**
- Всегда `keyboardDidShow` / `keyboardDidHide` — на Android `Will`-события не приходят.
- При закрытии формы обязательно вызывать `Keyboard.dismiss()` **перед** сбросом состояния.
- Начальный `bottom: 0` когда клавиатура скрыта — бар при этом не виден (рендерится только когда `editMode/creating/adding === true`).
- `paddingBottom` на списке = высота панели + небольшой запас, чтобы последняя запись не пряталась.

**Файлы-примеры:**
- Теги: `mobile/app/(app)/settings/tags.tsx` — однострочный ввод, `returnKeyType="done"` → сохранение
- Техподдержка: `mobile/app/(app)/settings/support.tsx` — многострочный `TextInput` (`multiline`, `numberOfLines={4}`)
- Контакты: `mobile/app/(app)/connections/index.tsx` — два поля с переходом по `returnKeyType="next"` + `ref.current?.focus()`

### Автофокус при открытии формы

`autoFocus` на TextInput срабатывает при монтировании — достаточно рендерить поле только когда форма открыта. Дополнительный вызов `ref.current?.focus()` нужен только если поле уже было смонтировано до открытия формы.

### Навигация по полям через клавиатуру

При нескольких полях: первое — `returnKeyType="next"` + `onSubmitEditing={() => nextRef.current?.focus()}`, последнее — `returnKeyType="done"` + `onSubmitEditing={handleSubmit}`. Без этого пользователь вынужден тапать между полями вручную.

### Состояние pending-мутаций

Кнопка «Сохранить/Отправить» дизейблится через `disabled={mutation.isPending}` + стиль `opacity: 0.6`. Двойной сабмит не нужно обрабатывать отдельно — TanStack Query очереди не дублирует при disabled.

---

### Фаза 2 — «Работа с контентом» (в планах)

| Функция | Эндпоинты |
|---------|-----------|
| Загрузка файлов (S3 presigned, фоновый режим) | `POST /files/init-upload`, `POST /files/complete-upload` |
| Добавить URL-файл | `POST /url-files` |
| Переместить в папку, задать теги | `POST /files/{id}/move-folder`, `/files/{id}/set-tags` |
| Поделиться файлом с контактом | `POST /files/{id}/share-to-contact` |
| Создать публичную ссылку | `POST /files/{id}/create-link` |
| Общие папки (просмотр файлов, добавить) | `/shared-folders/*` |
| Версии файлов (просмотр, скачать, переключить) | `/files/{id}/versions/*` |
| Чат внутри тикета техподдержки | `GET /support/tickets/{id}`, `POST /support/tickets/{id}/messages` |
| Лента активности | `GET /activity` |
| OS Share Intent (Android/iOS) | Системный интент → загрузить файл в DeliFile |

---

### Фаза 3 — «Полный паритет» (в планах)

| Функция | Примечания |
|---------|-----------|
| Push-уведомления | Требует добавить FCM/APNs endpoint на бэкенде — VAPID не работает в native-приложении |
| Markdown-просмотр (read-only) | Рендер через `react-native-markdown-display` |
| Markdown-редактор | Сложная задача: блокировки, heartbeat каждые 60с, конфликт-резолюция |
| Комментарии к файлам и папкам | `/comment-threads/*`, `/comments/*` |
| Admin-панель | Опционально; возможно, оставить только в веб |

---

## Сборка

### Локальная Android-сборка (основной метод)

**Требования:** JDK 17, Android SDK (`~/android-sdk/`), NDK 27.1 (ставится автоматически при первой сборке)

```bash
# Из директории mobile/
npx expo prebuild --platform android   # только после изменений в app.json / native-модулях

# Генерация иконок (после изменения логотипа)
node scripts/generate-icon.mjs

# Debug APK (~129 МБ, для тестирования, JS bundled)
cd android
GRADLE_OPTS="-Xmx1200m -XX:MaxMetaspaceSize=256m" \
  ./gradlew assembleDebug --no-daemon --max-workers=1 -Dorg.gradle.parallel=false

# Release APK (требует ≥8 ГБ RAM в WSL2)
GRADLE_OPTS="-Xmx1200m -XX:MaxMetaspaceSize=256m" \
  ./gradlew assembleRelease --no-daemon --max-workers=1 -Dorg.gradle.parallel=false
```

APK: `android/app/build/outputs/apk/debug/app-debug.apk`

> **`debuggableVariants = []` в `android/app/build.gradle`** — обязательная настройка.  
> По умолчанию React Native debug-сборки **не включают** JS-бандл в APK и ждут Metro dev server (порт 8081). При отсутствии Metro приложение зависает на splash screen. Строка `debuggableVariants = []` в блоке `react {}` заставляет Gradle упаковывать JS в APK даже для debug-варианта.

**Keystore:** `~/android-sdk/delifile-release.keystore`, alias `delifile`, pass `delifile123`

> **WSL2 и release-сборки:** При 4 ГБ RAM Gradle daemon падает на этапе CMake-компиляции нативного кода. Добавьте в `C:\Users\<user>\.wslconfig`:
> ```ini
> [wsl2]
> memory=8GB
> swap=2GB
> ```
> Затем `wsl --shutdown` в PowerShell.

### EAS (резервный вариант, iOS)

```bash
npx eas build --platform android --profile preview
npx eas build --platform ios --profile development
npx eas update --branch preview   # OTA JS-обновление без пересборки
```

---

## Тестирование

| Этап | Android | iOS |
|------|---------|-----|
| Разработка | Debug APK по USB (`adb install`) или Metro QR | Expo Go / dev build через EAS |
| Стабильные сборки | Release APK (Gradle) или EAS internal | TestFlight |
| Релиз | Google Play | App Store |

**Для iOS** нужен Apple Developer Account ($99/год). **Google Play Console** — $25 единоразово, только для публикации в магазин.

---

## Структура проекта

```
mobile/
├── app/                          # Экраны (Expo Router)
│   ├── _layout.tsx               # Корень: QueryClient + NetInfo + шрифты
│   ├── index.tsx                 # Редирект: (app)/files или (auth)/login
│   ├── (auth)/                   # Авторизация (без таб-бара)
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   ├── forgot-password.tsx
│   │   └── reset-password.tsx
│   ├── (app)/                    # Основное приложение (таб-бар)
│   │   ├── _layout.tsx           # Tabs: Файлы / Связи / Настройки / Профиль
│   │   ├── files/
│   │   │   ├── _layout.tsx       # Stack (index + [id] + add modal)
│   │   │   ├── index.tsx         # Файловый менеджер (drill-down по folder_id)
│   │   │   ├── [id].tsx          # Карточка файла
│   │   │   └── add.tsx           # Модал: загрузить / ссылка / папка
│   │   ├── connections/
│   │   │   ├── _layout.tsx
│   │   │   └── index.tsx         # Контакты + Запросы (segmented)
│   │   ├── settings/
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx         # Меню настроек
│   │   │   ├── tags.tsx          # Управление тегами
│   │   │   ├── security.tsx      # Пароль + сессии
│   │   │   └── support.tsx       # Тикеты техподдержки
│   │   └── profile/
│   │       ├── _layout.tsx
│   │       └── index.tsx         # Профиль + тариф + выход
│   └── link/
│       └── [token].tsx           # Публичная ссылка (модалка)
├── src/
│   ├── api/                      # API-модули (по группам эндпоинтов)
│   │   ├── client.ts             # Axios + Bearer-интерцептор
│   │   ├── auth.ts               # login, register, logout, me, password, sessions
│   │   ├── files.ts
│   │   ├── folders.ts
│   │   ├── tags.ts
│   │   ├── inbox.ts
│   │   ├── tariffs.ts
│   │   ├── contacts.ts           # contacts + contact-requests
│   │   ├── support.ts            # tickets + messages
│   │   └── links.ts
│   ├── store/
│   │   ├── auth.ts               # Zustand: token + user (SecureStore)
│   │   └── network.ts            # Zustand: online/offline
│   ├── hooks/                    # TanStack Query хуки
│   │   ├── useFiles.ts
│   │   ├── useFolders.ts
│   │   ├── useTags.ts
│   │   ├── useInbox.ts
│   │   └── useContacts.ts
│   ├── components/
│   │   ├── ui/                   # Button, Input, Spinner
│   │   └── OfflineBanner.tsx
│   ├── types/                    # TypeScript-типы из API
│   │   ├── auth.ts               # User (id: string/UUID), LoginPayload, RegisterPayload
│   │   ├── file.ts
│   │   ├── folder.ts             # Folder, FolderTreeNode
│   │   ├── contact.ts            # Contact, ContactRequest
│   │   ├── support.ts            # SupportTicketListItem, SupportTicketDetail
│   │   ├── tag.ts
│   │   ├── tariff.ts             # Tariff, TariffPlan, TariffPlanInfo
│   │   └── inbox.ts
│   └── utils/
│       ├── format.ts             # formatFileSize, formatDate
│       └── storage.ts
├── assets/
│   ├── icon.png                  # 1024×1024, сгенерирован из SVG-логотипа
│   ├── adaptive-icon.png
│   ├── splash-icon.png
│   ├── favicon.png
│   └── images/
│       └── logo.png              # 200×200, для экранов входа/регистрации
├── scripts/
│   └── generate-icon.mjs         # Генерация PNG-иконок из SVG (resvg-js)
├── app.json                      # Expo config (slug: delifile, scheme: delifile)
├── eas.json                      # EAS: development / preview / production
└── .env                          # EXPO_PUBLIC_API_URL=https://...
```
