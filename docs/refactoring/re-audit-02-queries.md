# Re-аудит оптимизации запросов (после спринтов 1–12)

> **Дата:** 2026-05-20
> **Статус:** завершён 🔍

---

## 1. N+1 запросы

### 1.1 [CRITICAL] N+1 в ancestor chain — 4 файла

| Файл | Строки | Описание |
|------|--------|----------|
| `FileService.php` | 177-195 | `foreach ($sharedFolderIds) { $current = SharedFolder::find($id); while ($current) { ... SharedFolderAccess::where(...)->exists() ... } }` |
| `DocumentService.php` | 173-187 | Аналогичный цикл в `canEditDocument()` |
| `CommentService.php` | 361-383 | Аналогично в `canAccessFile()` и `canAccessSharedFolder()` |
| `SharedFolderController.php` | 52-76 | Аналогично в `canAccess()` |

При глубокой вложенности shared folders (5+ уровней) каждый вызов порождает 5+ SQL-запросов. Паттерн дублируется в 4 местах.

### 1.2 [CRITICAL] `SupportAdminController::formatListItem()` — отдельный запрос для каждого тикета

- **Файл:** `SupportAdminController.php:225`
- **Описание:** `SupportMessage::where('ticket_id', $t->id)->latest()->first()` в форматере для каждого тикета, хотя `index()` уже вычисляет `last_message_at` через correlated subquery.
- **Решение:** Использовать `$t->last_message_at` вместо отдельного запроса.

### 1.3 [CRITICAL] `AdminController::users()` — N+1 для last_active_at

- **Файл:** `AdminController.php:31-48`
- **Описание:** `DeviceSession::where('user_id', $user->id)->orderByDesc('last_active_at')->value('last_active_at')` в `map()` для каждого пользователя.
- **Решение:** `addSelect` с correlated subquery или `with('deviceSessions')`.

### 1.4 [HIGH] `ContactController::import()` — `User::where('email', ...)` в цикле

- **Файл:** `ContactController.php:173-189`
- **Описание:** Для каждого импортируемого контакта отдельный `User::where('email', ...)->first()`.
- **Решение:** Batch resolve через `User::whereIn('email', $emails)->get()->keyBy('email')`.

---

## 2. Bulk insert в цикле

### 2.1 [HIGH] `CommentMention::create()` в `processMentions()`

- **Файл:** `CommentService.php:305-323`
- **Описание:** Для каждого упоминания отдельный insert.
- **Решение:** `CommentMention::insert([...])` массово.

### 2.2 [HIGH] `SupportAttachment::create()` / `SuggestionAttachment::create()` в цикле

- **Файл:** `SupportAttachmentService.php:62-94`
- **Описание:** Для каждого вложения отдельный insert (до 20).
- **Решение:** `::insert([...])`.

### 2.3 [HIGH] `DB::table('file_tags')->insert()` в цикле

- **Файлы:** `OrganizationController.php:335-341`, `FileService.php:350-356`
- **Описание:** Для каждого tag_id отдельный insert.
- **Решение:** Собрать все в один `insert()`.

---

## 3. Избыточные запросы

### 3.1 [HIGH] `SupportTicketController::index()` — `count()` после `get()`

- **Файл:** `SupportTicketController.php:41`
- **Описание:** `$total = $tickets->count()` на коллекции после `get()` — загружает все тикеты в память.
- **Решение:** `$query->count()` до `->get()`.

### 3.2 [HIGH] Двойной `SharedFolderCommentSettings::find()`

- **Файл:** `CommentService.php:67,95`
- **Описание:** Один и тот же `find()` вызывается дважды за вызов `fileEffectivePolicy()`.
- **Решение:** Кэшировать в `$folderSettings`.

### 3.3 [MEDIUM] `DocumentService::saveDocument()` — избыточный `fresh()`

- **Файл:** `DocumentService.php:151`
- **Описание:** `$file->fresh()->updated_at` — отдельный SELECT. Можно `$file->refresh()`.
- **Решение:** Заменить на `$file->refresh()->updated_at`.

---

## 4. Отсутствующие индексы

### 4.1 [MEDIUM] `shared_folder_accesses.user_id`

- **Текущий:** Есть `unique(shared_folder_id, user_id)`, нет отдельного на `user_id`.
- **Запросы:** `WHERE user_id = ?` во многих местах.

### 4.2 [MEDIUM] `shared_folders.parent_id`

- **Текущий:** FK есть, индекса нет.
- **Запросы:** `WHERE parent_id = ?` в `subfolders()`, `allFlat()`.

### 4.3 [MEDIUM] `pending_received_files.recipient_user_id` + `pending_received_shared_folders.recipient_user_id`

- **Текущий:** Индекс отсутствует.
- **Запросы:** Все запросы в `InboxController` фильтруют по `recipient_user_id`.

---

## 5. Прочее

### 5.1 [MEDIUM] N+1 в `InvitationService::accept()` — двойной вложенный foreach

- **Файл:** `InvitationService.php:55-73`
- **Описание:** Для каждого контакта `ContactPendingShare::where(...)->get()` + `FileUserAccess::firstOrCreate()`.

---

## Сводка

| Severity | Всего | Проблемы |
|---|---|---|
| **CRITICAL** | 3 | ancestor chain N+1 (4 файла), SupportAdminController formatListItem, AdminController users |
| **HIGH** | 5 | Bulk insert в 3 местах, count() после get(), двойной find() |
| **MEDIUM** | 5 | 3 отсутствующих индекса, избыточный fresh(), InvitationService |
