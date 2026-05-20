# Re-аудит² оптимизации запросов (после спринтов 1–17)

> **Дата:** 2026-05-20
> **Статус:** завершён 🔍
> **Раунд:** 3-й финальный аудит

---

## 🔴 CRITICAL

### 1.1 N+1 — `CleanExpiredFilesJob` — `canBeDeleted()` в цикле

- **Файл:** `backend/app/Jobs/CleanExpiredFilesJob.php:39-51,61-71`
- **Описание:** В цикле `foreach ($files as $file)` вызывается `$file->canBeDeleted()`, который делает **2 отдельных запроса** для каждого файла (`accesses()->exists()` + `shareLinks()->exists()`). При 100 файлах → 200 лишних запросов.
- **Решение:** Предзагрузить `accesses` и `shareLinks` через `withCount` или вынести в подзапрос.

### 1.2 N+1 — ancestor chain lazy load `->parent` — 7 методов в 5 файлах

| # | Файл | Метод | Строки |
|---|------|-------|--------|
| 1 | `FileService.php` | `canAccess()` | 177-195 |
| 2 | `DocumentService.php` | `canEditDocument()` | 173-187 |
| 3 | `CommentService.php` | `canAccessSharedFolder()` | 382-397 |
| 4 | `SharedFolderController.php` | `canAccess()` | 47-77 |
| 5 | `SharedFolderFileController.php` | `canAccessSharedFolder()` | 24-44 |
| 6 | `CommentSettingsController.php` | `canManageSharedFolder()` | 181-197 |
| 7 | `OrganizationController.php` | `isDescendant()` | 429-442 |

- **Описание:** Каждый `$current->parent` при незагруженной связи — отдельный SQL-запрос. Если глубина вложенности 5, а проверка вызывается 10 раз → 50 запросов. Особенно опасно в `SharedFolderFileController::updateFolders()` — вызов в цикле без `with('parent')`.
- **Решение:** Добавить `with('parent')` при загрузке папок, либо предзагрузить всю ancestor chain.

---

## 🟡 MEDIUM

### 2.1 Bulk insert/update в цикле — 5 мест

| # | Файл | Строки | Описание |
|---|------|--------|----------|
| 1 | `InboxController.php` | 67-76 | `firstOrCreate` в цикле по pending файлам |
| 2 | `InboxController.php` | 144-152 | `firstOrCreate` в цикле по pending shared folders |
| 3 | `SharedFolderFileController.php` | 124-129 | `firstOrCreate` в цикле для добавления в shared folders |
| 4 | `ContactController.php` | 216-223 | `$contact->update()` в цикле (resolve) |
| 5 | `InvitationService.php` | 55-73 | Вложенные циклы: update + firstOrCreate + delete |

- **Решение:** `upsert()`, массовый `whereIn('id', $ids)->update()`, предзагрузка `ContactPendingShare`.

### 2.2 Избыточные дублирующиеся запросы в `AdminController::stats()`

- **Файл:** `backend/app/Http/Controllers/Admin/AdminController.php:190-201`
- **Описание:** Два запроса `File::whereIn('id', $ids)->whereNotIn('status', ['deleted'])->count()` + `->sum('size')`. MariaDB сканирует одни строки дважды.
- **Решение:** `->selectRaw('COUNT(*) as total, COALESCE(SUM(size), 0) as total_size')->first()`.

### 2.3 Отсутствующие индексы

| Таблица | Колонка | Используется в |
|---------|---------|----------------|
| `shared_folders` | `owner_id` | `SharedFolder::where('owner_id', $user->id)` |
| `support_attachments` | `message_id` | `$message->attachments`, `whereHas('message', ...)` |
| `suggestion_attachments` | `suggestion_id` | `SuggestionAttachment::where('suggestion_id', $id)` |
| `comment_audit_log` | `comment_id` | запросы аудита по комментарию |
| `pending_received_files` | `file_id` | поиск дубликатов перед `firstOrCreate` |

- **Решение:** Добавить простые индексы на эти колонки.

---

## 🟢 LOW

### 3.1 `FileCardBuilder::buildCard()` — lazy load owner/tags

- **Файл:** `backend/app/Services/FileCardBuilder.php:45-51`
- **Описание:** `$file->owner` и `$file->tags` не предзагружены. При вызове в списковом контексте — N+1. Сейчас используется только для show.
- **Решение:** Убедиться, что вызывающая сторона использует `with('owner', 'tags')`.

---

## Сводка

| Severity | Всего | Проблемы |
|---|---|---|
| **CRITICAL** | 2 | N+1 CleanExpiredFilesJob canBeDeleted, ancestor chain lazy load (7 мест) |
| **MEDIUM** | 3 | Bulk в цикле (5 мест), дубль в AdminController, 5 отсутствующих индексов |
| **LOW** | 1 | FileCardBuilder lazy load |
