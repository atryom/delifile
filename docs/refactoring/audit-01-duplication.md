# Аудит дублирования кода

> **Дата:** 2026-05-20
> **Статус:** завершён 🔍

## Методология

Поиск inline access/permission checks, прямых `Storage::disk('s3')` для URL вне `S3UrlService`, MIME-логики вне `MimeService`, построения карточек вне `FileCardBuilder`, повторяющихся запросов, захардкоженных enum-строк, фронтенд-дублей formatSize/classifyMimeType.

---

## 1. Прямые проверки доступа вне FileService

### 1.1 [HIGH] `SharedFolderFileController::canAccessSharedFolder()` — полная копия `SharedFolderController::canAccess()`

- **Файл:** `backend/app/Http/Controllers/Files/SharedFolderFileController.php:21-37`
- **Описание:** Собственная реализация проверки доступа к shared folder с обходом предков. Идентична `SharedFolderController::canAccess()` (строки 43-73). В docblock написано «mirrors SharedFolderController::canAccess()».
- **Централизованная версия:** `SharedFolderController::canAccess()`
- **Решение:** Удалить дублирующий метод, в `SharedFolderFileController` инжектировать `SharedFolderController` (или вынести общий трейт/сервис).

### 1.2 [HIGH] `DocumentService::canEditDocument()` — дублирует `FileService::canAccess()`

- **Файл:** `backend/app/Services/DocumentService.php:152-164`
- **Описание:** Самостоятельно делает `FileUserAccess::where(...)` вместо вызова `$this->fileService->canAccess()`. При этом `canViewDocument()` (строка 166) уже делегирует в `FileService::canAccess()`.
- **Централизованная версия:** `FileService::canAccess()`
- **Решение:** Переписать `canEditDocument()` через `$this->fileService->canAccess($user, $file, 'edit')` (после добавления поддержки `requiredType` в `FileService::canAccess()`).

### 1.3 [MEDIUM] `CommentService::canAccessFile()` — дублирует `FileService::canAccess()`

- **Файл:** `backend/app/Services/CommentService.php:351-364`
- **Описание:** Собственная реализация проверки доступа к файлу: проверяет owner, `file->accesses()`, потом shared folders. Логически эквивалентна `FileService::canAccess()`, но реализована заново.
- **Централизованная версия:** `FileService::canAccess()`
- **Решение:** Инжектировать `FileService` в `CommentService` и заменить `canAccessFile()` на `$this->fileService->canAccess($user, $file)`.

### 1.4 [HIGH] `CommentService::canAccessSharedFolder()` — не учитывает наследование

- **Файл:** `backend/app/Services/CommentService.php:366-374`
- **Описание:** Проверяет доступ к shared folder только на первом уровне (без обхода родителей). Упрощённая версия `SharedFolderController::canAccess()`, которая обходит всю цепочку предков.
- **Централизованная версия:** `SharedFolderController::canAccess()`
- **Решение:** Делегировать в `SharedFolderController::canAccess()` или в `FileService::canAccessSharedFolder()`, если такой метод будет вынесен.

### 1.5 [HIGH] `CommentSettingsController::canManageSharedFolder()` — не учитывает наследование

- **Файл:** `backend/app/Http/Controllers/Comments/CommentSettingsController.php:180-187`
- **Описание:** Проверяет owner или `SharedFolderAccess` с `access_type = 'edit'` только для текущей папки (без обхода предков).
- **Централизованная версия:** `SharedFolderController::canAccess()`
- **Решение:** Делегировать в централизованный метод.

### 1.6 [MEDIUM] `FilePolicy::view()` — не учитывает shared folders

- **Файл:** `backend/app/Policies/FilePolicy.php:14-23`
- **Описание:** Делает свою проверку через `FileUserAccess::where(...)`, не учитывая shared folders.
- **Централизованная версия:** `FileService::canAccess()`
- **Решение:** Делегировать в `FileService::canAccess()`.

---

## 2. Storage::disk('s3') для URL вне S3UrlService

### 2.1 [MEDIUM] `SupportAttachmentService::temporaryUrl()` — presigned URL вне S3UrlService

