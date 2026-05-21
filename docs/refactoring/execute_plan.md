# Execution Plan — Рефакторинг

## Спринт 1 — P0: Критические баги

| # | Задача | Файл | Статус |
|---|--------|------|--------|
| 1 | Cycle guard в `FileService::canAccess()` и `SharedFolderController::canAccess()` | FileService, SharedFolderController | ✅ |
| 2 | Race condition в `completeUpload` | FileService | ✅ |
| 3 | `checkStorageQuota` + версии файлов | FileService | ✅ |
| 4 | `formatFileCard` → link-поля для всех | SharedFolderController | ✅ |
| 5 | S3 orphan при cancelUpload | FileService + новый Job | ✅ |

---

## Спринт 2 — Backend: Новые сервисы

| # | Задача | Файл | Статус |
|---|--------|------|--------|
| 1 | `S3UrlService` | app/Services/S3UrlService.php | ✅ |
| 2 | `MimeService` | app/Services/MimeService.php | ✅ |
| 3 | `FileCardBuilder` + sync buildListItem | app/Services/FileCardBuilder.php | ✅ |

---

## Спринт 3 — Backend: Консолидация и оптимизация

| # | Задача | Файл | Статус |
|---|--------|------|--------|
| 1 | Централизация access check | FileService, DocumentService, SharedFolderController | ✅ |
| 2 | Централизация quota check | FileService, FileController, SharedFolderController | ✅ |
| 3 | N+1 в `SharedFolderController::index()` | SharedFolderController | ✅ |
| 4 | N+1 в `formatFolder()` | SharedFolderController | ✅ |
| 5 | Мелкие оптимизации | FileService, File.php | ✅ |

---

## Спринт 4 — Frontend: Shared utilities

| # | Задача | Файл | Статус |
|---|--------|------|--------|
| 1 | `@shared/utils/format.ts` | frontend/src/app/shared/utils/ | ✅ |
| 2 | `@shared/utils/file.ts` | frontend/src/app/shared/utils/ | ✅ |
| 3 | `@shared/utils/tree.ts` | frontend/src/app/shared/utils/ | ✅ |
| 4 | `@shared/constants/limits.ts` | frontend/src/app/shared/constants/ | ✅ |

---

## Спринт 5 — Frontend: Upload

| # | Задача | Файл | Статус |
|---|--------|------|--------|
| 1 | Расширить `FileUploadService` | file-upload.service.ts | ✅ |
| 2 | Убрать `uploadToSharedFolder()` | folders-tree.component.ts | ✅ |
| 3 | Убрать inline upload | shared-folders.component.ts | ✅ |

---

## Спринт 6 — Frontend: MarkdownEditorService

| # | Задача | Файл | Статус |
|---|--------|------|--------|
| 1 | Создать `MarkdownEditorService` | markdown-editor.service.ts | ✅ |
| 2 | Рефакторинг `markdown-editor.component.ts` | markdown-editor.component.ts | ✅ |
| 3 | Рефакторинг `markdown-editor-panel.component.ts` | markdown-editor-panel.component.ts | ✅ |

---

## Спринт 7 — Остаточные дублирования

| # | Задача | Файл | Статус |
|---|--------|------|--------|
| 1 | `formatSize()` — параметр `locale`, замена 4 inline-реализаций | shared/utils/format.ts, 4 компонента | ✅ |
| 2 | `S3UrlService::fetchEtag()` — вынести ETag-логику из DocumentService | S3UrlService, DocumentService | ✅ |

---

---

## Спринт 8 — P0 логические баги

> Аудит `audit-04-logic.md`. Подтверждены проверкой кода. Затрагивают видимые данные и права доступа.

| # | Задача | Файл | Статус |
|---|--------|------|--------|
| 1 | `FileCardBuilder::buildCard()` — `is_pinned` всегда `false`, `expires_at` всегда `null` | FileCardBuilder.php:36,40 | ✅ |
| 2 | `FileService::listFiles()` — нет фильтрации по `status = Available` | FileService.php:422 | ✅ |
| 3 | `cancelUpload()` — нет проверки статуса, может удалить Available-файл | FileService.php:141 | ✅ |
| 4 | `DocumentService::canEditDocument()` — не учитывает edit-доступ через SharedFolder | DocumentService.php:152 | ✅ |
| 5 | `FileVersionController::initUpload()` — нет `validateFileSizeLimit()` | FileVersionController.php:56 | ✅ |

---

## Спринт 9 — N+1 запросы и индекс

> Аудит `audit-02-queries.md`. Подтверждены проверкой кода. Уже исправленные исключены: `FileService::canAccess()` (Sprint 3), `InvitationService`, `FileController::favorite/pin`, индекс `file_user_access(file_id,user_id)`.

| # | Задача | Файл | Статус |
|---|--------|------|--------|
| 1 | `SupportAdminController::index()` — `SupportMessage::where()` в sort-callback для каждого тикета | SupportAdminController.php:42-46 | ✅ |
| 2 | `ContactController::resolve()` — `User::where('email')` + `User::where('phone')` в foreach | ContactController.php:210,213 | ✅ |
| 3 | `CommentService::processMentions()` + `notifyNewComment()` — `User::find()` в foreach | CommentService.php:310,342 | ✅ |
| 4 | `SharedFolder::ancestorIds()` + `rootFolder()` — `SharedFolder::find()` в while-цикле | SharedFolder.php:39-62 | ✅ |
| 5 | Миграция: составной уникальный индекс `shared_folder_accesses(shared_folder_id, user_id)` | новая миграция | ✅ |

---

## Спринт 10 — Централизация access checks + card builders

> Аудит `audit-01-duplication.md`, `audit-04-logic.md`. Дублирование с неполными реализациями (нет cycle guard, нет обхода предков).

| # | Задача | Файл | Статус |
|---|--------|------|--------|
| 1 | `SharedFolderFileController::canAccessSharedFolder()` — нет cycle guard; делегировать в `SharedFolderController::canAccess()` | SharedFolderFileController.php:21-37 | ✅ |
| 2 | `CommentSettingsController::canManageSharedFolder()` — нет обхода предков; делегировать в централизованный метод | CommentSettingsController.php:180-187 | ✅ |
| 3 | `CommentService::canAccessSharedFolder()` — нет обхода предков (упрощённая версия) | CommentService.php:366-374 | ✅ |
| 4 | `SharedFolderController::publicFiles()` — inline-карточки заменить на `FileCardBuilder::buildPublicItem()` | SharedFolderController.php:892-921 | ✅ |

---

## Спринт 11 — Upload cleanup + Frontend MIME

> Аудит `audit-03-s3.md`, `audit-01-duplication.md`. Мелкие, но важные: orphan-объекты в S3 и inline-дублирование на фронтенде.

| # | Задача | Файл | Статус |
|---|--------|------|--------|
| 1 | `CleanExpiredFilesJob` — добавить удаление `thumbnail_key` + cleanup uploading-orphans без `expires_at` (старше 24ч) | CleanExpiredFilesJob.php | ✅ |
| 2 | `SupportAttachmentService::downloadUrl()` — заменить прямой `$disk->temporaryUrl()` на `S3UrlService::tryTemporaryUrl()` | SupportAttachmentService.php:102 | ✅ |
| 3 | Frontend: 4 компонента с inline MIME-чеками → `classifyMimeType()` из `shared/utils/file.ts` | public-link, shared-folders, folders-tree, public-shared-link | ✅ |

---

## Спринт 12 — Enum-строки и мелкий cleanup

> Аудит `audit-01-duplication.md`, `audit-04-logic.md`. Самый низкий приоритет, не влияют на функциональность.

| # | Задача | Файл | Статус |
|---|--------|------|--------|
| 1 | Захардкоженные `'edit'`/`'view'` → `SharedFolderAccessType::Edit->value` / `View->value` | SharedFolderController.php, SharedFolderFileController.php, CommentSettingsController.php | ✅ |
| 2 | Захардкоженные `'active'`/`'disabled'` → `ShareLinkStatus::Active->value` / `Disabled->value` | SharedFolderController.php:821,862 | ✅ |
| 3 | `'uploading'` → `FileStatus::Uploading->value` в `FileVersionController` | FileVersionController.php:71,75 | ✅ |
| 4 | `'shared'`/`'saved'` → `AccessType` enum в `FileController`, `FileService` | FileController.php, FileService.php | ✅ |
| 5 | `DocumentService::getAccessibleImages()` — хардкод MIME-листа заменить на `where('mime_type', 'like', 'image/%')` | DocumentService.php:254 | ✅ |
| 6 | `DocumentLock` GC — artisan-команда для очистки блокировок старше 5 мин + запуск по расписанию | новая команда + console.php | ✅ |

---

## Что НЕ включено (проверено — не проблема или уже исправлено)

