# Re-аудит³ S3 хранилища (после спринтов 1–22)

> **Дата:** 2026-05-20
> **Статус:** завершён 🔍
> **Раунд:** 4-й финальный аудит

---

## 🟠 HIGH

### 1. `S3UrlService::generateDownloadUrl()`, `generateVersionDownloadUrl()` — без try/catch

- **Файл:** `backend/app/Services/S3UrlService.php:39-47,52-60`
- **Описание:** Вызывают `Storage::disk('s3')->temporaryUrl()` без try/catch. При недоступности S3 — необработанное исключение → HTTP 500. Точки вызова: `FileController::download()`, `FileVersionController::download()`, `SharingController::downloadViaLink()` (публичный endpoint).
- **Решение:** Обернуть в try/catch с логированием, возвращать `null` для проверки вызывающей стороной.

### 2. `S3UrlService::contentRedirectUrl()`, `previewRedirectUrl()` — без try/catch

- **Файл:** `backend/app/Services/S3UrlService.php:136-148`
- **Описание:** Те же методы без try/catch. В docstring сказано "Throws on failure — caller must ensure key exists", но вызывающие контроллеры (`FileController::content()`, `FileController::preview()`) не перехватывают исключение.
- **Решение:** Заменить на `$this->tryTemporaryUrl()` (который уже есть в том же сервисе и корректно ловит исключения), либо обернуть в try/catch.

### 3. `FileVersion` Uploading — никогда не очищаются

- **Файл:** `backend/app/Http/Controllers/Files/FileVersionController.php:77`, `backend/app/Jobs/CleanExpiredFilesJob.php:35-40`
- **Описание:** `FileVersion::create()` со статусом Uploading устанавливает `expires_at = +1 час`. Но `CleanExpiredFilesJob` проверяет только `File`, не `FileVersion`. Записи версий Uploading с истекшим `expires_at` остаются в БД навсегда вместе с S3-ключами.
- **Решение:** Расширить `CleanExpiredFilesJob` для очистки `FileVersion::where('status', FileStatus::Uploading)->where('expires_at', '<', now())`, или создать отдельный `CleanOrphanedVersionsJob`.

---

## 🟡 MEDIUM

### 4. `DocumentService::createDocument()` — DB→S3, окно для orphan

- **Файл:** `backend/app/Services/DocumentService.php:39-58`
- **Описание:** Сначала `File::create()` (БД), затем `Storage::disk('s3')->put()`. Если процесс умирает между ними — запись в БД остаётся (status=Available, без expires_at) без содержимого в S3. `forceDelete()` в catch полагается на работоспособность Eloquent.
- **Решение:** Устанавливать `status = FileStatus::Uploading` при создании (чтобы CleanExpiredFilesJob мог подобрать), или обернуть в DB-транзакцию с проверкой после S3.

### 5. `FileService::completeUpload()` — не проверяет существование S3-объекта

- **Файл:** `backend/app/Services/FileService.php:100-137`
- **Описание:** Метод не проверяет, что файл действительно загружен в S3. Просто меняет статус с Uploading на Available. Если клиент вызывает `completeUpload` без реальной загрузки — файл помечается Available без содержимого.
- **Решение:** Вызвать `S3UrlService::fetchEtag()` или `Storage::disk('s3')->exists()` перед переводом в Available.

### 6. `SupportAttachmentService::storeSupportAttachments()` — не проверяет дубликаты storage_key

- **Файл:** `backend/app/Services/SupportAttachmentService.php:60-127`
- **Описание:** При каждом вызове генерирует новый storage_key (через ULID). Если один файл загружается дважды (form resubmit), создаётся дубликат записи и S3-объекта. Orphan не очищается.
- **Решение:** Idempotency-ключ или дедупликация на уровне приложения.

---

## 🔵 LOW

### 7. `S3UrlService::generatePresignedPutUrl()` — без try/catch (внутри транзакции)

- **Файл:** `backend/app/Services/S3UrlService.php:21-34`
- **Описание:** Вызывается внутри DB-транзакции в `FileService::initUpload()`. При ошибке S3 транзакция откатывается — запись в БД не создаётся. Безопасно, но пользователь получает 500.
- **Решение:** Обернуть в try/catch для вменяемого ответа API.

### 8. `DocumentService::saveDocument()` — несоответствие size/etag после ошибки БД

- **Файл:** `backend/app/Services/DocumentService.php:138-153`
- **Описание:** Порядок: S3 put → DB update. Если DB update падает, S3 уже содержит новые данные, но БД хранит старые `size`/`etag`. Несоответствие не критично (следующее чтение восстановит), но не детерминировано.
- **Решение:** Поменять порядок: сначала читать etag из S3, потом DB update, потом подтверждать S3 (сценарий сложный — deferred).

### 9. `CleanOrphanedS3ObjectJob` — утечка после 3 неудачных попыток

- **Файл:** `backend/app/Jobs/CleanOrphanedS3ObjectJob.php:22-31`
- **Описание:** Исключение логируется, но не пробрасывается повторно. После 3 попыток объект S3 остаётся. Осознанное решение (предотвращение повторных постановок в очередь).
- **Решение:** Мониторинг логов, ручная очистка при необходимости.

---

## ✅ Подтверждено — чисто

| Проверка | Результат |
|---|---|
| `Storage::disk('s3')->url()` (публичные URL) | **0 вхождений** ✅ |
| `temporaryUrl()` вне S3UrlService | **0 вхождений** ✅ |
| File Uploading orphans — CleanExpiredFilesJob | ✅ Очищает Files Uploading > 24ч |
| OG Image TTL | ✅ Установлен в 30 дней (исправлено в Sprint 21) |

---

## Сводка

| Severity | Всего | Проблемы |
|----------|-------|----------|
| **HIGH** | 3 | generateDownloadUrl без try/catch, content/previewRedirectUrl без try/catch, FileVersion Uploading не очищаются |
| **MEDIUM** | 3 | createDocument orphan, completeUpload без проверки S3, supportAttachment дубликаты |
| **LOW** | 3 | generatePresignedPutUrl без try/catch, saveDocument size/etag, CleanOrphaned 3 попытки |

**Всего: 9 находок** (3 HIGH, 3 MEDIUM, 3 LOW)