- **Файл:** `backend/app/Services/SupportAttachmentService.php:102`
- **Описание:** Вызывает `$disk->temporaryUrl(...)` для вложений техподдержки. Хотя это может быть не S3-диск, логика presigned URL дублируется.
- **Решение:** Создать единый сервис для presigned URL всех дисков или вынести логику в абстракцию.

---

## 3. MIME-классификация вне MimeService

### 3.1 [MEDIUM] `S3UrlService::resolvePreviewAndViewUrls()` — inline MIME-чеки

- **Файл:** `backend/app/Services/S3UrlService.php:71,75,80`
- **Описание:** `str_starts_with($mime, 'image/')`, `str_starts_with($mime, 'video/')`, `str_starts_with($mime, 'audio/')`, `str_contains($mime, 'pdf')` — дублирует `MimeService::isPreviewable()` и `MimeService::isViewableInBrowser()`.
- **Централизованная версия:** `MimeService::isPreviewable()`, `MimeService::isViewableInBrowser()`
- **Решение:** Инжектировать `MimeService` в `S3UrlService` и заменить inline-проверки.

### 3.2 [MEDIUM] `S3UrlService::resolveListPreviewUrl()`, `resolveVersionPreviewUrl()`, `resolveOgImageUrl()` — inline MIME-чеки

- **Файл:** `backend/app/Services/S3UrlService.php:93,96,108,111,125`
- **Описание:** Аналогичные inline-проверки.
- **Централизованная версия:** `MimeService`
- **Решение:** Делегировать в `MimeService`.

### 3.3 [LOW] `DocumentService::getAccessibleImages()` — захардкоженный список image MIME

- **Файл:** `backend/app/Services/DocumentService.php:254`
- **Описание:** `$imageMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];` — жёсткий список, не использующий `MimeService`.
- **Централизованная версия:** `MimeService::classify()` или `MimeService::getGroup('image/')`
- **Решение:** Заменить на вызов `MimeService`.

### 3.4 [MEDIUM] Frontend: inline MIME checks вместо `classifyMimeType()` / `canViewInBrowser()`

- **Файлы:**
  - `frontend/src/app/features/files/pages/public-link/public-link.component.ts:106-109`
  - `frontend/src/app/features/shared-folders/pages/shared-folders/shared-folders.component.ts:20-24` (HIGH — отдельная функция вне компонента)
  - `frontend/src/app/features/folders/pages/folders-tree/folders-tree.component.ts:1128-1138`
  - `frontend/src/app/features/shared-folders/pages/public-shared-link/public-shared-link.component.ts:184-187`
- **Централизованная версия:** `shared/utils/file.ts:classifyMimeType()`, `canViewInBrowser()`
- **Решение:** Заменить inline-проверки на вызовы `classifyMimeType()` / `canViewInBrowser()`.

---

## 4. Inline-построение карточек файлов вне FileCardBuilder

### 4.1 [HIGH] `SharedFolderController::formatFileCard()` — полная копия `FileCardBuilder::buildListItem()`

- **Файл:** `backend/app/Http/Controllers/SharedFolders/SharedFolderController.php:90-123`
- **Описание:** Вручную собирает массив с ключами `'id'`, `'original_name'`, `'content_kind'`, `'size'`, `'mime_type'`, `'preview_url'`, `'view_url'`, `link_*` и т.д. Почти идентично `FileCardBuilder::buildListItem()`.
- **Централизованная версия:** `FileCardBuilder::buildListItem()`, `FileCardBuilder::buildCard()`
- **Решение:** Добавить в `FileCardBuilder` метод `buildSharedFolderFileCard()` с полями `added_by`, `shared_folder_only` и заменить вызовы.

### 4.2 [HIGH] `SharedFolderController::publicFiles()` — inline-карточка для публичного просмотра

- **Файл:** `backend/app/Http/Controllers/SharedFolders/SharedFolderController.php:897-921`
- **Описание:** В лямбде вручную собирает массив. Дублирует `FileCardBuilder::buildPublicItem()`.
- **Централизованная версия:** `FileCardBuilder::buildPublicItem()`
- **Решение:** Заменить на `$this->cardBuilder->buildPublicItem($file)`.

### 4.3 [MEDIUM] `DocumentService::formatImageItem()` — ручное построение объекта изображения