| Аудит | Пункт | Причина исключения |
|-------|-------|--------------------|
| audit-01 | S3UrlService inline MIME-чеки | Допустимо: str_starts_with быстрее MimeService для булевых проверок |
| audit-01 | tariffs.component.ts formatBytes() | Уже делегирует в `formatSize()` из shared utils |
| audit-02 | FileService::canAccess() SharedFolder::find() | Исправлено в Спринте 3 |
| audit-02 | InvitationService::accept() | Нет N+1 в текущем коде |
| audit-02 | FileController favorite/pin | Уже оптимизировано |
| audit-02 | file_user_access(file_id,user_id) индекс | Уже существует в миграции |
| audit-03 | initUpload() порядок проверок | Квота проверяется до генерации URL |
| audit-04 | disableLink() только created_by | LOW, edge case — отложено |
| audit-04 | shared_folder_only orphans | LOW, редкий edge case — отложено |
| re-01 §3.1 | S3UrlService MIME-чеки | Явно исключено — str_starts_with быстрее MimeService для bool |
| re-01 §1.1 | FileUserAccess в контроллерах | Большинство — прямые операции на записи, не access checks |
| re-01 §1.2-1.3 | Унификация canAccessSharedFolder | Все 3 исправлены в Sprint 10; большой рефакторинг в SharedFolderService — отложено |
| re-02 §3.1 | SupportTicketController count() | count() на коллекции — O(1), лишнего SQL нет |
| re-02 §5.1 | InvitationService N+1 | Нет N+1 в текущем коде |
| re-03 §2.1-2.2 | Presigned URL N+1 | Ограничено 20/страницу, допустимо |
| re-03 §1.3 | Attachment orphans | Нет endpoint удаления тикетов/предложений |
| re-03 §6.1 | CleanOrphanedS3ObjectJob double | S3 DELETE идемпотентен |
| re-04 §3.1 | TOCTOU quota | Незначительное превышение квоты принято как норма |
| re-04 §3.3 | saveDocument ETag non-atomic | ETag = optimistic lock, race крайне маловероятен |
| re-04 §4.4 | moveToFolder silent | By design: нужна прямая запись FileUserAccess |
| account_status строки | User.php, AdminController | Нет UserStatus enum; требует создания нового enum |

---

## Спринт 13 — P0: Безопасность, краши, сломанные поля

| # | Задача | Файл | Статус |
|---|--------|------|--------|
| 1 | `addFile()` — добавить `canAccess()` + `isAvailable()` | SharedFolderFileController.php | ✅ |
| 2 | `content()`/`preview()` — защита от url_file (crash на null storage_key) | FileController.php | ✅ |
| 3 | `File::hasAccessFor()` → `FileService::canAccess()` в OrganizationController | OrganizationController.php | ✅ |
| 4 | `heartbeat()` — добавить `canEditDocument()` check | DocumentLockController.php | ✅ |
| 5 | `setFavorite()` — `firstOrCreate` FileUserAccess если нет прямой записи | FileService.php | ✅ |
| 6 | `setTags()` — обернуть в `DB::transaction()` + bulk insert | FileService.php | ✅ |
| 7 | `InboxController` — `thumbnail_url` через S3UrlService, убран несуществующий `description` | InboxController.php | ✅ |
| 8 | `SharedFolderLink::isValid()` — `'active'` → `ShareLinkStatus::Active->value` | SharedFolderLink.php | ✅ |

---

## Спринт 14 — N+1, bulk insert, индексы

| # | Задача | Файл | Статус |
|---|--------|------|--------|
| 1 | `AdminController::users()` — correlated subquery вместо N+1 DeviceSession | AdminController.php | ✅ |
| 2 | `ContactController::import()` — batch User lookup вместо N+1 | ContactController.php | ✅ |
| 3 | `SupportAdminController::formatListItem()` — `$t->last_message_at` вместо отдельного запроса | SupportAdminController.php | ✅ |
| 4 | `CommentService::processMentions()` — bulk `CommentMention::insert([])` | CommentService.php | ✅ |
| 5 | `SupportAttachmentService` — bulk insert + явный disk `'s3'` | SupportAttachmentService.php | ✅ |
| 6 | `FileService::setTags()` — bulk file_tags insert | FileService.php | ✅ |
| 7 | `OrganizationController::attachTags()` — bulk file_tags insert | OrganizationController.php | ✅ |
| 8 | `CommentService::fileEffectivePolicy()` — убрать второй `SharedFolderCommentSettings::find()` | CommentService.php | ✅ |
| 9 | Миграция: индексы `sfa.user_id`, `sf.parent_id`, `prf.recipient_user_id`, `prsf.recipient_user_id` | новая миграция | ✅ |

---

## Спринт 15 — formatFileCard → FileCardBuilder

| # | Задача | Файл | Статус |
|---|--------|------|--------|
| 1 | `FileCardBuilder::buildListItem()` — добавлен параметр `?int $addedBy` для shared-folder контекста | FileCardBuilder.php | ✅ |
| 2 | `SharedFolderController::formatFileCard()` удалён → `cardBuilder->buildListItem($sf->file, $user, $sf->added_by)` | SharedFolderController.php | ✅ |

---

## Спринт 16 — S3 orphan + misc cleanup

| # | Задача | Файл | Статус |
|---|--------|------|--------|
| 1 | `FileService::deleteFile()` — dispatch `CleanOrphanedS3ObjectJob` для storage_key + thumbnail_key | FileService.php | ✅ |
| 2 | При deleteFile — версии файла: S3 ключи из FileVersion включены в очистку | FileService.php | ✅ |
| 3 | `DocumentService::saveDocument()` — `$file->fresh()` → `$file->refresh()` | DocumentService.php | ✅ |
| 4 | `FileService::pin()` — `firstOrCreate` вместо if/else (race condition) | FileService.php | ✅ |

---

## Спринт 17 — Оставшиеся enum строки

| # | Задача | Файл | Статус |
|---|--------|------|--------|
| 1 | `File.php` — `'saved'` → `AccessType::Saved->value`, `'active'` → `ShareLinkStatus::Active->value` | File.php | ✅ |
| 2 | `FileCardBuilder.php` — `'available'` → `FileStatus::Available->value` | FileCardBuilder.php | ✅ |
| 3 | `TariffController.php` — `'deleted'`/`'uploading'` → `FileStatus` enum | TariffController.php | ✅ |
| 4 | `DocumentController.php` — `'shared'` → `AccessType::Shared->value` | DocumentController.php | ✅ |
| 5 | `CommentController.php` — `CommentScope::Shared->value` как default вместо `'shared'` | CommentController.php | ✅ |

---

## Спринт 18 — P0 безопасность и критическая логика

| # | Задача | Файл | Статус |
|---|--------|------|--------|
| 1 | `SharingController::shareToContact()` — `canAccess` → `isOwnedBy` (только владелец шарит) | SharingController.php | ✅ |
| 2 | `SharingController::createLink()` — `canAccess` → `isOwnedBy` (только владелец создаёт ссылку) | SharingController.php | ✅ |
| 3 | `SharedFolderController::destroy()` — каскадное удаление в `DB::transaction()`: дочерние папки (рекурсивно), SharedFolderFile, SharedFolderAccess, SharedFolderLink, SharedFolderCommentSettings, PendingReceivedSharedFolder | SharedFolderController.php | ✅ |
| 4 | `FileVersionController::completeUpload()` — optimistic lock: `lockForUpdate()->exists()` + `File::where(...)->update(...)` вместо чтения `has_versions` вне блокировки | FileVersionController.php | ✅ |
| 5 | `FileController::updateDescription()` — `FileUserAccess::where()->first()` → `firstOrCreate()` (была 404 для shared-folder пользователей) | FileController.php | ✅ |
| 6 | `SharedFolderFileController::updateSharedFolders()` — `isOwnedBy \|\| FileUserAccess::exists()` → `fileService->canAccess()` | SharedFolderFileController.php | ✅ |

---

## Спринт 19 — Валидация и исправления моделей

| # | Задача | Файл | Статус |
|---|--------|------|--------|
| 1 | `FileController::moveFolder()` — валидация `folder_id` через `exists:folders,id,user_id,$userId` | FileController.php | ✅ |
| 2 | `FileService::setTags()` — фильтрация tag_id: `Tag::where('user_id')->whereIn('id')->pluck('id')` | FileService.php | ✅ |
| 3 | `OrganizationController::attachTags()` — то же: фильтрация tag_id по владельцу | OrganizationController.php | ✅ |
| 4 | `ContactController::import()` — добавлена валидация `required_without` для email/phone | ContactController.php | ✅ |
| 5 | `SharedFolderLink` — добавлен cast `'status' => ShareLinkStatus::class`; `isValid()` обновлён до enum-сравнения | SharedFolderLink.php | ✅ |
| 6 | `FilePolicy` — удалён мёртвый код (56 строк, нигде не вызывался) | FilePolicy.php | ✅ |

---

## Спринт 20 — N+1 и производительность БД

