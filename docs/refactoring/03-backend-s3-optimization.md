# Оптимизация S3 — Бэкенд

## 1. Отсутствие централизованного S3-сервиса

**Проблема:** Взаимодействие с S3 распределено по 8+ файлам. Нет единой точки контроля для:
- Конфигурации TTL presigned URL
- Обработки ошибок S3 (try/catch разбросан)
- Логирования операций с S3
- Метрик использования S3

**Затронутые файлы:**
- `FileService.php` — 11+ вызовов
- `DocumentService.php` — 6 вызовов
- `FileController.php` — 2 вызова
- `SharingController.php` — 3 вызова
- `FileVersionController.php` — 1 вызов
- `Jobs/CleanExpiredFilesJob.php` — удаление объектов
- `Services/SupportAttachmentService.php` — загрузка/скачивание

**Стратегия:**
- Создать `S3StorageService` (или расширить `FileService`)
- Все операции с S3 — через этот сервис
- Добавить логирование всех операций с S3
- Добавить обработку ошибок S3 (404, 403, NetworkError)

---

## 2. Разные TTL для presigned URL

**Проблема:** В разных местах используются разные TTL:

| Место | TTL | Формат |
|-------|-----|--------|
| `FileService::generateDownloadUrl()` | `config('presigned_url_ttl')` (3600s) | seconds |
| `FileService::resolvePreviewAndViewUrls()` (image) | 60 min | minutes |
| `FileService::resolvePreviewAndViewUrls()` (video/audio/pdf) | 2 hours | hours |
| `FileService::buildListItem()` (image preview) | 60 min | minutes |
| `FileService::buildVersionItem()` (image preview) | 60 min | minutes |
| `FileController::content()` | 15 min | minutes |
| `FileController::preview()` | 60 min | minutes |
| `SharingController::resolveLink()` | 60 min | minutes |
| `SharingController::buildOgImage()` | 60 min | minutes |
| `DocumentService` (hydration) | 1 hour | hours |

**Стратегия:**
- Определить константы/конфиги:
  - `S3_TTL_PREVIEW` = 60 min
  - `S3_TTL_VIEW` = 120 min
  - `S3_TTL_DOWNLOAD` = 3600s (из конфига)
  - `S3_TTL_CONTENT_REDIRECT` = 15 min
  - `S3_TTL_OG_IMAGE` = 60 min
- Использовать их везде из `S3StorageService`

---

## 3. Дублирование генерации storage key

**Проблема:** Паттерн `'files/' . $user->id . '/' . $ulid . '/' . $data['original_name']` повторяется в 4 местах:
- `FileService::initUpload()` строка 42
- `DocumentService::createDocument()` строка 33
- `FileVersionController::initUpload()` строка 59
- `SharedFolderController::initUpload()` строка ~500 (через FileService)

**Стратегия:**
- Создать хелпер `StorageKeyGenerator::forFile(User $user, string $filename): string`
- Учесть, что для версий используется `$file->owner_id`, а не `$request->user()->id`

---

## 4. Дублирование генерации thumbnail storage key

**Проблема:** Паттерн `'thumb_' . $data['thumbnail_name']` повторяется:
- `FileService::initUpload()` строка 71
- `FileVersionController::initUpload()` строка 81

**Стратегия:**
- Включить в `StorageKeyGenerator`

---

## 5. Непоследовательная обработка ошибок S3

**Проблема:** В некоторых местах ошибки S3 игнорируются голым `catch (\Throwable) {}`:
- `FileService::resolvePreviewAndViewUrls()` строка 437
- `FileService::buildListItem()` строка 674, 678
- `FileService::buildVersionItem()` строка 709
- `SharingController::resolveLink()` строка 350
- `SharingController::buildOgImage()` строка 540

**Стратегия:**
- В `S3StorageService` добавить логирование ошибок
- На уровне сервиса возвращать `null` при ошибке, но логировать с контекстом
- Для критических операций (upload, delete) пробрасывать исключение наверх

---

## 6. Нет очистки S3 при отмене загрузки

**Проблема:** `FileService::cancelUpload()` (строка 117) только меняет статус, но S3-объект остаётся. Есть комментарий "Optionally: dispatch job to clean S3 object", но джоба нет.

**Стратегия:**
- Добавить `CleanOrphanedS3Objects` Job/Kommand
- При cancelUpload диспатчить отложенную очистку S3

---

## 7. Нет очистки thumbnail при удалении файла

**Проблема:** При удалении файла `thumbnail_key` ссылается на S3-объект, который никогда не удаляется.

**Стратегия:**
- В `CleanExpiredFilesJob` и при hand-удалении — удалять и thumbnail из S3
- Хранить список всех S3-ключей в отдельной таблице для гарантированной очистки

---

## 8. `generatePresignedPutUrl()` использует SDK напрямую

**Проблема:** `FileService::generatePresignedPutUrl()` (строка 728) работает напрямую с S3 Client SDK, а не через `Storage::disk('s3')->temporaryUrl()`. Это контрастирует с остальными методами, которые используют Storage facade.

**Стратегия:**
- Унифицировать: либо все через Storage facade (проще), либо все через SDK
- `temporaryUrl()` не поддерживает PUT-метод, поэтому для upload оставить SDK, но вынести в `S3StorageService`
