# Re-аудит S3 хранилища (после спринтов 1–12)

> **Дата:** 2026-05-20
> **Статус:** завершён 🔍

---

## 1. S3-orphan при удалении файла

### 1.1 [HIGH] `FileService::deleteFile()` — не удаляет S3-объект

- **Файл:** `FileService.php:203-210`
- **Описание:** `deleteFile()` переводит файл в `Deleted`, делает soft-delete, но **не удаляет** `storage_key` и `thumbnail_key` из S3. `CleanExpiredFilesJob` не видит deleted-файлы (ищет только Available/Uploading с `deleted_at IS NULL`). S3-объект остаётся навсегда.
- **Предложение:** Диспатчить `CleanOrphanedS3ObjectJob` внутри `deleteFile()`, либо добавить в `CleanExpiredFilesJob` обработку deleted-файлов старше N дней.

### 1.2 [HIGH] `FileVersionController::completeUpload()` — старые версии не чистятся

- **Файл:** `FileVersionController.php:126-171`
- **Описание:** При создании новой версии `storage_key` заменяется на новый, старый сохраняется только в `FileVersion`. Старый ключ никогда не удаляется. Если у файла 10 версий — в S3 11 объектов (текущий + 10 старых).
- **Предложение:** При удалении файла собирать все `storage_key` и `thumbnail_key` из `versions()` и передавать в `CleanOrphanedS3ObjectJob`.

### 1.3 [MEDIUM] Orphan attachment'ов поддержки и предложений

- **Файлы:** `SupportTicketController.php`, `SuggestionController.php`, `SupportAdminController.php`, `SuggestionAdminController.php`
- **Описание:** `SupportAttachment` и `SuggestionAttachment` хранят `storage_key` в S3. При удалении тикета/предложения (нет endpoint'ов сейчас, но при появлении) S3-объекты не удаляются. Нет cleanup-джоба.
- **Предложение:** Добавить job или слушатель событий.

---

## 2. N+1 presigned URL

### 2.1 [MEDIUM] `FileCardBuilder::buildListItem()` — N presigned URL

- **Файл:** `FileCardBuilder.php:82-118`
- **Описание:** Каждый вызов `resolveListPreviewUrl()` генерирует presigned URL. При `per_page=20` — 20 вызовов `tryTemporaryUrl()`. Для image-файлов внутри `resolvePreviewAndViewUrls()` генерируются два URL для одного ключа.
- **Предложение:** Объединить `resolvePreviewAndViewUrls` и `resolveListPreviewUrl` для image (preview_url = view_url). Кэшировать через `once()` или request cache.

### 2.2 [MEDIUM] `FileCardBuilder::buildVersionsList()` — N presigned URL

- **Файл:** `FileCardBuilder.php:156-165`
- **Описание:** Для каждой версии файла `resolveVersionPreviewUrl()` — отдельный temporaryUrl.
- **Предложение:** Ленивая генерация (только для отображаемых) или кэш.

---

## 3. DocumentService — прямой Storage::disk('s3')

### 3.1 [LOW] Разнобой в обращении к S3

- **Файл:** `DocumentService.php:51,82,99,133`
- **Описание:** Прямые `Storage::disk('s3')->put()` и `->get()`. Нет try/catch, нет единого логгирования (в S3UrlService есть).
- **Предложение:** Вынести put/get в S3UrlService как `fetchContent()` и `storeContent()`.

---

## 4. SupportAttachmentService — config('filesystems.default')

### 4.1 [LOW] Неявный диск вместо явного 's3'

- **Файл:** `SupportAttachmentService.php:65,85,103`
- **Описание:** Использует `Storage::disk(config('filesystems.default'))` — если кто-то сменит на local, вложения поддержки упадут в локальную ФС. В `downloadUrl()` при падении `tryTemporaryUrl()` возвращает `->url()` (публичный S3 endpoint).
- **Предложение:** Заменить на явный `Storage::disk('s3')`. В `downloadUrl()` выбрасывать ошибку вместо `->url()`.

---

## 5. InboxController — несуществующее поле

### 5.1 [LOW] `thumbnail_url` всегда null

- **Файл:** `InboxController.php:35`
- **Описание:** `'thumbnail_url' => $p->file->thumbnail_url ?? null` — поля нет в модели File.
- **Предложение:** Генерировать presigned URL через `$this->s3->resolveListPreviewUrl($p->file)`.

---

## 6. Дублирование удаления

### 6.1 [INFO] `CleanOrphanedS3ObjectJob` + `CleanExpiredFilesJob`

- **Описание:** `cancelUpload()` диспатчит `CleanOrphanedS3ObjectJob` с задержкой 5 мин. `CleanExpiredFilesJob` (раз в час) чистит uploading-orphans старше 24ч. Если cancelUpload вызван для файла >24ч — оба попытаются удалить один объект (S3 DELETE идемпотентен, но false-positive в логах).
- **Предложение:** Добавить проверку в `CleanOrphanedS3ObjectJob::handle()`, что файл всё ещё в статусе Deleted.

---

## Сводка

| Severity | Всего | Проблемы |
|---|---|---|
| **HIGH** | 2 | deleteFile orphan, версии orphan |
| **MEDIUM** | 3 | N+1 presigned URL (2), attachment orphans |
| **LOW** | 3 | DocumentService разнобой, SupportAttachmentService диск, InboxController thumbnail |