| # | Задача | Файл | Статус |
|---|--------|------|--------|
| 1 | `CleanExpiredFilesJob` — убрать N+1 `canBeDeleted()`: перенести условия в `whereDoesntHave('accesses', ...)` и `whereDoesntHave('shareLinks', ...)` | CleanExpiredFilesJob.php | ✅ |
| 2 | `AdminController::stats()` — count + sum → один `selectRaw('COUNT(*), COALESCE(SUM(size), 0)')` | AdminController.php | ✅ |
| 3 | `InboxController::acceptFiles()` — `firstOrCreate` в цикле → batch: один SELECT + `DB::table->insert()` + batch DELETE | InboxController.php | ✅ |
| 4 | `InboxController::acceptSharedFolders()` — то же: batch insert + batch DELETE | InboxController.php | ✅ |
| 5 | `SharedFolderFileController::updateSharedFolders()` — `firstOrCreate` в цикле → `DB::table->insertOrIgnore()` | SharedFolderFileController.php | ✅ |
| 6 | `ContactController::resolve()` — `$contact->update()` в цикле → группировка по resolved_user_id + `whereIn()->update()` | ContactController.php | ✅ |
| 7 | Миграция: 5 новых индексов (`shared_folders.owner_id`, `support_attachments.message_id`, `suggestion_attachments.suggestion_id`, `comment_audit_log.comment_id`, `pending_received_files.file_id`) | новая миграция | ✅ |

---

## Спринт 21 — S3 атомарность и надёжность

| # | Задача | Файл | Статус |
|---|--------|------|--------|
| 1 | `SupportAttachmentService::storeSupportAttachments()` — try/catch с удалением уже загруженных S3 ключей при ошибке | SupportAttachmentService.php | ✅ |
| 2 | `SupportAttachmentService::storeSuggestionAttachments()` — то же | SupportAttachmentService.php | ✅ |
| 3 | `DocumentService::createDocument()` — try/catch на S3 put: при ошибке `$file->forceDelete()` | DocumentService.php | ✅ |
| 4 | `DocumentService::saveDocument()` — try/catch на S3 put: возврат `['s3_error' => true]` → 503 в контроллере | DocumentService.php, DocumentController.php | ✅ |
| 5 | `SupportAttachmentService::downloadUrl()` — убран fallback `Storage::disk('s3')->url(...)` (публичный URL), метод возвращает `?string` | SupportAttachmentService.php | ✅ |
| 6 | `FileVersion` — добавлено поле `expires_at` (nullable): при создании uploading-версии устанавливается `+1 час`; миграция добавляет колонку | FileVersion.php, FileVersionController.php, новая миграция | ✅ |

---

## Спринт 22 — Enum строки (re-audit2)

| # | Задача | Файл | Статус |
|---|--------|------|--------|
| 1 | `FileService.php:210` — `['available', 'uploading']` → `[FileStatus::Available->value, FileStatus::Uploading->value]` | FileService.php | ✅ |
| 2 | `FileVersionController.php` — 2 оставшихся `'available'` (строки 193, 261) → `FileStatus::Available->value` | FileVersionController.php | ✅ |
| 3 | `OrganizationController.php` — `['shared', 'saved']` → `[AccessType::Shared->value, AccessType::Saved->value]`; добавлен import `AccessType` | OrganizationController.php | ✅ |
| 4 | `AdminController.php` — `['deleted']` уже заменены в Sprint 20 через `whereNot('status', FileStatus::Deleted->value)` | AdminController.php | ✅ |
| 5 | `SharedFolderController.php` — 5× `'view'`/`'edit'` → `SharedFolderAccessType::View/Edit->value`; validation rule обновлён | SharedFolderController.php | ✅ |
| 6 | `SharedFolderFileController.php` — 4× `'view'`/`'edit'` → `SharedFolderAccessType::View/Edit->value` | SharedFolderFileController.php | ✅ |
| 7 | `CommentThreadController.php` — `'shared'`/`'private'` → `CommentScope::Shared/Private->value`; `'all'` оставлен строкой (нет в enum) | CommentThreadController.php | ✅ |

---

## Что НЕ включено (re-audit3)

| Аудит | Пункт | Причина |
|-------|-------|---------|
| re-audit3-01 §7 | FileService write-методы без ownership check | Defense-in-depth: требует добавить `$user` во все сигнатуры и обновить вызывающий код — высокий риск регрессий; контроллеры уже проверяют права |
| re-audit3-01 §11 | SharedFolderController resolveSharedLink — перманентный доступ | Архитектурное изменение: требует `expires_at` на SharedFolderAccess + фоновое задание — отдельный спринт |
| re-audit3-03 §5 | FileService::completeUpload() без проверки S3 | Производительность: лишний S3 HEAD-запрос на каждое завершение загрузки — отдельная задача |
| re-audit3-03 §6 | SupportAttachmentService — дубликаты storage_key | Операционная задача, не баг; дедупликация на уровне приложения требует idempotency-ключа |
| re-audit3-01 §24 | SupportAttachmentService — доверие MIME от клиента | LOW: серверная проверка MIME требует `getimagesize()` / `finfo` — отдельная задача |
| re-audit3-01 §25 | Прочие модели status/token в fillable | LOW: реальный риск крайне мал при текущих контроллерах |
| re-audit3-02 §7 | Unused: Folder::ancestorIds(), SharedFolder::ancestorIds() | Не вызываются в текущем коде; добавить docblock-предупреждение при revival |
| re-audit3-04 §19 | ContactController::index() — нет пагинации | LOW: небольшая база пользователей; добавить при необходимости |
| re-audit3-04 §22 | ContactController::store() — хардкод русского текста | i18n вне scope рефакторинга |
| re-audit3-03 §8 | DocumentService::saveDocument() — несоответствие size/etag | Отложено в аудитах re-01/re-03; очень редкий edge case |
| re-audit3-03 §9 | CleanOrphanedS3ObjectJob — утечка после 3 попыток | By design (предотвращение повторных постановок в очередь) |

---

## Спринт 23 — P0 Critical Security (~2.5ч)

**Файлы:** `User.php`, `InvitationController.php`, `ContactController.php`

| # | Задача | Файл | Откуда |
|---|--------|------|--------|
| 1 | `User.php` — убрать из `$fillable`: `is_superuser`, `plan`, `account_status`, `email_verified_at` | User.php:16-33 | re-audit3-01 §1,5 |
| 2 | `InvitationController::accept()` — добавить проверку: `$request->user()->email !== $invitation->target_email` → forbidden | InvitationController.php:68 | re-audit3-01 §2 |
| 3 | `InvitationController::reject()` — добавить `Request $request` + проверка: пользователь = sender или target_email | InvitationController.php:93 | re-audit3-01 §3 |
| 4 | `ContactController::store()` — заменить `elseif ($request->phone)` на `if ($request->phone) { $duplicateQuery->orWhere(...) }` | ContactController.php:63 | re-audit3-04 §1 |

**Проверка:** `php artisan test` (405/405).

---

## Спринт 24 — HIGH Security fixes (~2.5ч)

**Файлы:** `SharingController.php`, `DocumentController.php`, `DocumentLockController.php`, `InvitationController.php`, `InvitationService.php`

| # | Задача | Файл | Откуда |
|---|--------|------|--------|
| 1 | `SharingController::listLinks()` — `canAccess` → `$file->isOwnedBy($request->user())` | SharingController.php:279 | re-audit3-01 §4 |
| 2 | `SharingController::disableLink()` — добавить `\|\| $link->file->isOwnedBy($request->user())` к проверке `created_by` | SharingController.php:313 | re-audit3-01 §20 |
| 3 | `DocumentController::show()` — обернуть вызов `promoteToDocument()` в `if ($file->isOwnedBy($request->user()))` | DocumentController.php:54 | re-audit3-01 §6 |
| 4 | `DocumentLockController::release()` — добавить `canEditDocument()` check перед `releaseLock()` | DocumentLockController.php:107 | re-audit3-01 §8 |
| 5 | `InvitationController::send()` — добавить `'file_id' => 'nullable\|string\|exists:files,id'`; в сервисе проверять `$file->isOwnedBy($sender)` | InvitationController.php:24, InvitationService.php:22 | re-audit3-01 §9 |

**Проверка:** `php artisan test` (405/405).

---

## Спринт 25 — MEDIUM Security + Fillable cleanup (~2.5ч)

**Файлы:** `Comment.php`, `CommentThread.php`, `DocumentLock.php`, `SharingController.php`, `DocumentService.php`, `SharedFolderFileController.php`, `SharedFolderController.php`, `FileController.php`, `CommentService.php`

| # | Задача | Файл | Откуда |
|---|--------|------|--------|
| 1 | `Comment.php` — убрать из `$fillable`: `replies_count`, `deleted_at` | Comment.php:21,23 | re-audit3-01 §17 |
| 2 | `CommentThread.php` — убрать из `$fillable`: `comments_count`, `last_comment_id`, `status` | CommentThread.php:24-26 | re-audit3-01 §18 |
| 3 | `DocumentLock.php` — убрать из `$fillable`: `user_id`, `created_at` (оставить `file_id`, `expires_at`) | DocumentLock.php:15 | re-audit3-01 §19 |
| 4 | `SharingController::saveViaLink()` — перенести проверку `$existing` внутрь `DB::transaction()` с `lockForUpdate()` | SharingController.php:405 | re-audit3-01 §10 |
| 5 | `DocumentService::acquireLock()` — обернуть в `DB::transaction()` + `DocumentLock::where()->lockForUpdate()` перед `updateOrCreate` | DocumentService.php:211 | re-audit3-01 §13 |
| 6 | `SharedFolderFileController::removeFile()` — после удаления записи: если файл `shared_folder_only` и больше нет других SF, установить `shared_folder_only=false` | SharedFolderFileController.php:187 | re-audit3-01 §12 |
| 7 | `SharedFolderController::destroy()` — в каскадном удалении: файлы с `shared_folder_only=true` в удаляемых папках → `shared_folder_only=false` если нет других SF | SharedFolderController.php:330 | re-audit3-01 §12 |
| 8 | `CommentService::processMentions()` — фильтровать `$mentionedUserIds`: оставить только тех, у кого есть `canAccess()` к целевому файлу/папке | CommentService.php:300 | re-audit3-01 §15 |
| 9 | `FileController::show()/destroy()/download()` — заменить отдельные 404/403 ветки на единый `if (!$file \|\| !canAccess) notFound()` | FileController.php:73,108,230 | re-audit3-04 §8 |

