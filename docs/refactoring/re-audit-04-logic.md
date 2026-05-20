# Re-аудит логических ошибок (после спринтов 1–12)

> **Дата:** 2026-05-20
> **Статус:** завершён 🔍

---

## 1. Access control

### 1.1 [CRITICAL] `SharedFolderFileController::addFile()` — нет проверки доступа к файлу

- **Файл:** `SharedFolderFileController.php:140`
- **Описание:** Проверяет права на редактирование *папки*, но НЕ проверяет, есть ли у пользователя доступ к *файлу*, который он добавляет. Участник общей папки может добавить любой существующий файл (зная ID), включая чужие приватные.
- **Предложение:** Добавить `$this->fileService->canAccess($user, $file)`.

### 1.2 [HIGH] `File::hasAccessFor()` — не учитывает shared folder membership

- **Файл:** `File.php:138`, `OrganizationController.php:325,362`
- **Описание:** `hasAccessFor()` проверяет только прямые `FileUserAccess`, но не доступ через shared folder. Пользователи с доступом через папку получают 404 при работе с тегами.
- **Предложение:** Заменить на `FileService::canAccess()` или дополнить `hasAccessFor()`.

### 1.3 [MEDIUM] `DocumentLockController::heartbeat()` — не перепроверяет права

- **Файл:** `DocumentLockController.php:49`
- **Описание:** При heartbeate не вызывается `canEditDocument()`. Если права отозваны между acquire и heartbeat, блокировка всё равно продлевается.
- **Предложение:** Добавить `canEditDocument()` после `isMarkdownDocument()`.

---

## 2. API консистентность

### 2.1 [MEDIUM] `SharedFolderController::formatFileCard()` — другой набор полей

- **Файл:** `SharedFolderController.php:94`
- **Описание:** Возвращает поля, отличные от `FileCardBuilder::buildListItem()`:

| Поле | buildListItem | formatFileCard |
|---|---|---|
| `display_name` | ✅ | ❌ |
| `has_versions` | ✅ | ❌ |
| `access_type` | ✅ | ❌ |
| `is_favorite` | ✅ | ❌ |
| `description` | ✅ | ❌ |
| `added_by` | ❌ | ✅ |
| `view_url` | ❌ | ✅ |

- **Предложение:** Переписать через `FileCardBuilder::buildListItem()` + добавить `added_by`.

### 2.2 [MEDIUM] `InboxController::files()` — несуществующие поля

- **Файл:** `InboxController.php:30-35`
- **Описание:** `'description' => $p->file->description` (всегда null — поле в `FileUserAccess`, а не `File`) и `'thumbnail_url' => $p->file->thumbnail_url ?? null` (всегда null — нет в модели).
- **Предложение:** Убрать или корректно загружать через `FileUserAccess`/`S3UrlService`.

---

## 3. Race conditions

### 3.1 [MEDIUM] `checkStorageQuota()` — TOCTOU

- **Файл:** `FileService.php:31-43`, `FileController.php:133-137`
- **Описание:** Между `validateStorageQuota()` (чтение квоты) и `initUpload()` (создание файла) другой параллельный запрос может также пройти проверку и превысить лимит.
- **Предложение:** Перенести проверку квоты внутрь транзакции в `initUpload()` с `SELECT ... FOR UPDATE`.

### 3.2 [MEDIUM] `FileService::pin()` — не атомарно

- **Файл:** `FileService.php:248`
- **Описание:** `if ($access) { update } else { create }` — два параллельных `pin()` от одного пользователя могут вызвать duplicate key.
- **Предложение:** Заменить на `FileUserAccess::firstOrCreate(...)`.

### 3.3 [LOW] `DocumentService::saveDocument()` — ETag check и S3 write не атомарны

- **Файл:** `DocumentService.php:110`
- **Описание:** Валидация ETag и запись в S3 вне одной транзакции. Другой запрос может изменить файл между ними.
- **Предложение:** Добавить `File::where('id', $id)->where('etag', $clientEtag)->update(...)` как optimistic lock.

---

## 4. Edge cases

### 4.1 [MEDIUM] `FileController::content()`/`preview()` — не проверяют `storage_key` у url_file

- **Файл:** `FileController.php:254-291`
- **Описание:** `url_file` имеет статус `Available` и `storage_key = null`. `content()` и `preview()` проверяют `isAvailable()` и `canAccess()`, но не проверяют `storage_key` или `isUrlFile()`. Передача `null` в `S3UrlService::contentRedirectUrl()` / `previewRedirectUrl()` упадёт с S3 Exception.
- **Предложение:** Добавить `if ($file->isUrlFile()) abort(404)`.

### 4.2 [MEDIUM] `FileService::setFavorite()` — молча ничего не делает

- **Файл:** `FileService.php:305`
- **Описание:** Если у пользователя нет прямой записи `FileUserAccess` (доступ только через shared folder), `setFavorite()` не создаёт запись, а молча ничего не делает. Активность при этом логируется.
- **Предложение:** Создавать `FileUserAccess` с `Saved` при первом флаге `is_favorite`, или возвращать ошибку.

### 4.3 [LOW] `SharedFolderFileController::addFile()` — не проверяет статус файла

- **Файл:** `SharedFolderFileController.php:140`
- **Описание:** Не проверяется `$file->isAvailable()`. Файл со статусом `uploading` или `deleted` может быть добавлен в общую папку.
- **Предложение:** Добавить `if (!$file->isAvailable())`.

### 4.4 [LOW] `FileService::moveToFolder()` — молча не делает ничего

- **Файл:** `FileService.php:322`, `FileController.php:356`
- **Описание:** Если у пользователя нет прямой записи `FileUserAccess`, `moveToFolder()` обновляет 0 строк и возвращает success.
- **Предложение:** Проверять количество обновлённых строк.

---

## 5. Прочее

### 5.1 [LOW] `SharedFolderLink::isValid()` — строка вместо enum

- **Файл:** `SharedFolderLink.php:54`
- **Описание:** `$this->status === 'active'` — жёсткая строка, хотя в других методах используется `ShareLinkStatus::Active->value`.
- **Предложение:** Заменить.

### 5.2 [LOW] `FileService::setTags()` — без транзакции

- **Файл:** `FileService.php:336`
- **Описание:** DELETE + несколько INSERT без единой транзакции. При сбое теги в частичном состоянии.
- **Предложение:** Обернуть в `DB::transaction()`.

---

## 6. Подтверждено исправленным

- `FileCardBuilder::buildCard()` — ✅ `is_pinned` по `pinned_at`, `expires_at` из модели
- `FileService::listFiles()` — ✅ фильтр `status=Available`
- `cancelUpload()` — ✅ проверка `FileStatus::Uploading`
- `DocumentService::canEditDocument()` — ✅ обход shared folder предков
- `FileVersionController::initUpload()` — ✅ `validateFileSizeLimit()`
- `locks:clean` — ✅ команда + расписание каждые 5 минут

---

## Сводка

| Severity | Всего | Проблемы |
|---|---|---|
| **CRITICAL** | 1 | addFile() без проверки доступа к файлу |
| **HIGH** | 1 | hasAccessFor() без shared folder |
| **MEDIUM** | 6 | heartbeat, formatFileCard поля, InboxController поля, TOCTOU, pin() race, content/preview url_file |
| **LOW** | 6 | addFile статус, setFavorite, moveToFolder, isValid() enum, setTags транзакция, saveDocument optimistic lock |
