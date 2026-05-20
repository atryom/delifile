# Re-аудит дублирования кода (после спринтов 1–12)

> **Дата:** 2026-05-20
> **Статус:** завершён 🔍
> **Метод:** повторная проверка после фиксации 55 проблем из первого аудита.

---

## 1. Inline проверки доступа вне FileService

### 1.1 [HIGH] `FileUserAccess::where(...)` в контроллерах — не делегируют в `FileService`

| Файл | Строка | Контекст |
|------|--------|----------|
| `SharedFolderFileController.php` | 84, 209 | `->exists()` дублирует `FileService::canAccess()` |
| `FileController.php` | 105 | `destroy()`: inline delete вместо сервиса |
| `FileController.php` | 180 | `updateDescription()`: inline поиск `FileUserAccess` |
| `SharingController.php` | 109 | `shareToContact()`: inline поиск доступа шарера |
| `SharingController.php` | 181, 200 | `revokeContactAccess()`: inline удаление/проверка |
| `SharingController.php` | 405 | `saveViaLink()`: inline проверка существующего доступа |
| `ContactController.php` | 240 | inline проверка доступа |
| `OrganizationController.php` | 187, 201 | inline проверки |
| `DocumentController.php` | 140 | inline `['shared']` |
| `AdminController.php` | 190 | inline |
| `FilePolicy.php` | 20 | inline |

- **Решение:** Создать единый метод `FileService::getUserAccess(File $file, User $user): ?FileUserAccess` и использовать везде.

### 1.2 [HIGH] Три одинаковые реализации `canAccessSharedFolder()`

- `SharedFolderController::canAccess()` (строка 47)
- `SharedFolderFileController::canAccessSharedFolder()` (строка 22)
- `CommentService::canAccessSharedFolder()` (строка 369)

Все три реализуют один алгоритм: обход предков с cycle guard. Различаются только сигнатурой и типом `requiredType`.

- **Решение:** Вынести в `SharedFolderService` или статический хелпер.

### 1.3 [MEDIUM] `CommentService` — 5 собственных access-check методов

- `canAccessFile()` (строка 351) — дубль `FileService::canAccess()`
- `canAccessSharedFolder()` (строка 369) — дубль `SharedFolderController::canAccess()`
- `canAccessLocalFolder()` (строка 386)
- `fileUserCanWriteShared()` (строка 392)
- `sfUserCanWriteShared()` (строка 417)

- **Решение:** Инжектировать `FileService` + `SharedFolderService` в `CommentService`.

---

## 2. Storage::disk('s3') для URL вне S3UrlService

✅ **Чисто.** Все вызовы `temporaryUrl()` — внутри `S3UrlService`.

---

## 3. MIME-классификация вне MimeService

### 3.1 [HIGH] `S3UrlService` — 8 inline MIME-проверок

| Метод | Строки |
|-------|--------|
| `resolvePreviewAndViewUrls()` | 71, 75, 80 |
| `resolveListPreviewUrl()` | 93, 96 |
| `resolveVersionPreviewUrl()` | 108, 111 |
| `resolveOgImageUrl()` | 125 |

Все используют `str_starts_with($mime, 'image/')`, `str_starts_with($mime, 'video/')`, `str_starts_with($mime, 'audio/')`, `str_contains($mime, 'pdf')`.

- **Решение:** Инжектировать `MimeService` в `S3UrlService` и делегировать в `MimeService::isPreviewable()`, `MimeService::isViewableInBrowser()`, `MimeService::getGroup()`.

---

## 4. Построение карточек вне FileCardBuilder

### 4.1 [HIGH] `SharedFolderController::formatFileCard()` — всё ещё существует

- **Файл:** `SharedFolderController.php:94-127`
- **Описание:** Вручную собирает массив с `id`, `original_name`, `content_kind`, `size`, `mime_type`, `status`, `expires_at`, `uploaded_at`, `preview_url`, `view_url`, `link_*` и т.д. — полный дубль `FileCardBuilder::buildListItem()` + `buildCard()`. Парадокс: `SharedFolderController` уже импортирует `FileCardBuilder` (строка 19) и использует `$this->cardBuilder->buildPublicItem()` в `publicFiles()`, но для авторизованных пользователей продолжает использовать самописный `formatFileCard()`.
- **Решение:** Заменить на `FileCardBuilder::buildSharedFolderFileCard()` (добавить поля `added_by`, `shared_folder_only`).

---

## 5. Захардкоженные enum-строки

### 5.1 [HIGH] Backend — 25+ мест

| Файл | Строки | Проблема |
|------|--------|----------|
| `SharedFolderController.php` | 47, 437, 478, 529, 563 | `'view'`, `'edit'` |
| `SharedFolderFileController.php` | 22, 108, 153, 184 | `'view'`, `'edit'` |
| `File.php` (модель) | 145 | `'saved'` |
| `File.php` (модель) | 146 | `'active'` |
| `OrganizationController.php` | 35, 64 | `['shared', 'saved']` |
| `DocumentController.php` | 142 | `['shared']` |
| `User.php` (модель) | 75, 70 | `['active', 'pending_email_verification']` |
| `AdminController.php` | 82 | `'active'`, `'blocked_unverified_email'` |
| `TariffController.php` | 39 | `['deleted', 'uploading']` |
| `EmailVerificationService.php` | 41 | `'active'` |
| `FileCardBuilder.php` | 159 | `'available'` |
| `SharedFolderLink.php` | 54 | `'active'` |
| `SharingController.php` | 158 | `'shared'` |
| `CommentController.php` | 57, 181 | `'shared'`, `'edit'` |
| `CommentThreadController.php` | 50 | `['shared', 'all']` |

### 5.2 [MEDIUM] Frontend — множественные строки (отсутствуют TS enums)

- `folders-tree.component.ts` — `'local'`, `'shared'` (8 мест)
- `shared-folders.component.ts` — `'edit'`
- `file-list.component.ts` — `'uploading'`
- `markdown-editor.service.ts` — `'saved'`, `'unsaved'`, `'saving'`, `'error'`, `'quota'`
- и 20+ мест в шаблонах

---

## 6. Frontend: formatSize / classifyMimeType

✅ **Чисто.** Все 11 компонентов корректно импортируют из `shared/utils/format` и `shared/utils/file`.

---

## Сводка

| Severity | Всего | Ключевые проблемы |
|---|---|---|
| **HIGH** | 10+ | formatFileCard дубль, S3UrlService MIME-чеки, 3 реализации canAccess, FileUserAccess в контроллерах, enum-строки |
| **MEDIUM** | 14+ | CommentService access, frontend строки |
| **LOW** | 12+ | Мелкие enum-строки |