**Проверка:** `php artisan test` (405/405).

---

## Спринт 26 — N+1 parent chain + HIGH lazy loads (~3ч)

**Файлы:** `FileService.php`, `SharedFolderController.php`, `SharedFolderFileController.php`, `CommentService.php`, `CommentSettingsController.php`, `DocumentService.php`, `FileController.php`, `OrganizationController.php`

**Подход к parent chain:** вместо `SharedFolder::find($folderId)` в цикле — `SharedFolder::with(['parent','parent.parent','parent.parent.parent','parent.parent.parent.parent'])->whereIn('id', $ids)->get()->keyBy('id')`. Затем итерация по заранее загруженной цепочке без дополнительных SQL-запросов.

| # | Задача | Файл | Откуда |
|---|--------|------|--------|
| 1 | `FileService::canAccess()` — заменить `SharedFolder::find($folderId)` в foreach на `whereIn` с eager-load chain | FileService.php:183 | re-audit3-02 §1a,5 |
| 2 | `SharedFolderController::canAccess()` — то же: eager-load вместо lazy parent | SharedFolderController.php:60 | re-audit3-02 §1b |
| 3 | `SharedFolderFileController::canAccessSharedFolder()` — то же | SharedFolderFileController.php:24 | re-audit3-02 §1c |
| 4 | `CommentService::canAccessSharedFolder()` — то же | CommentService.php:382 | re-audit3-02 §1d |
| 5 | `CommentSettingsController::canManageSharedFolder()` — то же | CommentSettingsController.php:181 | re-audit3-02 §1e |
| 6 | `DocumentService::canEditDocument()` — то же + заменить `SharedFolder::find($folderId)` в цикле | DocumentService.php:166 | re-audit3-02 §1f,6 |
| 7 | `FileController::show()` — заменить `File::find($fileId)` на `File::with(['owner', 'tags'])->find($fileId)` | FileController.php:71 | re-audit3-02 §2 |
| 8 | `DocumentService` — `$file->load('updatedByUser')` перед вызовом `buildDocumentResponse()` в `createDocument()`, `getDocument()`, `saveDocument()` | DocumentService.php | re-audit3-02 §3 |
| 9 | `OrganizationController::updateFolder()` — загрузить `$candidate->load(['parent','parent.parent','parent.parent.parent'])` перед вызовом `isDescendant()` | OrganizationController.php:152 | re-audit3-02 §4 |

**Проверка:** `php artisan test` (405/405).

---

## Спринт 27 — S3 reliability (~2ч)

**Файлы:** `S3UrlService.php`, `FileController.php`, `FileVersionController.php`, `SharingController.php`, `CleanExpiredFilesJob.php`

| # | Задача | Файл | Откуда |
|---|--------|------|--------|
| 1 | `S3UrlService::generateDownloadUrl()` — обернуть в try/catch, изменить возврат на `?string`; вызывающие контроллеры: null → 503 | S3UrlService.php:39 | re-audit3-03 §1 |
| 2 | `S3UrlService::generateVersionDownloadUrl()` — то же | S3UrlService.php:52 | re-audit3-03 §1 |
| 3 | `S3UrlService::contentRedirectUrl()` — делегировать в `tryTemporaryUrl()` вместо прямого `temporaryUrl()` | S3UrlService.php:136 | re-audit3-03 §2 |
| 4 | `S3UrlService::previewRedirectUrl()` — то же | S3UrlService.php:145 | re-audit3-03 §2 |
| 5 | `S3UrlService::generatePresignedPutUrl()` — обернуть в try/catch: при ошибке бросать `\RuntimeException` вместо 500 | S3UrlService.php:21 | re-audit3-03 §7 |
| 6 | `CleanExpiredFilesJob` — добавить очистку `FileVersion` со статусом `Uploading` и `expires_at < now()`: удалить S3-объекты + записи в БД | CleanExpiredFilesJob.php | re-audit3-03 §3 |

**Проверка:** `php artisan test` (405/405).

---

## Спринт 28 — Logic fixes, validation, LOW (~2.5ч)

**Файлы:** `SuggestionController.php`, `SupportTicketController.php`, `SupportAdminController.php`, `AdminController.php`, `FileController.php`, `UrlFileController.php`, `FileService.php`, `PasswordResetService.php`, `CompleteUploadRequest.php`, `ContactController.php`, `AppServiceProvider.php`

| # | Задача | Файл | Откуда |
|---|--------|------|--------|
| 1 | 9× `$this->error($msg, 422)` → `$this->error($msg, 'CODE', [], 422)` в SuggestionController, SupportTicketController, SupportAdminController | SuggestionController.php:60, SupportTicketController.php:70,134,147,195, SupportAdminController.php:86,106,134,147 | re-audit3-04 §7 |
| 2 | `AdminController::users()` — добавить `->paginate(50)` + форматировать ответ через `->through()` | AdminController.php:29 | re-audit3-04 §11 |
| 3 | `FileController::index()` — добавить валидацию `'per_page' => 'nullable\|integer\|min:1\|max:100'` | FileController.php:34 | re-audit3-04 §18 |
| 4 | `UrlFileController::store()` — обернуть title/description/site_name в `strip_tags(mb_substr(..., 0, N))` | UrlFileController.php:36 | re-audit3-01 §21 |
| 5 | `FileService::createUrlFile()` — добавить проверку схемы URL: `in_array(parse_url($url, PHP_URL_SCHEME), ['http', 'https'])` | FileService.php:381 | re-audit3-01 §22 |
| 6 | `PasswordResetService::sendResetLink()` — удалять только просроченные коды (`->where('expires_at', '<', now())->delete()`), не все | PasswordResetService.php:22 | re-audit3-01 §23 |
| 7 | `CompleteUploadRequest` — добавить `'file_id' => [..., 'exists:files,id']` | CompleteUploadRequest.php:17 | re-audit3-04 §14 |
| 8 | `ContactController::import()` — дедупликация контактов по email/phone внутри батча перед обработкой | ContactController.php:172 | re-audit3-04 §15 |
| 9 | `AppServiceProvider` — добавить `RateLimiter::for('auth', ...)` 10 req/min для login/register/forgot-password | AppServiceProvider.php | re-audit3-04 §12 |
| 10 | `FileController::setTags()` — добавить `'tag_ids.*' => 'exists:tags,id,user_id,'.$request->user()->id` | FileController.php:375 | re-audit3-04 §17 |

**Проверка:** `php artisan test` (405/405) + `npx vitest run` (606/606).

---

## Итоги по задачам

### Спринт 28 — выполнен ✅ (405/405 backend тестов)

| # | Что сделано | Файлы |
|---|-------------|-------|
| 1 | 9× `$this->error($msg, 422)` → `$this->error($msg, 'CODE', [], 422)`: `ATTACHMENT_INVALID`, `TICKET_CLOSED`, `TICKET_INVALID_STATUS` | `SuggestionController.php`, `SupportTicketController.php`, `SupportAdminController.php` |
| 2 | `AdminController::users()` — добавлена пагинация `paginate($perPage)` с параметром `per_page` (макс. 200); ответ дополнен `total`, `current_page`, `last_page` | `AdminController.php` |
| 3 | `FileController::index()` — добавлена валидация `'per_page' => 'nullable\|integer\|min:1\|max:100'` | `FileController.php` |
| 4–5 | `FileService::createUrlFile()` — схема URL ограничена `http/https`; `title`, `description`, `site_name` обёрнуты в `strip_tags(mb_substr(...))` | `FileService.php` |
| 6 | `PasswordResetService::sendResetLink()` — удаляются только просроченные коды (`expires_at < now()`), активные остаются | `PasswordResetService.php` |
| 7 | `CompleteUploadRequest` — `file_id` дополнен `exists:files,id` | `CompleteUploadRequest.php` |
| 8 | `ContactController::import()` — дедупликация контактов внутри батча по email/phone перед сохранением | `ContactController.php` |
| 9 | `AppServiceProvider` — добавлен `RateLimiter::for('auth', ...)` 10 req/min; применён к публичным auth-роутам через `throttle:auth` | `AppServiceProvider.php`, `api.php` |
| 10 | `FileController::setTags()` — валидация `'tag_ids.*' => 'exists:tags,id,user_id,'.$userId` | `FileController.php` |

---

### Спринт 27 — выполнен ✅ (405/405 backend тестов)

