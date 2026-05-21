# Re-аудит³ оптимизации запросов (после спринтов 1–22)

> **Дата:** 2026-05-20
> **Статус:** завершён 🔍
> **Раунд:** 4-й финальный аудит

---

## 🔴 CRITICAL

### 1. N+1 — parent chain lazy load — 6 методов в 5 файлах

Во всех шести случаях паттерн одинаков: `while ($current)` с `$current->parent` (lazy-loaded BelongsTo) — каждая итерация генерирует отдельный SQL-запрос.

#### 1a. `FileService::canAccess()` — вызывается на каждый file-запрос

- **Файл:** `backend/app/Services/FileService.php:178-196`
- **Описание:** Внутри `foreach` по `$sharedFolderIds` вызывает `SharedFolder::find()` (N+1 на сами папки), затем `$current->parent` в цикле (N+1 на глубину). Если файл в 3 папках глубиной 3 → 3 + 3×3 = 12 лишних запросов. `canAccess()` вызывается из большинства контроллеров.
- **Решение:** Предзагрузить все `SharedFolder` через `whereIn('id', $sharedFolderIds)->get()`, затем ходить по коллекции в памяти.

#### 1b. `SharedFolderController::canAccess()` — вызывается перед каждой операцией с папкой

- **Файл:** `backend/app/Http/Controllers/SharedFolders/SharedFolderController.php:59-89`
- **Описание:** Используется в `subfolders()`, `files()`, `initUpload()`, `completeUpload()`, `addUrlFile()`, `createSubfolder()`. Для глубины 5 → 5 лишних запросов на вызов.
- **Решение:** Предзагрузить ancestor chain одного запросом перед вызовом canAccess (как сделано в `index()` — строки 140-151).

#### 1c. `SharedFolderFileController::canAccessSharedFolder()` — N×M в `updateSharedFolders()`

- **Файл:** `backend/app/Http/Controllers/Files/SharedFolderFileController.php:24-43`
- **Описание:** Вызывается в цикле по `$allFolderIds` (строка 108). Каждая итерация делает lazy load parent chain. N папок × M глубина — экспоненциальный рост.
- **Решение:** Предзагрузить ancestor chain для всех `$allFolderIds` одним запросом.

#### 1d. `CommentService::canAccessSharedFolder()` — вызывается из CommentThreadController

- **Файл:** `backend/app/Services/CommentService.php:382-397`
- **Описание:** Вызывается из `canAccessTarget()`, которая вызывается из `CommentThreadController::index()`, `show()`, `markRead()`, `CommentController::store()`.
- **Решение:** Аналогично — предзагрузить ancestor chain.

#### 1e. `CommentSettingsController::canManageSharedFolder()` — lazy load

- **Файл:** `backend/app/Http/Controllers/Comments/CommentSettingsController.php:181-197`
- **Описание:** Вызывается из `updateSharedFolderSettings()` и `getSharedFolderSettings()`.
- **Решение:** Предзагрузить ancestor chain.

#### 1f. `DocumentService::canEditDocument()` — find + lazy load в цикле

- **Файл:** `backend/app/Services/DocumentService.php:166-200`
- **Описание:** Аналогично `FileService::canAccess()` — `SharedFolder::find()` + `$current->parent` в цикле.
- **Решение:** Предзагрузить через `whereIn('id', ...)->get()`.

---

## 🟠 HIGH

### 2. `FileCardBuilder::buildCard()` — owner/tags без предзагрузки

- **Файл:** `backend/app/Services/FileCardBuilder.php:45-54`
- **Описание:** `$file->tags()` (line 45) — отдельный запрос через pivot. `$file->owner` (line 51) — lazy load BelongsTo. Вызывающий код (`FileController::show()`, line 71) делает `File::find($fileId)` без `->with(['owner', 'tags'])`. Каждый просмотр файла → 2 лишних запроса.
- **Решение:** В `FileController::show()` заменить на `File::with(['owner', 'tags'])->find($fileId)`.

### 3. `DocumentService::buildDocumentResponse()` — `$file->updatedByUser` lazy load

- **Файл:** `backend/app/Services/DocumentService.php:352`
- **Описание:** `formatUser($file->updatedByUser)` — lazy load на каждый вызов (createDocument, getDocument, saveDocument).
- **Решение:** `$file->load('updatedByUser')` перед вызовом, или eager load в caller'ах.

### 4. `OrganizationController::isDescendant()` — lazy load parent chain

- **Файл:** `backend/app/Http/Controllers/Organization/OrganizationController.php:435-448`
- **Описание:** `$node = $node->parent` в цикле. Вызывается однократно на `updateFolder()`, не в списковом контексте, но при глубине 5 → 5 запросов.
- **Решение:** Предзагрузить ancestor chain одним запросом.

---

## 🔵 LOW

### 5. `FileService::canAccess()` — `SharedFolder::find()` в цикле

- **Файл:** `backend/app/Services/FileService.php:190`
- **Описание:** `$current = SharedFolder::find($folderId)` внутри `foreach`. Если файл в 3 shared folders → 3 отдельных запроса.
- **Решение:** `SharedFolder::whereIn('id', $sharedFolderIds)->get()->keyBy('id')`.

### 6. `DocumentService::canEditDocument()` — `SharedFolder::find()` в цикле

- **Файл:** `backend/app/Services/DocumentService.php:188`
- **Описание:** То же, что #5, но в DocumentService.
- **Решение:** Аналогично.

### 7. `Folder::ancestorIds()`, `SharedFolder::ancestorIds()`, `SharedFolder::rootFolder()`

- **Файл:** `backend/app/Models/Folder.php:62-77`, `SharedFolder.php:39-48,53-60`
- **Описание:** Все три содержат lazy load parent chain. **Не вызываются нигде в текущем коде.** Потенциальный N+1 при revival.
- **Решение:** Добавить предупреждение в docblock или переписать при revival.

### 8. Индексы

- **Проверены все частые `where()` по внешним ключам** — все покрыты индексами (миграции: `2026_05_20_194246`, `2026_05_20_000002`, `2026_05_20_000001`). ✅
- **Пропусков не найдено.**

---

## Сводка

| Severity | Всего | Проблемы |
|----------|-------|----------|
| **CRITICAL** | 6 | Parent chain lazy load в 6 методах (FileService, SharedFolderController, SharedFolderFileController, CommentService, CommentSettingsController, DocumentService) |
| **HIGH** | 3 | FileCardBuilder owner/tags, DocumentService updatedByUser, OrganizationController isDescendant |
| **LOW** | 3 | SharedFolder::find в цикле (×2), неиспользуемые методы с N+1 |

**Всего: 12 находок** (6 CRITICAL, 3 HIGH, 3 LOW)
