# Re-аудит² S3 хранилища (после спринтов 1–17)

> **Дата:** 2026-05-20
> **Статус:** завершён 🔍
> **Раунд:** 3-й финальный аудит

---

## 🟡 MEDIUM

### 1. Orphan S3-объекты при частичной ошибке `SupportAttachmentService`

- **Файл:** `backend/app/Services/SupportAttachmentService.php:67,94`
- **Описание:** В цикле по массиву файлов выполняется `Storage::disk('s3')->put(...)`, а `SupportAttachment::insert($rows)` вызывается **после** цикла. Если put на 2-м из N файлов упадёт (S3 timeout), первые файлы уже загружены в S3, но запись в БД не создана. Orphan-объекты навсегда.
- **Решение:** try/catch с удалением уже загруженных ключей, либо запись в БД до S3 put.

### 2. `DocumentService::createDocument` — put без try/catch, запись в БД уже есть

- **Файл:** `backend/app/Services/DocumentService.php:51`
- **Описание:** Сначала создаётся запись File в БД (статус `Available`), затем S3 put. Если S3 недоступен, запись в БД остаётся. Файл без `expires_at` — CleanExpiredFilesJob не тронет. Пользователь видит битый файл.
- **Решение:** try/catch с удалением записи из БД, либо устанавливать expires_at на документ при создании.

### 3. `DocumentService::saveDocument` — put без try/catch

- **Файл:** `backend/app/Services/DocumentService.php:133`
- **Описание:** `put` без try/catch. При ошибке S3 пользователь получит HTTP 500, изменения потеряются.
- **Решение:** try/catch + возврат вменяемой ошибки.

### 4. `SupportAttachmentService::downloadUrl` — fallback на публичный URL

- **Файл:** `backend/app/Services/SupportAttachmentService.php:117`
- **Код:** `return $this->s3->tryTemporaryUrl($storageKey, 30) ?? Storage::disk('s3')->url($storageKey);`
- **Описание:** Если `tryTemporaryUrl` вернул null, код падает на `Storage::disk('s3')->url(...)` — публичный URL объекта в приватном бакете. Либо 403, либо утечка доступа.
- **Решение:** Убрать fallback, возвращать null или выбрасывать исключение.

---

## 🔵 LOW

### 5. OG Image TTL 60 минут — соцсети кэшируют дольше

- **Файл:** `backend/app/Services/S3UrlService.php:129`, `SharingController.php:490`
- **Описание:** `resolveOgImageUrl()` использует `TTL_OG_IMAGE = 60` минут. Presigned URL вставляется в `<meta property="og:image">`. Социальные сети кэшируют OG-теги на часы/дни → битое превью после истечения TTL.
- **Решение:** Увеличить `TTL_OG_IMAGE` до 7-30 дней (604800–2592000 с) или использовать внутренний редирект.

### 6. FileVersion в статусе Uploading без `expires_at`

- **Файл:** `backend/app/Http/Controllers/Files/FileVersionController.php:69-77`
- **Описание:** `FileVersion::create()` со статусом `Uploading` не устанавливает `expires_at`. Если клиент не завершил загрузку — запись навсегда. CleanExpiredFilesJob работает только с File, не с FileVersion.
- **Решение:** Установить `expires_at` для uploading-версий (+1 час) или расширить CleanExpiredFilesJob.

---

## ✅ Подтверждено — чисто

| Проверка | Результат |
|---|---|
| `Storage::disk('s3')->temporaryUrl()` вне S3UrlService | ✅ Все вызовы внутри сервиса |
| Двойные presigned URL для одного файла | ✅ Не найдено |
| TTL content/preview/view redirect | ✅ Адекватны (15–120 мин) |
| `cancelUpload` | ✅ Проверяет статус, диспатчит CleanOrphanedS3ObjectJob |
| `deleteFile` | ✅ Диспатчит CleanOrphanedS3ObjectJob с очисткой версий |
| `CleanExpiredFilesJob` / `CleanOrphanedS3ObjectJob` | ✅ Корректные try/catch |

---

## Сводка

| Severity | Всего | Проблемы |
|---|---|---|
| **MEDIUM** | 4 | SupportAttachment orphan, DocumentService create/save без try/catch, fallback на публичный URL |
| **LOW** | 2 | OG Image TTL, FileVersion uploading без expires_at |