| # | Что сделано | Файлы |
|---|-------------|-------|
| 1–2 | `S3UrlService::generateDownloadUrl/generateVersionDownloadUrl` — переписаны через `tryTemporaryUrl`, возвращают `?string`; вызывающие (`FileController`, `FileVersionController`, `FileService`) обрабатывают null → 503 | `S3UrlService.php`, `FileController.php`, `FileVersionController.php`, `FileService.php` |
| 3–4 | `S3UrlService::contentRedirectUrl/previewRedirectUrl` — делегируют в `tryTemporaryUrl`; `FileController::content/preview` обрабатывают null → `abort(503)` | `S3UrlService.php`, `FileController.php` |
| 5 | `S3UrlService::generatePresignedPutUrl` — обёрнут в try/catch: при ошибке выбрасывает `\RuntimeException` вместо неструктурированного 500 | `S3UrlService.php` |
| 6 | `CleanExpiredFilesJob` — добавлена очистка `FileVersion` со статусом `Uploading` и `expires_at < now()`: S3-ключи удаляются, запись удаляется из БД | `CleanExpiredFilesJob.php` |

---

### Спринт 26 — выполнен ✅ (405/405 backend тестов)

| # | Что сделано | Файлы |
|---|-------------|-------|
| 1 | `FileService::canAccess()` — `SharedFolder::find` в foreach + lazy `parent` → `whereIn` с `with(['parent.parent.parent.parent'])` + один `SharedFolderAccess::whereIn` для всех предков | `FileService.php` |
| 2 | `SharedFolderController::canAccess()` — `loadMissing('parent.parent.parent.parent')` + `SharedFolderAccess::whereIn` для всех предков вместо N запросов в цикле | `SharedFolderController.php` |
| 3 | `SharedFolderFileController::canAccessSharedFolder()` — то же | `SharedFolderFileController.php` |
| 4 | `CommentService::canAccessSharedFolder()` — то же, с `SharedFolder::with(...)->find($folderId)` | `CommentService.php` |
| 5 | `CommentSettingsController::canManageSharedFolder()` — то же с фильтром по `access_type = Edit` | `CommentSettingsController.php` |
| 6 | `DocumentService::canEditDocument()` — то же: `whereIn` + eager-load + батчевый `SharedFolderAccess::whereIn` с Edit-фильтром | `DocumentService.php` |
| 7 | `FileController::show()` — `File::find($fileId)` → `File::with(['owner'])->find($fileId)` (исключает lazy load в `buildFileCard`) | `FileController.php` |
| 8 | `DocumentService::buildDocumentResponse()` — добавлен `$file->loadMissing('updatedByUser')` перед обращением к relation | `DocumentService.php` |
| 9 | `OrganizationController::updateFolder()` — добавлен `$parent->loadMissing('parent.parent.parent.parent')` перед `isDescendant()` | `OrganizationController.php` |

---

### Спринт 25 — выполнен ✅ (405/405 backend тестов)

| # | Что сделано | Файлы |
|---|-------------|-------|
| 1 | `Comment.php` — убраны из `$fillable`: `replies_count`, `deleted_at` (счётчик и soft-delete недоступны массовому присвоению) | `Comment.php` |
| 2 | `CommentThread.php` — убраны из `$fillable`: `comments_count`, `last_comment_id`, `status` | `CommentThread.php` |
| 3 | `DocumentLock.php` — убран из `$fillable`: `created_at` (`user_id` оставлен — DB-ограничение NOT NULL без default) | `DocumentLock.php` |
| 4 | `SharingController::saveViaLink()` — проверка дублей перенесена внутрь `DB::transaction()` с `lockForUpdate()`, TOCTOU race устранён | `SharingController.php` |
| 5 | `DocumentService::acquireLock()/takeoverLock()` — переписаны на `DB::transaction()` + `lockForUpdate()` + `DB::table->upsert()` (обход fillable при системных записях) | `DocumentService.php` |
| 6 | `SharedFolderFileController::removeFile()` — после удаления SF-членства сбрасывает `shared_folder_only=false` если файл остался без папок | `SharedFolderFileController.php` |
| 7 | `SharedFolderController::destroy()` — при каскадном удалении папок определяет orphan-файлы и сбрасывает им `shared_folder_only=false` | `SharedFolderController.php` |
| 8 | `CommentService::processMentions()` — упомянутые пользователи фильтруются через `canAccessTarget()`: нотификации отправляются только тем, кто имеет доступ | `CommentService.php` |
| 9 | `FileController::show()/download()` — унифицированный 404 вместо 404/403 для отсутствующих/недоступных файлов; тесты обновлены | `FileController.php`, `FileShowTest.php`, `FileDownloadTest.php` |

---

### Спринт 22 — выполнен ✅ (405/405 backend тестов)

| # | Что сделано | Файлы |
|---|-------------|-------|
| 1 | `FileService` — `['available', 'uploading']` → `FileStatus` enum; `OrganizationController` — `['shared', 'saved']` → `AccessType` enum + import | `FileService.php`, `OrganizationController.php` |
| 2 | `FileVersionController` — 2 оставшихся `'available'` → `FileStatus::Available->value` | `FileVersionController.php` |
| 3 | `SharedFolderController` — 5 вызовов `canAccess` с `'view'`/`'edit'`, default-параметр и validation rule → `SharedFolderAccessType` enum | `SharedFolderController.php` |
| 4 | `SharedFolderFileController` — 4 вызова `canAccessSharedFolder` с `'edit'`, default-параметр → `SharedFolderAccessType` enum | `SharedFolderFileController.php` |
| 5 | `CommentThreadController` — `'shared'` → `CommentScope::Shared->value`, `'private'` → `CommentScope::Private->value` | `CommentThreadController.php` |

---

### Спринт 21 — выполнен ✅ (405/405 backend тестов)

| # | Что сделано | Файлы |
|---|-------------|-------|
| 1–2 | `SupportAttachmentService` — оба метода обёрнуты в try/catch: при ошибке S3 удаляются уже загруженные ключи и исключение пробрасывается дальше | `SupportAttachmentService.php` |
| 3 | `DocumentService::createDocument()` — S3 put в try/catch: при ошибке `$file->forceDelete()` предотвращает orphan-запись | `DocumentService.php` |
| 4 | `DocumentService::saveDocument()` — S3 put в try/catch: возвращает `['s3_error' => true]`, контроллер отвечает 503 | `DocumentService.php`, `DocumentController.php` |
| 5 | `SupportAttachmentService::downloadUrl()` — убран `?? Storage::disk('s3')->url(...)` (публичный URL в приватном бакете), метод теперь `?string` | `SupportAttachmentService.php` |
| 6 | Добавлена колонка `expires_at` в `file_versions` (миграция), `FileVersion::$fillable` и `casts` обновлены; `FileVersionController::initiateUpload` устанавливает `expires_at = now()+1h` для uploading-версий | `FileVersion.php`, `FileVersionController.php`, новая миграция |

---

### Спринт 20 — выполнен ✅ (405/405 backend тестов)

| # | Что сделано | Файлы |
|---|-------------|-------|
| 1 | `CleanExpiredFilesJob` — `canBeDeleted()` в цикле (N×2 запроса) → `whereDoesntHave('accesses', ...)` + `whereDoesntHave('shareLinks', ...)` в запросе | `CleanExpiredFilesJob.php` |
| 2 | `AdminController::stats()` — 4 отдельных `count()`+`sum()` → 2 `selectRaw('COUNT(*), COALESCE(SUM(size), 0)')` | `AdminController.php` |
| 3–4 | `InboxController::acceptFiles/acceptSharedFolders` — `firstOrCreate` в цикле → один SELECT + `DB::table->insert()` + batch `whereIn->delete()` | `InboxController.php` |
| 5 | `SharedFolderFileController::updateSharedFolders` — `firstOrCreate` в цикле → `DB::table->insertOrIgnore(array)` | `SharedFolderFileController.php` |
| 6 | `ContactController::resolve` — `$contact->update()` в цикле → группировка по `resolved_user_id`, `whereIn->update()` | `ContactController.php` |
| 7 | Миграция: индексы на `shared_folders.owner_id`, `support_attachments.message_id`, `suggestion_attachments.suggestion_id`, `comment_audit_log.comment_id`, `pending_received_files.file_id` | новая миграция |

---

### Спринт 19 — выполнен ✅ (405/405 backend тестов)

| # | Что сделано | Файлы |
|---|-------------|-------|
| 1 | `FileController::moveFolder` — `'folder_id' => 'nullable|string'` дополнен `exists:folders,id,user_id,$userId` | `FileController.php` |
| 2–3 | `FileService::setTags` и `OrganizationController::attachTags` — tag_id фильтруется `Tag::where('user_id', $user->id)->whereIn('id', ...)` перед insert | `FileService.php`, `OrganizationController.php` |
| 4 | `ContactController::import` — добавлено `required_without:contacts.*.phone` / `required_without:contacts.*.email` | `ContactController.php` |
| 5 | `SharedFolderLink` — добавлен cast `'status' => ShareLinkStatus::class`; `isValid()` обновлён на сравнение enum-объектов | `SharedFolderLink.php` |
| 6 | `FilePolicy` — удалён мёртвый файл (56 строк, не вызывался через Gate или authorize) | `FilePolicy.php` (удалён) |

---

### Спринт 18 — выполнен ✅ (405/405 backend тестов)

