# Аудит мобильного приложения (Expo / React Native)

## Общая информация

| Параметр | Значение |
|----------|----------|
| Фреймворк | Expo SDK 54 + expo-router |
| Язык | TypeScript (strict) |
| Серверное состояние | `@tanstack/react-query` v5 |
| Клиентское состояние | `zustand` v5 (auth + network) |
| HTTP-клиент | `axios` v1.16 |
| Строк кода | ~3 100 |
| Тестирование | Отсутствует |
| Размер APK | — |

---

## 1. Дублирование с веб-фронтендом

### 1.1. TypeScript-интерфейсы (~80% копия)

**Проблема:** Типы данных продублированы между Angular (frontend) и React Native (mobile). Один и тот же контракт API описан в двух местах.

**Сравнение:**

| Модель | Mobile (`src/types/`) | Frontend (`shared/models/api.models.ts`) |
|--------|----------------------|------------------------------------------|
| `ApiResponse<T>` | `types/index.ts` | `api.models.ts:4-8` |
| `PaginatedData<T>` | `types/index.ts` | `api.models.ts:30-33` |
| `FileListItem` | `types/file.ts` | `api.models.ts` |
| `FileCard` | `types/file.ts` | `api.models.ts` |
| `FileVersion` | `types/file.ts` | `api.models.ts` |
| `Contact` | `types/contact.ts` | `api.models.ts` |
| `ContactRequestItem` | `types/contact.ts` | `api.models.ts` |
| `InboxFile` | `types/inbox.ts` | `api.models.ts` |
| `TariffUsage` | `types/tariff.ts` | `api.models.ts` |
| `SupportTicketListItem` | `types/support.ts` | `api.models.ts` |
| `FolderTreeNode` | `types/folder.ts` | `api.models.ts` |
| `Tag` | `types/tag.ts` | `api.models.ts` |

**Стратегия:** Выделить общий пакет типов (`@delifile/types`) в монорепозитории. Либо генерировать типы из OpenAPI-спецификации Laravel.

### 1.2. API-методы (~60% копия)

**Проблема:** Методы API повторяют друг друга в Angular-сервисах и React Native хуках/API-слое.

**Пример (auth):**
- Mobile: `api/auth.ts` → `authApi.login()`, `authApi.register()`, `authApi.logout()`, `authApi.me()`...
- Frontend: `auth-api.service.ts` → те же методы с теми же параметрами

**Стратегия:** Создать единый API-клиент как npm-пакет или использовать codegen из Laravel routes.

### 1.3. Утилиты

- `src/utils/format.ts` — `formatFileSize()` (аналог `formatSize()` из веба)
- `getMimeIcon()` — аналог `mimeIcon()` веба

**Стратегия:** Те же утилиты, что и для веба, вынести в `@delifile/shared-utils`.

---

## 2. Отсутствие тестирования

**Проблема:** В мобильном приложении нет тестов. При рефакторинге API-слоя или хуков регрессии не отлавливаются.

**Стратегия:**
- Покрыть React Query хуки тестами (`@tanstack/react-query` testing utilities)
- API-слой тестировать с `msw` (mock service worker)
- Начать с `useFiles.ts` и `useInbox.ts` — как наиболее критичных

---

## 3. Обработка ошибок — 2 разных паттерна

**Проблема:** В приложении используются два разных подхода к обработке ошибок, что приводит к неконсистентному UX.

**Паттерн 1 (React Query):**
```tsx
if (isError) return <ErrorView onRetry={refetch} />;
```

**Паттерн 2 (try/catch с Alert):**
```tsx
try { await api.method() } catch (e: any) {
  Alert.alert('Ошибка', e.response?.data?.message ?? 'Не удалось...');
}
```

Некоторые экраны обрабатывают ошибки через Alert, другие — через ErrorView.

**Стратегия:**
- Единый `ErrorBoundary` для неожиданных ошибок
- Стандартизировать: мутации → toast/alert, запросы → ErrorView с кнопкой повтора

---

## 4. Нет офлайн-поддержки запросов

**Проблема:** React Query настроен с `refetchInterval` для инбокса и контактов, но при потере соединения:
- `useNetworkStore` показывает офлайн-баннер
- Данные не кешируются в persist (нет `@tanstack/react-query-persist-client`)
- При рефетче при офлайн — React Query возвращает ошибку, UI показывает ErrorView

**Стратегия:**
- Добавить `persistQueryClient` с AsyncStorage для офлайн-кеша
- При офлайн показывать закешированные данные + офлайн-баннер

---

## 5. Нет единого UI-кита

**Проблема:** В папке `src/components/ui/` есть базовые компоненты (`Button`, `Input`, `Spinner`), но:
- Только 3 компонента на всё приложение
- Часть UI (модалки, экшн-шиты, тулбары) реализованы инлайн на каждом экране
- Стили — inline `StyleSheet.create()` без общей темы

**Стратегия:**
- Создать минимальный UI-кит: `Modal`, `ActionSheet`, `Header`, `ErrorView`, `EmptyState`
- Вынести цветовую тему в единый объект

---

## 6. Экран `files/[id].tsx` — inline-логика

**Проблема:** Экран детального просмотра файла (119 строк) содержит прямую бизнес-логику:
- Загрузка карточки файла через `useFile(id)`
- Toggle favorite через `useToggleFavorite().mutateAsync()`
- Скачивание через `useDownloadUrl().mutateAsync()` + `Linking.openURL`

Это соответствует паттерну React Query, но при добавлении новой функциональности (комментарии, версии, шаринг) экран быстро разрастётся.

**Стратегия:**
- Вынести под-компоненты: `FileInfo`, `FileActions`, `FileMetadata`
- Использовать композицию, а не один большой экран

---

## 7. Размеры экранов (наибольшие)

| # | Файл | Строк |
|---|------|-------|
| 1 | `connections/index.tsx` | 327 |
| 2 | `files/index.tsx` | 209 |
| 3 | `settings/tags.tsx` | 179 |
| 4 | `profile/index.tsx` | 174 |
| 5 | `settings/support.tsx` | 173 |
| 6 | `settings/security.tsx` | 148 |
| 7 | `files/add.tsx` | 133 |
| 8 | `register.tsx` | 130 |
| 9 | `files/[id].tsx` | 119 |

Все экраны укладываются в разумные размеры (< 350 строк). Разбивка не требуется.

---

## Итоговая таблица проблем

| # | Проблема | Серьёзность | Стратегия |
|---|----------|-------------|-----------|
| 1 | Типы продублированы с вебом | Средняя | Общий пакет `@delifile/types` |
| 2 | API-методы продублированы с вебом | Средняя | Общий API-клиент / codegen |
| 3 | Нет тестов | Высокая | MSW + react-query-testing |
| 4 | Нестандартизированная обработка ошибок | Средняя | ErrorBoundary + единый подход |
| 5 | Нет офлайн-кеша | Низкая | persistQueryClient |
| 6 | Слабый UI-кит (3 компонента) | Низкая | Минимальный набор компонентов |
| 7 | `formatFileSize()` дублируется с вебом | Средняя | Общий `@delifile/shared-utils` |
| 8 | `getMimeIcon()` дублируется с вебом | Средняя | Общий `@delifile/shared-utils` |
