# Аудит оптимизации S3 хранилища

> **Дата:** 2026-05-20
> **Статус:** завершён 🔍

## Методология

Поиск: URL-генерация вне `S3UrlService`, лишние S3-вызовы (в циклах, дубли), проблемы upload flow (cancel, orphan), TTL-настройки.

---

## 1. URL-генерация вне S3UrlService

### ✅ Все `Storage::disk('s3')->temporaryUrl()` и `->url()` — внутри S3UrlService

Проверены все файлы:
- `app/Http/Controllers/` — 0 вызовов ✅
- `app/Services/` (кроме S3UrlService) — 0 вызовов ✅
- `app/Jobs/` — 0 вызовов (только `delete()` — не URL) ✅

### [MEDIUM] `SupportAttachmentService::temporaryUrl()`

- **Файл:** `backend/app/Services/SupportAttachmentService.php:102`
- **Описание:** Вызывает `$disk->temporaryUrl(...)` для вложений техподдержки. Хотя это может быть локальный диск, логика presigned URL дублируется.
- **Предложение:** Создать единый метод в абстрактном сервисе дисков.

---

## 2. Лишние S3-вызовы

### 2.1 [MEDIUM] N+1 presigned URL при формировании списков

- **Файлы:** `backend/app/Services/FileCardBuilder.php:66,114`, `SharedFolderController.php:117,914`
- **Описание:** Каждый вызов `resolvePreviewAndViewUrls()` / `resolveListPreviewUrl()` делает HTTP-запрос к AWS Signature V4. При `per_page=50` это 50 последовательных запросов.
- **Предложение:** Кэшировать presigned URL в Redis с TTL = TTL_URL - 5 мин. Или генерировать URL для одного представителя группы и reuse (если TTL совпадает).

### 2.2 [LOW] Избыточный `headObject` после `put()` в DocumentService

- **Файл:** `backend/app/Services/DocumentService.php:52,133`
- **Описание:** После `Storage::disk('s3')->put()` вызывается `fetchEtag()`, который делает отдельный `headObject` к S3. ETag доступен из ответа `PutObject`.
- **Предложение:** В `S3UrlService` добавить метод `putWithEtag()`, возвращающий ETag из ответа SDK, экономя один HTTP-запрос на сохранение.

---

## 3. Upload flow

### 3.1 [HIGH] `cancelUpload()` не проверяет статус файла

- **Файл:** `backend/app/Services/FileService.php:141-150`
- **Описание:** `cancelUpload()` устанавливает статус `Deleted` и диспатчит `CleanOrphanedS3ObjectJob` **без проверки**, что файл находится в статусе `Uploading`. Если владелец вызовет `POST /api/v1/files/{id}/cancel-upload` для уже загруженного файла (статус `Available`), файл будет помечен как удалённый, а S3-объект удалён через 5 минут.
- **Предложение:** Добавить проверку `$file->status === FileStatus::Uploading` или использовать `->where('status', FileStatus::Uploading)->update()`.

### 3.2 [MEDIUM] Отсутствует cleanup для Uploading-orphanov

- **Файлы:** `backend/app/Services/FileService.php:49-93`, `backend/app/Jobs/CleanExpiredFilesJob.php:33-37`
- **Описание:** Пользователь может получить presigned PUT URL, залить файл на S3, но не вызвать `completeUpload`. Файл остаётся в статусе `Uploading` с `expires_at = null`. `CleanExpiredFilesJob` ищет только по `expires_at < now()`, поэтому такие orphans никогда не очищаются.
- **Сценарии:** (а) пользователь не завершил upload, (б) ошибка в completeUpload, (в) optimistic lock отклонил повторный вызов.
- **Предложение:** 1) Добавить в `CleanExpiredFilesJob` условие: `->orWhere(fn($q) => $q->where('status', 'uploading')->where('created_at', '<', now()->subHours(24)))`. 2) Или установить `expires_at` при `initUpload()`.

### 3.3 [MEDIUM] `CleanExpiredFilesJob` не удаляет `thumbnail_key`

- **Файл:** `backend/app/Jobs/CleanExpiredFilesJob.php:43`
- **Описание:** Job удаляет только `Storage::disk('s3')->delete($file->storage_key)`. Если у файла есть `thumbnail_key`, миниатюра остаётся orphan-объектом.
- **Предложение:** Добавить удаление thumbnail_key: `if ($file->thumbnail_key) Storage::disk('s3')->delete($file->thumbnail_key);`.

### 3.4 [LOW] `initUpload()` генерирует presigned PUT URL до проверок

- **Файл:** `backend/app/Services/FileService.php:49-93`
- **Описание:** В `initUpload()` сначала генерируется presigned PUT URL (S3-запрос), а затем проверяется квота. При превышении квоты presigned URL уже потрачен.
- **Предложение:** Переместить генерацию presigned URL после всех проверок.

---

## 4. TTL presigned URL

### 4.1 [LOW] Долгий дефолтный TTL для PUT (3600 с)

- **Файл:** `backend/app/Services/S3UrlService.php:25`
- **Описание:** TTL для PUT берётся из `presigned_url_ttl` (по умолчанию 3600 с = 1 час). Это одновременно: (а) долгое окно для атаки при перехвате URL, (б) час до появления Uploading-orphan.
- **Предложение:** Сократить дефолтный TTL для `generatePresignedPutUrl()` до 30 минут (1800 с).

---

## 5. Прочие замечания

### 5.1 [LOW] `FileController::content()` и `preview()` — корректно используют S3UrlService ✅

**Подтверждено** — оба метода вызывают `contentRedirectUrl()` / `previewRedirectUrl()`.

### 5.2 [LOW] `CleanOrphanedS3ObjectJob` — покрывает cancelUpload

**Подтверждено** — Job запускается при cancelUpload с задержкой 5 минут. Удаляет `storage_key` и `thumbnail_key`.

---

## Сводка

| Severity | Всего | Ключевые проблемы |
|---|---|---|
| **HIGH** | 1 | cancelUpload без проверки статуса |
| **MEDIUM** | 3 | Thumbnail_key orphan, Uploading-orphans без cleanup, N+1 presigned URL |
| **LOW** | 4 | Избыточный headObject, порядок проверок в initUpload, долгий PUT TTL, SupportAttachmentService |