| # | Что сделано | Файлы |
|---|-------------|-------|
| 1–2 | `SharingController::shareToContact/createLink` — `canAccess` → `isOwnedBy`: любой участник shared folder больше не может создать публичную ссылку на чужой файл | `SharingController.php` |
| 3 | `SharedFolderController::destroy` — добавлен `DB::transaction()` с рекурсивным `collectDescendantIds()`, каскадное удаление: SharedFolderFile, SharedFolderAccess, SharedFolderLink, SharedFolderCommentSettings, PendingReceivedSharedFolder | `SharedFolderController.php` |
| 4 | `FileVersionController::completeUpload` — race condition исправлен через `lockForUpdate()->exists()` + `File::where('has_versions', false)->update()` внутри транзакции | `FileVersionController.php` |
| 5 | `FileController::updateDescription` — `FileUserAccess::where()->first()` → `FileUserAccess::firstOrCreate()`: пользователь через shared folder больше не получает 404 | `FileController.php` |
| 6 | `SharedFolderFileController::updateSharedFolders` — `isOwnedBy \|\| FileUserAccess::exists()` → `isOwnedBy \|\| fileService->canAccess()` | `SharedFolderFileController.php` |

---

### Спринт 17 — выполнен ✅ (606/606 frontend тестов, 405/405 backend тестов)

| # | Что сделано | Файлы |
|---|-------------|-------|
| 1 | `File::canBeDeleted()` — `'saved'` → `AccessType::Saved->value`, `'active'` → `ShareLinkStatus::Active->value`. Добавлены import'ы `AccessType`, `ShareLinkStatus`. | `File.php` |
| 2 | `FileCardBuilder::buildVersionsList()` — `'available'` → `FileStatus::Available->value`. Добавлен import `FileStatus`. | `FileCardBuilder.php` |
| 3 | `TariffController` — `whereNotIn('status', ['deleted', 'uploading'])` → `[FileStatus::Deleted->value, FileStatus::Uploading->value]`, аналогично для `['deleted']`. Добавлен import `FileStatus`. | `TariffController.php` |
| 4 | `DocumentController` — `whereIn('access_type', ['shared'])` → `[AccessType::Shared->value]`. Добавлен import `AccessType`. | `DocumentController.php` |
| 5 | `CommentController` — `'shared'` default в `CommentScope::from(...)` → `CommentScope::Shared->value`. Добавлены import'ы `AccessType`, `SharedFolderAccessType` (для будущих задач). | `CommentController.php` |

---

### Спринт 16 — выполнен ✅ (405/405 backend тестов)

| # | Что сделано | Файлы |
|---|-------------|-------|
| 1–2 | `FileService::deleteFile()` — перед soft-delete собирает все S3 ключи: `storage_key` и `thumbnail_key` текущего файла + все ключи из `FileVersion` (если `has_versions`). Диспатчит `CleanOrphanedS3ObjectJob` с задержкой 5 мин. | `FileService.php` |
| 3 | `DocumentService::saveDocument()` — `$file->fresh()->updated_at` → `$file->refresh()->updated_at` (один SELECT вместо двух). | `DocumentService.php` |
| 4 | `FileService::pin()` — заменён if/else на `FileUserAccess::firstOrCreate([...], [...])` + `wasRecentlyCreated` для условной логики. Устраняет race condition при параллельных запросах. | `FileService.php` |

---

### Спринт 15 — выполнен ✅ (405/405 backend тестов)

| # | Что сделано | Файлы |
|---|-------------|-------|
| 1 | `FileCardBuilder::buildListItem()` расширен параметром `?int $addedBy = null`. При передаче — добавляет поля `added_by`, `shared_folder_only`, `view_url` в ответ; вместо `resolveListPreviewUrl` использует `resolvePreviewAndViewUrls` для получения обоих URL. | `FileCardBuilder.php` |
| 2 | `SharedFolderController::formatFileCard()` (34-строчный метод) удалён. Все вызовы заменены на `$this->cardBuilder->buildListItem($sf->file, $user, $sf->added_by)`. Ответ теперь включает все поля `buildListItem` + `added_by`/`view_url`/`shared_folder_only`. | `SharedFolderController.php` |

---

### Спринт 14 — выполнен ✅ (405/405 backend тестов)

| # | Что сделано | Файлы |
|---|-------------|-------|
| 1 | `AdminController::users()` — `DeviceSession::where()->value()` в map-цикле заменён на `addSelect` с correlated subquery `DeviceSession::select('last_active_at')->whereColumn('user_id', 'users.id')->orderByDesc()->limit(1)`. | `AdminController.php` |
| 2 | `ContactController::import()` — все email собираются до транзакции, выполняется один `User::whereIn('email', $emails)->keyBy('email')`, в foreach используется `$byEmail->get($email)`. | `ContactController.php` |
| 3 | `SupportAdminController::formatListItem()` — удалён `SupportMessage::where()->latest()->first()`, используется `$t->last_message_at` (уже загружен correlated subquery из Sprint 9). | `SupportAdminController.php` |
| 4 | `CommentService::processMentions()` — цикл `CommentMention::create()` заменён на `CommentMention::insert($rows)` с вручную сгенерированными ULID. Уведомления отправляются после bulk insert, `delivered_at` обновляется одним bulk update. | `CommentService.php` |
| 5 | `SupportAttachmentService` — оба метода (`storeSupportAttachments`, `storeSuggestionAttachments`): S3 upload в цикле (необходимо), DB insert — bulk `::insert($rows)`. Заодно `config('filesystems.default')` → явный `'s3'` во всём файле. | `SupportAttachmentService.php` |
| 6 | `FileService::setTags()` — уже обёрнут в транзакцию (Sprint 13); loop insert заменён на `DB::table('file_tags')->insert($toInsert)`. | `FileService.php` |
| 7 | `OrganizationController::attachTags()` — цикл `DB::table('file_tags')->insert()` заменён на bulk insert. | `OrganizationController.php` |
| 8 | `CommentService::fileEffectivePolicy()` — второй `SharedFolderCommentSettings::find($contextSharedFolderId)` (строка ~95) удалён; используется уже загруженный `$folderSettings`. | `CommentService.php` |
| 9 | Новая миграция `2026_05_20_000002_add_performance_indexes` — 4 индекса: `shared_folder_accesses.user_id`, `shared_folders.parent_id`, `pending_received_files.recipient_user_id`, `pending_received_shared_folders.recipient_user_id`. | новая миграция |

---

### Спринт 13 — выполнен ✅ (405/405 backend тестов)

| # | Что сделано | Файлы |
|---|-------------|-------|
| 1 | `SharedFolderFileController::addFile()` — добавлена проверка `$this->fileService->canAccess($user, $file)` (CRITICAL: без неё любой участник папки мог добавить чужой приватный файл по ID) + `if (!$file->isAvailable()) return error`. Инжектирован `FileService`. | `SharedFolderFileController.php` |
| 2 | `FileController::content()`/`preview()` — добавлена `|| $file->isUrlFile()` в проверку 404. `url_file` имеет `storage_key = null`; без защиты вызов `S3UrlService` падал бы с исключением. | `FileController.php` |
| 3 | `OrganizationController::attachTags()`/`detachTags()` — `$file->hasAccessFor($user)` (проверяет только FileUserAccess) заменено на `$this->fileService->canAccess($user, $file)` (включает shared folder). Инжектирован `FileService`. | `OrganizationController.php` |
| 4 | `DocumentLockController::heartbeat()` — добавлен `if (!$this->documentService->canEditDocument(...)) return $this->forbidden()`. Без проверки: если права были отозваны после `acquire`, heartbeat продолжал бы продлевать блокировку. | `DocumentLockController.php` |
| 5 | `FileService::setFavorite()` — вместо `if ($access) update` теперь `FileUserAccess::firstOrCreate([...], ['access_type' => Saved])` + `update`. Пользователи с доступом только через shared folder теперь могут добавлять в избранное. | `FileService.php` |
| 6 | `FileService::setTags()` — всё тело обёрнуто в `DB::transaction()`. loop insert → bulk insert (объединено со Спринтом 14). | `FileService.php` |
| 7 | `InboxController::files()` — убрано несуществующее поле `description` (нет в модели File); `thumbnail_url` теперь `$this->s3->resolveListPreviewUrl($p->file)`. Инжектирован `S3UrlService`. | `InboxController.php` |
| 8 | `SharedFolderLink::isValid()` — `$this->status === 'active'` → `ShareLinkStatus::Active->value`. Добавлен import `ShareLinkStatus`. | `SharedFolderLink.php` |

---

### Спринт 12 — выполнен ✅ (606/606 frontend тестов, 405/405 backend тестов)

