# Аудит логических ошибок и нестыковок

> **Дата:** 2026-05-20
> **Статус:** завершён 🔍

## Методология

Поиск: access control несоответствия, API консистентность, race conditions, edge cases, конфигурация.

---

## 1. Access control

### 1.1 [HIGH] `DocumentService::canEditDocument()` не учитывает shared folder edit access

- **Файл:** `backend/app/Services/DocumentService.php:152-164`
- **Описание:** Проверяет только `FileUserAccess` с `access_type = Shared` и `can_edit = true`. Если документ лежит в общей папке (SharedFolder), где пользователь имеет доступ `edit`, метод всё равно вернёт `false`.
- **Код:**
  ```php
  $access = FileUserAccess::where('file_id', $file->id)
      ->where('user_id', $user->id)
      ->where('access_type', AccessType::Shared)
      ->first();
  return $access?->can_edit === true;
  ```
- **Предложение:** Добавить проверку через shared folder: если `FileService::canAccess($user, $file)`, то также проверить `$file->sharedFolder?->accesses()?->where('user_id', $user->id)->where('access_type', 'edit')`.

### 1.2 [MEDIUM] `SharedFolderFileController::canAccessSharedFolder()` без cycle guard

- **Файл:** `backend/app/Http/Controllers/Files/SharedFolderFileController.php:21-37`
- **Описание:** В `SharedFolderController::canAccess()` и `FileService::canAccess()` есть массив `$visited`. В `SharedFolderFileController::canAccessSharedFolder()` такой защиты нет — при циклической ссылке `parent_id` будет бесконечный цикл.
- **Предложение:** Добавить `$visited = []` и `isset($visited[$current->id])` с `break`.

### 1.3 [MEDIUM] `FileController::destroy()` не проверяет `canAccess()` консистентно

- **Файл:** `backend/app/Http/Controllers/Files/FileController.php:91-114`
- **Описание:** Для не-владельца проверяется только существование `FileUserAccess`, но не `canAccess()` через shared folder. Пользователь с доступом через shared folder не может detach, но и не получает внятной ошибки.
- **Предложение:** Добавить `$this->fileService->canAccess($user, $file)` для консистентности с другими методами.

### 1.4 [LOW] `SharingController::disableLink()` проверяет только `created_by`, не владельца файла

- **Файл:** `backend/app/Http/Controllers/Files/SharingController.php:313`
- **Описание:** Если пользователь A (владелец) поделился файлом с B, и B создал share link, то A не может отключить эту ссылку.
- **Предложение:** Разрешить отключение создателю ссылки или владельцу файла: `if ($link->created_by !== $user->id && !$link->file->isOwnedBy($user))`.

---

## 2. API консистентность

### 2.1 [HIGH] `FileCardBuilder::buildCard()` — `is_pinned` всегда `false`

- **Файл:** `backend/app/Services/FileCardBuilder.php:40`
- **Описание:** `'is_pinned' => false`, хотя `$access->pinned_at` существует в БД. Метка «закреплён» никогда не отображается.
- **Предложение:** `'is_pinned' => $access?->pinned_at !== null`.

### 2.2 [HIGH] `FileCardBuilder::buildCard()` — `expires_at` всегда `null`

- **Файл:** `backend/app/Services/FileCardBuilder.php:36`
- **Описание:** `'expires_at' => null`, а в `buildListItem()` (строка 99) читается из модели `$file->expires_at?->toIso8601String()`. Несоответствие: в детальном просмотре дата истечения не показывается.
- **Предложение:** `'expires_at' => $file->expires_at?->toIso8601String()`.

### 2.3 [LOW] Различия полей `buildCard()` vs `buildListItem()`

- **Файл:** `backend/app/Services/FileCardBuilder.php`
- **Описание:** `folder_id`, `shared_folder_only`, `tags`, `view_url`, `link_description` есть в карточке, но не в списке.
- **Предложение:** Добавить `folder_id` и `link_description` в `buildListItem()`.

---

## 3. Race conditions

### 3.1 [MEDIUM] `checkStorageQuota()` — TOCTOU race condition

- **Файл:** `backend/app/Services/FileService.php:31-43`
- **Описание:** Читает текущий объём → сравнивает с лимитом → создаёт файл. Между проверкой и созданием параллельный запрос может создать ещё один файл, превысив лимит.
- **Предложение:** Выполнять проверку внутри транзакции с `SELECT SUM(size) ... FOR UPDATE`.