- **Файл:** `backend/app/Services/DocumentService.php:349-370`
- **Описание:** Собирает вручную массив с полями. Частично дублирует `FileCardBuilder`.
- **Централизованная версия:** `FileCardBuilder::buildListItem()`
- **Решение:** Делегировать в `FileCardBuilder`.

### 4.4 [LOW] `InboxController::files()` — inline-построение данных файла

- **Файл:** `backend/app/Http/Controllers/User/InboxController.php:26-43`
- **Описание:** Вручную собирает `'id'`, `'original_name'`, `'size'`, `'mime_type'`.
- **Решение:** Использовать `FileCardBuilder::buildPublicItem()`.

---

## 5. Повторяющиеся запросы

### 5.1 [MEDIUM] `FileUserAccess::where('file_id', ...)->where('user_id', ...)` — 12+ раз в 8 классах

- **Файлы:** `FileService.php`, `FileCardBuilder.php`, `SharedFolderFileController.php`, `SharingController.php`, `FileController.php`, `DocumentService.php`, `FilePolicy.php`
- **Решение:** Создать единый метод `FileService::getUserAccess(File $file, User $user): ?FileUserAccess`.

### 5.2 [MEDIUM] `SharedFolderAccess::where('shared_folder_id', ...)` — 9 раз в 5 классах

- **Файлы:** `SharedFolderController.php`, `FileService.php`, `SharedFolderFileController.php`, `CommentService.php`, `CommentSettingsController.php`
- **Решение:** Создать единый метод в `SharedFolderController` или вынести в трейт.

---

## 6. Захардкоженные enum-строки

### 6.1 [MEDIUM] `'edit'` / `'view'` вместо `SharedFolderAccessType` enum

- **Файлы:** `SharedFolderController.php:62,281,433,474,525,559,715`, `SharedFolderFileController.php:29-30`, `CommentSettingsController.php:185`
- **Решение:** Заменить на `SharedFolderAccessType::Edit->value`, `SharedFolderAccessType::View->value`.

### 6.2 [MEDIUM] `'active'` / `'disabled'` вместо `ShareLinkStatus` enum

- **Файл:** `SharedFolderController.php:821,862`
- **Решение:** Заменить на `ShareLinkStatus::Active->value`, `ShareLinkStatus::Disabled->value`.

### 6.3 [LOW] `'uploading'` вместо `FileStatus::Uploading->value`

- **Файл:** `FileVersionController.php:71,75`
- **Решение:** Заменить.

### 6.4 [LOW] `'shared'` / `'saved'` вместо `AccessType` enum

- **Файлы:** `FileController.php:439`, `OrganizationController.php:35,64`, `DocumentController.php:142`, `SharingController.php:158`
- **Решение:** Заменить.

### 6.5 [LOW] `'text/markdown'` захардкожено в 2 местах

- **Файлы:** `DocumentService.php:22` (константа — OK), `DocumentController.php:45,76`
- **Решение:** Использовать `DocumentService::MIME_TYPE`.

---

## 7. Frontend: formatSize / classifyMimeType

### 7.1 [LOW] `tariffs.component.ts:47-48` — локальный `formatBytes()`

- **Файл:** `frontend/src/app/features/tariffs/pages/tariffs/tariffs.component.ts:47-48`
- **Описание:** `formatBytes()` частично дублирует `formatSize()` — возвращает `'0 МБ'` для нуля вместо `'—'`.
- **Централизованная версия:** `shared/utils/format.ts`
- **Решение:** Удалить локальный метод, использовать `formatSize()`.

---

## Сводка

| Severity | Всего | Ключевые файлы |
|---|---|---|
| **HIGH** | 7 | SharedFolderFileController, DocumentService, CommentService, CommentSettingsController, SharedFolderController (formatFileCard, publicFiles), shared-folders.component.ts |
| **MEDIUM** | 7 | SupportAttachmentService, S3UrlService (MIME-чеки), 4 frontend inline MIME, DocumentService formatImageItem, дубли запросов, enum-строки |
| **LOW** | 5 | DocumentService imageMimes, InboxController, FileVersionController, AccessType строки, tariffs |