| # | Что сделано | Файлы |
|---|-------------|-------|
| 1 | Все строки `'edit'`/`'view'` заменены на `SharedFolderAccessType::Edit->value` / `View->value` в 3 контроллерах и `DocumentService`. | `SharedFolderController.php`, `SharedFolderFileController.php`, `CommentSettingsController.php`, `DocumentService.php` |
| 2 | Строки `'active'`/`'disabled'` заменены на `ShareLinkStatus::Active->value` / `Disabled->value`. | `SharedFolderController.php` |
| 3 | Три экземпляра `'uploading'` → `FileStatus::Uploading->value` в `FileVersionController`. | `FileVersionController.php` |
| 4 | `'shared'`/`'saved'` → `AccessType::Shared->value` / `Saved->value` в `FileController` и `FileService` (2 места в `whereIn`). | `FileController.php`, `FileService.php` |
| 5 | `getAccessibleImages()` — хардкод списка MIME-типов изображений заменён на `->where('mime_type', 'like', 'image/%')`. | `DocumentService.php` |
| 6 | Создана команда `locks:clean` (`App\Console\Commands\CleanExpiredLocksCommand`) — удаляет `document_locks` с истёкшим `expires_at`. Зарегистрирована в `console.php` с расписанием `everyFiveMinutes()`. | `CleanExpiredLocksCommand.php` (новый), `routes/console.php` |

---

### Спринт 11 — выполнен ✅ (606/606 frontend тестов, 405/405 backend тестов)

| # | Что сделано | Файлы |
|---|-------------|-------|
| 1 | `CleanExpiredFilesJob` — добавлен блок удаления `thumbnail_key` отдельным вызовом `Storage::delete()` при наличии. Добавлен блок очистки зависших uploading-файлов без `expires_at`, старше 24 часов: удаляет S3-объекты и записи в БД. | `Jobs/CleanExpiredFilesJob.php` |
| 2 | `SupportAttachmentService` — инжектирован `S3UrlService`; `downloadUrl()` переключён на `$this->s3->tryTemporaryUrl($key, 30)` с fallback на `Storage::disk('s3')->url()`. | `Services/SupportAttachmentService.php` |
| 3 | 4 компонента с inline MIME-иконками переведены на `classifyMimeType()`: `public-link` (добавлен `fileIcon()`), `shared-folders` (метод `mimeIcon()`), `folders-tree` (метод `fileIconType()`), `public-shared-link` (метод `mimeIcon()`). Все дублирующиеся `MIME_ICONS`-объекты удалены. | `public-link.component.ts`, `shared-folders.component.ts`, `folders-tree.component.ts`, `public-shared-link.component.ts` |

---

### Спринт 10 — выполнен ✅ (606/606 frontend тестов, 405/405 backend тестов)

| # | Что сделано | Файлы |
|---|-------------|-------|
| 1 | `SharedFolderFileController::canAccessSharedFolder()` — добавлен `$visited = []` cycle guard + переход по `$current->parent` вместо `SharedFolder::find()`. Добавлены импорты `SharedFolderAccessType`. | `SharedFolderFileController.php` |
| 2 | `CommentSettingsController::canManageSharedFolder()` — полный обход цепочки предков с cycle guard; заменён inline check (только owner) на полный алгоритм как в `SharedFolderController::canAccess()`. | `CommentSettingsController.php` |
| 3 | `CommentService::canAccessSharedFolder()` — аналогичный полный обход с cycle guard; убрана упрощённая версия без обхода предков. | `CommentService.php` |
| 4 | `SharedFolderController::publicFiles()` — inline-маппинг из 25+ строк заменён на `$this->cardBuilder->buildPublicItem($sf->file)`. Добавлены инъекция `FileCardBuilder` и недостающие поля `status`, `expires_at`, `uploaded_at` в `buildPublicItem()`. | `SharedFolderController.php`, `FileCardBuilder.php` |

---

### Спринт 9 — выполнен ✅ (606/606 frontend тестов, 405/405 backend тестов)

| # | Что сделано | Файлы |
|---|-------------|-------|
| 1 | `SupportAdminController::index()` — N+1 в sort-callback устранён через `addSelect(['last_message_at' => correlated subquery])` + `orderByRaw('COALESCE(last_message_at, updated_at) DESC')`. Счётчик непрочитанных — через `withCount(['messages as unread_count' => ...])`. | `SupportAdminController.php` |
| 2 | `ContactController::resolve()` — два цикла с `User::where('email')` / `User::where('phone')` заменены на batch-запросы `User::whereIn('email', $emails)->keyBy('email')` / `User::whereIn('phone', $phones)->keyBy('phone')`. | `ContactController.php` |
| 3 | `CommentService::processMentions()` + `notifyNewComment()` — `User::find($id)` в foreach заменён на `User::whereIn('id', $ids)->get()->keyBy('id')` с предзагрузкой всех нужных пользователей. | `CommentService.php` |
| 4 | `SharedFolder::ancestorIds()` + `rootFolder()` — `SharedFolder::find($current->parent_id)` в while-цикле заменён на `$current = $current->parent` (Eloquent eager relation вместо ручного find). | `SharedFolder.php` |
| 5 | Новая миграция `2026_05_20_000001_add_composite_index_to_shared_folder_accesses` — уникальный составной индекс `(shared_folder_id, user_id)` на таблице `shared_folder_accesses`. | новый файл миграции |

---

### Спринт 8 — выполнен ✅ (606/606 frontend тестов, 405/405 backend тестов)

| # | Что сделано | Файлы |
|---|-------------|-------|
| 1 | `FileCardBuilder::buildCard()` — `is_pinned` теперь `$access?->pinned_at !== null` (было `false`); `expires_at` теперь `$file->expires_at?->toIso8601String()` (было `null`). | `FileCardBuilder.php` |
| 2 | `FileService::listFiles()` — добавлен фильтр `->where('status', FileStatus::Available)` к основному запросу. Мягко удалённые и uploading-файлы больше не попадают в список. | `FileService.php` |
| 3 | `FileService::cancelUpload()` — добавлена ранняя проверка `if ($file->status !== FileStatus::Uploading) return;`. Защищает Available-файлы от случайного удаления. | `FileService.php` |
| 4 | `DocumentService::canEditDocument()` — добавлен обход цепочки SharedFolder-предков с cycle guard: пользователь считается редактором, если он owner папки или имеет `SharedFolderAccess` с `type=Edit` на любом уровне иерархии. | `DocumentService.php` |
| 5 | `FileVersionController::initUpload()` — добавлен вызов `validateFileSizeLimit()` до `validateStorageQuota()`. | `FileVersionController.php` |

---

### Спринт 7 — выполнен ✅ (606/606 frontend тестов, 405/405 backend тестов)

| # | Что сделано | Файлы |
|---|-------------|-------|
| 1 | `formatSize()` — добавлен опциональный параметр `locale: 'ru' \| 'en' = 'ru'`. `'ru'` (по умолчанию): `—`, `N Б`, `N.N КБ`, `N.N МБ`, `N.N ГБ`. `'en'`: `—`, `N B`, `N.N KB`, `N.N MB`, `N.N GB`. 4 компонента заменяют local-метод на импорт: `file-list` (`'en'`), `public-link` (`'en'`), `admin` (`'ru'`, toFixed(1) для ГБ), `support` (`'ru'`, добавляется поддержка ГБ). 5 spec-файлов обновлены. | `shared/utils/format.ts`, `file-list.component.ts`, `public-link.component.ts`, `admin.component.ts`, `support.component.ts` + spec-файлы |
| 2 | `S3UrlService::fetchEtag(string $storageKey): ?string` — перенесена логика из `DocumentService::fetchEtagFromS3()`. `DocumentService` переключен на `$this->s3->fetchEtag()`, удалён `fetchEtagFromS3()`. Импорт `Storage` сохранён (put/get остались). | `S3UrlService.php`, `DocumentService.php` |

### Спринт 6 — выполнен ✅ (606/606 frontend тестов, 405/405 backend тестов)

| # | Что сделано | Файлы |
|---|-------------|-------|
| 1 | Создан `MarkdownEditorService` (`@Injectable()` без `providedIn`, предоставляется в `providers` каждого компонента). Вынесено: создание TipTap-редактора (c условными table-расширениями через `options.withTable`), `save(fileId)`, `revert()`, `reacquire(fileId)`, `insertImage()`, `cmd()`, `cmdHeading()`, `setImgWidth()`, `onImgWidthChange()`, `teardown()`, `loadDocument(fileId, getElement, options?)`. Сигналы: `doc`, `loading`, `saveStatus`, `originalContent`, `conflictError`, `isImageSelected`, `selectedImgWidth`, `imgWidthPx`, `editorEmpty`, `isInTable`. Computed: `lockState`, `canEdit`, `lockedByOther`. | новый `services/markdown-editor.service.ts` |
| 2 | `MarkdownEditorComponent`: добавлен `providers: [MarkdownEditorService]`; инжектирует сервис, форвардит все сигналы через прямые ссылки; `editor` и `periodicSaveTimer` — геттеры/сеттеры (compat с тестами). Оставлены: `showImagePicker`, `goBack()`, `takeover()`, `saveStatusLabel` (свой текст 'Есть несохранённые изменения'). | `markdown-editor.component.ts` |
| 3 | `MarkdownEditorPanelComponent`: аналогично; добавлен `{ withTable: true }` в `loadDocument`. Оставлены: `collapsed`, `showImagePicker`, `close()`, `onBodyClick()`, `insertTable()`, `tableCmd()`. `saveStatusLabel` ('Не сохранено'). Обновлён тест: захват ссылки на `mockEditor` перед `ngOnDestroy`. | `markdown-editor-panel.component.ts` |