### 3.2 [MEDIUM] `cancelUpload()` — нет `where('status', Uploading)`

- **Файл:** `backend/app/Services/FileService.php:141-150`
- **Описание:** Безусловно устанавливает `Deleted`. Если параллельно выполняется `completeUpload()` (с оптимистичной блокировкой), обе операции могут сработать — одна установит `Available`, другая `Deleted`.
- **Предложение:** Использовать `where('id', $id)->where('status', FileStatus::Uploading)->update(...)`.

---

## 4. Edge cases

### 4.1 [HIGH] `FileService::listFiles()` не фильтрует по статусу `Available`

- **Файл:** `backend/app/Services/FileService.php:422`
- **Описание:** Запрос списка файлов не содержит фильтрации по статусу. Файлы со статусом `uploading`, `expired` и `processing` будут отображаться в списках.
- **Код:** `$query = File::query()->whereNull('deleted_at');` — отсутствует `->where('status', FileStatus::Available)`.
- **Предложение:** Добавить `->where('status', FileStatus::Available)`.

### 4.2 [LOW] `InboxController::files()` — несуществующие поля File

- **Файл:** `backend/app/Http/Controllers/User/InboxController.php:32,35`
- **Описание:** `$p->file->description` (нет в File) и `$p->file->thumbnail_url` (нет в БД) — оба всегда `null`.
- **Предложение:** Убрать поля или корректно подтягивать через `FileUserAccess`/`S3UrlService`.

### 4.3 [LOW] `FileVersionController::initUpload()` не проверяет file size limit

- **Файл:** `backend/app/Http/Controllers/Files/FileVersionController.php:56-58`
- **Описание:** Проверяется только storage quota, но не `validateFileSizeLimit()`.
- **Предложение:** Добавить `$this->fileService->validateFileSizeLimit($user, $data['size'])`.

### 4.4 [LOW] Файлы `shared_folder_only=true` становятся сиротами при удалении shared folder

- **Описание:** При удалении shared folder файл с `shared_folder_only=true` остаётся без связей и не отображается.
- **Предложение:** При удалении последней связи с shared folder устанавливать `shared_folder_only = false`.

### 4.5 [LOW] DocumentLock — нет garbage collector

- **Описание:** После `saveDocument()` блокировка не снимается (by design — клиент решает). Нет фоновой задачи для очистки истёкших блокировок.
- **Предложение:** Добавить artisan-команду для очистки истёкших блокировок (`created_at < now() - 5 min`) и запускать по расписанию.

---

## 5. Конфигурация / миграции

### 5.1 [LOW] `checkStorageQuota()` — версии в статусе `Uploading` не учитываются

- **Файл:** `backend/app/Services/FileService.php:37-40`
- **Описание:** Квота учитывает только версии со статусом `Available`. Версии в статусе `Uploading` уже занимают место в S3, но не учтены.
- **Предложение:** Учитывать версии со статусом `uploading` в расчёте квоты.

### 5.2 [LOW] `FileService::canAccess()` — `isOwnedBy()` работает по `owner_id`, а `FileUserAccess` с Owner создаётся позже

- **Файл:** `backend/app/Services/FileService.php:155`
- **Описание:** Файл может быть создан от имени user A, но запись `FileUserAccess` с `access_type = Owner` будет создана только в `completeUpload()`. До этого `isOwnedBy()` работает корректно через `owner_id`.
- **Статус:** Не ошибка, но стоит учитывать при рефакторинге.

---

## Сводка

| Severity | Всего | Ключевые проблемы |
|---|---|---|
| **HIGH** | 4 | canEditDocument без shared folder, is_pinned всегда false, expires_at null, listFiles без фильтра статуса |
| **MEDIUM** | 3 | Нет cycle guard в SharedFolderFileController, TOCTOU в checkStorageQuota, cancelUpload race condition |
| **LOW** | 8 | disableLink для owner, InboxController поля, file size limit версий, shared_folder_only orphans, DocumentLock GC, uploading версии в квоте |

---

## Пересечения с другими аудитами

| Проблема | audit-01 | audit-02 | audit-03 |
|---|---|---|---|
| `cancelUpload()` без проверки статуса | — | — | ✅ HIGH |
| `SharedFolderFileController` без cycle guard | ✅ HIGH | — | — |
| `FileService::canAccess()` — SharedFolder::find() в цикле | — | ✅ HIGH | — |
