# Re-аудит² дублирования кода (после спринтов 1–17)

> **Дата:** 2026-05-20
> **Статус:** завершён 🔍
> **Раунд:** 3-й финальный аудит

---

## 🔴 P1 — CRITICAL (enum-строки при существующем enum)

### 1.1 `FileService.php:210` — `['available', 'uploading']` вместо `FileStatus` enum

- **Файл:** `backend/app/Services/FileService.php:210`
- **Код:** `->whereIn('status', ['available', 'uploading'])`
- **Описание:** В `deleteFile()` при сборе S3-ключей версий. `FileStatus` enum существует и импортирован.
- **Решение:** `[FileStatus::Available->value, FileStatus::Uploading->value]`

### 1.2 `FileVersionController.php` — 6× `'available'` вместо `FileStatus::Available->value`

- **Файл:** `backend/app/Http/Controllers/Files/FileVersionController.php`

| Строка | Контекст |
|--------|----------|
| 137 | `'status' => 'available'` — create первой версии |
| 142 | `->where('status', 'available')` — max version_number |
| 150 | `'status' => 'available'` — update версии |
| 167 | `'status' => 'available'` — response |
| 186 | `->where('status', 'available')` — update версии |
| 254 | `->where('status', 'available')` — download версии |

- **Описание:** Пропущено в Sprint 12 (исправляли `'uploading'` в этом же файле). `FileStatus` импортирован.
- **Решение:** Все 6 → `FileStatus::Available->value`

### 1.3 `OrganizationController.php:37,66` — `['shared', 'saved']` вместо `AccessType` enum

- **Файл:** `backend/app/Http/Controllers/Organization/OrganizationController.php:37,66`
- **Код:** `->orWhereIn('file_user_access.access_type', ['shared', 'saved'])`
- **Описание:** В подзапросах `files_count` и `listFolders`. `AccessType` не импортирован.
- **Решение:** `[AccessType::Shared->value, AccessType::Saved->value]` + import

### 1.4 `AdminController.php:187-200` — 4× `['deleted']` вместо `FileStatus::Deleted->value`

- **Файл:** `backend/app/Http/Controllers/Admin/AdminController.php:187,188,196,200`
- **Код:** `File::whereNotIn('status', ['deleted'])`
- **Описание:** В `stats()` — 4 копии. `FileStatus` не импортирован.
- **Решение:** `FileStatus::Deleted->value` + import

---

## 🟡 P2 — MODERATE (enum-строки при существующем enum)

### 2.1 `SharedFolderController.php` — `'view'`/`'edit'` строки

| Строка | Контекст |
|--------|----------|
| 47 | `string $requiredType = 'view'` — default-параметр |
| 403 | `$this->canAccess($user, $folder, 'view')` |
| 444 | `$this->canAccess($user, $folder, 'edit')` |
| 495 | `$this->canAccess($user, $folder, 'edit')` |
| 529 | `$this->canAccess($user, $folder, 'edit')` |
| 781 | `'in:view,edit'` — validation rule |

- **Решение:** Заменить на `SharedFolderAccessType::View->value` / `Edit->value`. Правило `'in:' . SharedFolderAccessType::View->value . ',' . SharedFolderAccessType::Edit->value`.

### 2.2 `SharedFolderFileController.php` — `'view'`/`'edit'` строки

| Строка | Контекст |
|--------|----------|
| 24 | `string $requiredType = 'view'` — default-параметр |
| 110 | `$this->canAccessSharedFolder($user, $folder, 'edit')` |
| 163 | `$this->canAccessSharedFolder($user, $folder, 'edit')` |
| 194 | `$this->canAccessSharedFolder($user, $folder, 'edit')` |

- **Решение:** Заменить на `SharedFolderAccessType::View->value` / `Edit->value`.

### 2.3 `CommentThreadController.php:50` — `['shared', 'all']` вместо `CommentScope` enum

- **Файл:** `backend/app/Http/Controllers/Comments/CommentThreadController.php:50`
- **Код:** `in_array($scope, ['shared', 'all'])`
- **Решение:** `CommentScope::Shared->value`

---

## 🔵 P3 — LOW (нет enum / незначительное дублирование)

### 3.1 `InboxController.php:31-37` — inline file card

- **Файл:** `backend/app/Http/Controllers/User/InboxController.php:31-37`
- **Описание:** Ручное построение массива файла. Поля дублируют `FileCardBuilder`.
- **Решение:** Делегировать в `FileCardBuilder`.

### 3.2 `DocumentController.php:46,77` — inline MIME-чека `'text/markdown'`

- **Файл:** `backend/app/Http/Controllers/Documents/DocumentController.php:46,77`
- **Описание:** Прямая проверка MIME-типа. Можно добавить метод `MimeService::isMarkdown()`.
- **Решение:** `MimeService::isMarkdown()`.

### 3.3 4× duplicate attachment formatters

- **Файлы:**
  - `SupportAdminController.php:265-270`
  - `SupportTicketController.php:309-314`
  - `SuggestionAdminController.php:137-139`
  - `SuggestionController.php:140-145`
- **Описание:** Идентичные массивы `['id','original_name','mime_type','size']` в 4 форматерах.
- **Решение:** Единый `formatAttachment()`.

### 3.4 Status-строки (нет enum — но дублируются)

| Файл | Строки | Строки статусов |
|------|--------|-----------------|
| `SupportTicketController.php` | 77, 153, 154, 194, 200, 201, 206 | `'new'`, `'awaiting_confirmation'`, `'in_progress'`, `'completed'` |
| `SupportAdminController.php` | 85, 89, 91, 105, 110, 119 | `'new'`, `'in_progress'`, `'awaiting_confirmation'` |
| `AutoCloseTickets.php` | 17, 26, 27 | `'awaiting_confirmation'`, `'completed'` |
| `SupportTicket.php` (модель) | 48 | `'completed'` |
| `InvitationService.php` | 105-107 | `'pending'`, `'expired'` |
| `InvitationController.php` | 48 | `'expired'` |
| `CommentController.php` | 142, 183 | `'create'`, `'edit'` (audit action) |
| `SharingController.php` | 158 | `'shared'` |

- **Решение:** Создать `SupportTicketStatus`, `InvitationStatus`, `CommentAuditAction` enum.

---

## ✅ Подтверждено — чисто

| Категория | Результат |
|-----------|-----------|
| `Storage::disk('s3')->temporaryUrl()` вне S3UrlService | ✅ Все вызовы внутри S3UrlService |
| Frontend `formatSize` без импорта из shared/ | ✅ Все компоненты импортируют |
| Frontend `classifyMimeType` без импорта из shared/ | ✅ Все компоненты импортируют |
| `formatFileCard` дубль | ✅ Удалён в Sprint 15 |
| `FileCardBuilder` используется в SharedFolder/FileController | ✅ |
| `CleanExpiredFilesJob` enum | ✅ Уже использует `FileStatus::Available->value` |
| account_status строки | ✅ Исключено (нет UserStatus enum) |

---

## Сводка

| Severity | Всего | Ключевые файлы |
|---|---|---|
| **CRITICAL (P1)** | 4 | FileVersionController (6×), FileService, OrganizationController, AdminController |
| **MODERATE (P2)** | 6 | SharedFolderController (6×), SharedFolderFileController (4×), CommentThreadController |
| **LOW (P3)** | 10 | InboxController, DocumentController, 4× attachment, status-строки в 8 файлах |