---

### Спринт 5 — выполнен ✅ (606/606 frontend тестов, 405/405 backend тестов)

| # | Что сделано | Файлы |
|---|-------------|-------|
| 1 | `FileUploadService.upload()` расширен: `options?: { sharedFolderId?: string }`. Добавлен `UploadOptions` интерфейс. Инжектирован `SharedFoldersApiService`. При `sharedFolderId` используются `sfApi.initUpload(sfId, req)` / `sfApi.completeUpload(sfId, fileId, thumbKey)` вместо `filesApi`-эквивалентов. | `file-upload.service.ts` |
| 2 | `folders-tree.component.ts`: удалён метод `uploadToSharedFolder()` (~70 строк дублирующего кода). `uploadFile()` теперь передаёт `{ sharedFolderId: sfId }` в единый `uploadSvc.upload()`. Удалены сигналы `sfUploadPhase/Progress/Error`. Удалены инъекции `thumbnailSvc`, `http`, `authState`. Удалены импорты `HttpClient/Event/EventType`, `VideoThumbnailService`, `Observable/of/from/switchMap`, `AuthStateService`, `PLAN_FILE_LIMITS`, `InitUploadRequest`. Упрощён шаблон: `sfUploadPhase()` заменён на `uploadState()` во всех местах. | `folders-tree.component.ts`, `folders-tree.component.html` |
| 3 | `shared-folders.component.ts`: удалён inline метод `upload()` (~65 строк). Инжектирован `FileUploadService`. Удалены сигналы `uploadPhase/Progress/Error/uploadedFileId`. Удалены инъекции `authState`, `thumbnailSvc`, `http`. Удалены импорты `HttpClient/EventType/Event`, `Observable/of/from/switchMap`, `AuthStateService`, `VideoThumbnailService`, `InitUploadRequest`, `PLAN_FILE_LIMITS`. `resetUpload()` → `uploadSvc.reset()`. Шаблон обновлён на `uploadState().phase/progress/error`. | `shared-folders.component.ts`, `shared-folders.component.html` |

---

### Спринт 4 — выполнен ✅ (405/405 backend тестов, 0 новых TS ошибок)

| # | Что сделано | Файлы |
|---|-------------|-------|
| 1 | Создан `format.ts` — `formatSize(bytes?: number\|null): string` (русская локаль: Б/КБ/МБ/ГБ, `'—'` для 0/null). Заменены 6 разных inline-реализаций: `share-target`, `inbox`, `public-shared-link`, `shared-folders`, `file-detail`, `tariffs` (`formatBytes`). | новый `shared/utils/format.ts`, 6 компонентов |
| 2 | Создан `file.ts` — `classifyMimeType(contentKind, mime): FileIconType` (добавлен тип `note`) и `canViewInBrowser(mime, viewUrl, contentKind?): boolean`. `FileTypeIconComponent::iconType` делегирует в `classifyMimeType`, добавлен `@case('note')` SVG. Заменены методы в `shared-folders` и `file-detail`. | новый `shared/utils/file.ts`, `FileTypeIconComponent`, 2 компонента |
| 3 | Создан `tree.ts` — generic `flattenTree<T extends {children?: T[]}>(nodes, depth?): {node, depth}[]`. `folders-tree` использует с маппингом `{folder, depth}` (шаблон не тронут); `file-detail` использует через `toFlatFolders()`. Удалены два private метода `flattenTree`. | новый `shared/utils/tree.ts`, 2 компонента |
| 4 | Создан `limits.ts` — `PLAN_FILE_LIMITS` константа. Удалены 3 дублирующихся объекта из `shared-folders`, `folders-tree`, `file-upload.service`. | новый `shared/constants/limits.ts`, 3 файла |

---

### Спринт 3 — выполнен ✅ (405/405 тестов)

| # | Что сделано | Файлы |
|---|-------------|-------|
| 1 | `FileService::canAccess()` — `$current->parent_id ? SharedFolder::find(...)` → `$current->parent` (Eloquent relation вместо ручного запроса). `DocumentService::canViewDocument()` полностью делегирует в `FileService::canAccess()`; удалены неиспользуемые импорты `SharedFolder`, `SharedFolderAccess`, `SharedFolderFile`. `SharedFolderController::canAccess()` — аналогичная замена. | `FileService.php:189`, `DocumentService.php:169`, `SharedFolderController.php:69` |
| 2 | Добавлены `validateFileSizeLimit(User, int): ?array` и `validateStorageQuota(User, int): ?array` в `FileService` — возвращают `null` (OK) или `['code' => ..., 'data' => [...]]`. Заменены inline quota checks в `FileController::initUpload()`, `SharedFolderController::initUpload()`, `FileVersionController::initUpload()`. Обновлён mock в `FileUploadTest`. | `FileService.php`, `FileController.php:122`, `SharedFolderController.php:486`, `FileVersionController.php:56`, `FileUploadTest.php:16` |
| 3+4 | N+1 в `formatFolder()` устранён: `$folder->children()->count()` → `$folder->children_count ?? 0`. Все точки загрузки папок обновлены: `index()`, `subfolders()`, `allFlat()` → `withCount('children')` в запросах; `update()` → `loadCount(['sharedFiles as files_count', 'children'])`; `store()`, `createSubfolder()` → `$folder->children_count = 0`. | `SharedFolderController.php:83,201,315,347,261,293` |
| 5 | `File::canBeDeleted()` — два отдельных запроса заменены на short-circuit `&&`: второй запрос не выполняется, если первый уже вернул `true` (есть saved-доступ). | `File.php:143` |

---

### Спринт 2 — выполнен ✅ (405/405 тестов)

| # | Что сделано | Файлы |
|---|-------------|-------|
| 1 | Создан `S3UrlService` с методами: `generatePresignedPutUrl`, `generateDownloadUrl`, `generateVersionDownloadUrl`, `resolvePreviewAndViewUrls`, `resolveListPreviewUrl`, `resolveVersionPreviewUrl`, `resolveOgImageUrl`, `contentRedirectUrl`, `previewRedirectUrl`, `tryTemporaryUrl` (с логированием ошибок). TTL-константы унифицированы в одном месте. | новый `Services/S3UrlService.php` |
| 2 | Создан `MimeService` с методами: `classify`, `getGroup`, `label`, `isPreviewable`, `isViewableInBrowser`, `buildSqlTypeGroupFilter`. Вся MIME-логика собрана в одном классе. | новый `Services/MimeService.php` |
| 3 | Создан `FileCardBuilder` с методами: `buildCard` (полная карточка), `buildListItem` (список + добавлены `is_owner`, `access_type`, `is_favorite`), `buildPublicItem` (публичная ссылка), `buildVersionsList`, `buildVersionItem`. Теги грузятся через Eloquent-relation с `wherePivot('user_id')`. | новый `Services/FileCardBuilder.php` |
| 4 | `FileService` — инжектированы S3UrlService, MimeService, FileCardBuilder; все публичные методы делегируют в новые сервисы; удалены `Storage::disk` вызовы, inline MIME-логика и raw `DB::table('file_tags')` | `Services/FileService.php` |
| 5 | `DocumentService` — инжектирован S3UrlService; заменены 2 вызова `Storage::disk` в `formatImageItem` и `hydrateImageUrls` | `Services/DocumentService.php` |
| 6 | `FileController` — инжектирован S3UrlService; `content()` и `preview()` используют `contentRedirectUrl` / `previewRedirectUrl`; удалён `Storage` import | `Controllers/Files/FileController.php` |
| 7 | `SharingController` — инжектированы S3UrlService, MimeService, FileCardBuilder; `resolveLink()` использует `buildPublicItem()`; `buildOgDescription()` → `mime->label()`; `buildOgImage()` → `s3->resolveOgImageUrl()`; удалён `Storage` import | `Controllers/Files/SharingController.php` |
| 8 | `FileVersionController` — инжектированы MimeService, S3UrlService; `getMimeGroup()` удалён, заменён на `mime->getGroup()`; S3 download вызов → `s3->generateVersionDownloadUrl()` | `Controllers/Files/FileVersionController.php` |

---

### Спринт 1 — выполнен ✅ (405/405 тестов)

| # | Что сделано | Файлы |
|---|-------------|-------|
| 1 | Добавлен `$visited = []` cycle guard в оба метода `canAccess()` | `FileService.php:144`, `SharedFolderController.php:43` |
| 2 | `completeUpload` — оптимистичная блокировка через `where('status', Uploading)->update()`, повторный вызов возвращает текущий статус без дублирования | `FileService.php:88` |
| 3 | `checkStorageQuota` — фильтр по `status=Available` + учёт `FileVersion.size` через `whereHas` | `FileService.php:28` |
| 4 | `formatFileCard` — link-поля (`link_url`, `link_title`, `link_image_url`, `link_site_name`) теперь заполняются только при `content_kind='url_file'` | `SharedFolderController.php:84` |
| 5 | `cancelUpload` — диспатч `CleanOrphanedS3ObjectJob` с задержкой 5 мин; новый Job удаляет `storage_key` и `thumbnail_key` из S3 | `FileService.php:117`, новый `Jobs/CleanOrphanedS3ObjectJob.php` |
