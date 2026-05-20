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

## Итоги по задачам

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
