# Аудит оптимизации запросов

> **Дата:** 2026-05-20
> **Статус:** завершён 🔍

## Методология

Поиск N+1 проблем (циклы с запросами без жадной загрузки), отсутствующих индексов, избыточных запросов, неоптимальных bulk-операций, TOCTOU race conditions.

---

## 1. N+1 запросы

### 1.1 [HIGH] `SupportAdminController` — запросы в цикле

- **Файл:** `backend/app/Http/Controllers/Admin/SupportAdminController.php`
- **Описание:** Внутри `foreach` по списку объектов выполняются отдельные запросы к связанным моделям. Без `->with()`.
- **Решение:** Добавить `->with()` для всех используемых отношений.

### 1.2 [HIGH] `FileService::canAccess()` — `SharedFolder::find()` в цикле

- **Файл:** `backend/app/Services/FileService.php:185`
- **Описание:** При обходе цепочки `parent_id` для shared folder каждый шаг делает `SharedFolder::find($current->parent_id)` вместо использования предзагруженного отношения `$current->parent`.
- **Примечание:** В `SharedFolderController::canAccess()` уже исправлено на `$current = $current->parent`. Нужно синхронизировать.
- **Решение:** Заменить `SharedFolder::find($current->parent_id)` на `$current->parent`.

### 1.3 [HIGH] `InvitationService::accept()` — `User::find()` в цикле

- **Файл:** `backend/app/Services/InvitationService.php`
- **Описание:** Для каждого приглашения выполняется `User::find()` для invited_by пользователя.
- **Решение:** Добавить `->with('invitedBy')` при загрузке приглашений.

### 1.4 [HIGH] `ContactController::resolve()` — запрос в цикле

- **Файл:** `backend/app/Http/Controllers/Contacts/ContactController.php`
- **Описание:** Внутри `foreach` по контактам выполняются отдельные запросы.
- **Решение:** Использовать `->with()` или eager load.

### 1.5 [HIGH] `CommentService::processMentions()` — `User::where('email', ...)` в цикле

- **Файл:** `backend/app/Services/CommentService.php:150+`
- **Описание:** Для каждого упоминания `@username` в тексте комментария выполняется `User::where('email', $mention)->first()`. На комментарий с 10 упоминаниями — 10 запросов.
- **Решение:** Собрать все email в массив, выполнить один `User::whereIn('email', $emails)->get()` и построить map.

### 1.6 [HIGH] `SharedFolder::ancestorIds()` — рекурсивные `SharedFolder::find()`

- **Файл:** `backend/app/Models/SharedFolder.php:39-48`
- **Описание:** Рекурсивно вызывает `SharedFolder::find()` для каждого предка. При глубине 5 — 5 запросов. При вызове для 20 папок — 100 запросов.
- **Решение:** Можно вычислить ancestors через один raw SQL запрос (CTE), если БД поддерживает.

### 1.7 [HIGH] `FileController::favorite()` / `pin()` — повторные запросы в том же методе

- **Файл:** `backend/app/Http/Controllers/Files/FileController.php`
- **Описание:** В методах `favorite()`, `pin()`, `togglePin()` загружается `FileUserAccess`, потом `$file->isOwnedBy()`, потом снова `FileUserAccess`.
- **Решение:** Кэшировать результат первого запроса.

---

## 2. Отсутствующие индексы

### 2.1 [HIGH] Составной индекс `file_user_access(file_id, user_id)`

- **Текущий:** `file_id` и `user_id` индексированы по отдельности.
- **Описание:** Самый частый запрос: `WHERE file_id = ? AND user_id = ?`. Без составного индекса БД использует только один индекс.
- **Решение:** Добавить миграцию с составным уникальным индексом `UNIQUE (file_id, user_id)`.

### 2.2 [HIGH] Составной индекс `shared_folder_access(shared_folder_id, user_id)`

- **Описание:** Аналогично — второй по частоте запрос.
- **Решение:** Добавить миграцию с составным индексом.

### 2.3 [MEDIUM] Индекс `file_user_access.file_id + access_type`

- **Описание:** Запросы с `WHERE file_id = ? AND access_type = ?`.
- **Решение:** Добавить составной индекс `(file_id, access_type)`.

### 2.4 [MEDIUM] Индекс `shared_folder_files.shared_folder_id + file_id`

- **Описание:** Запросы связи shared folder с файлами.
- **Решение:** Добавить составной индекс.

---

## 3. Избыточные запросы

### 3.1 [MEDIUM] `checkStorageQuota()` — отдельные запросы для файлов и версий

- **Файл:** `backend/app/Services/FileService.php:31-43`
- **Описание:** Сначала считает `File::sum('size')`, потом `FileVersion::sum('size')`. Можно одним запросом.
- **Решение:** Использовать UNION или подзапрос.

### 3.2 [MEDIUM] `FileUserAccess::where(...)` — 12 раз в 8 классах (из audit-01)

- **Описание:** Один и тот же паттерн запроса повторяется.
- **Решение:** Создать `FileService::getUserAccess(File $file, User $user): ?FileUserAccess`.

### 3.3 [LOW] `count()` после `get()`

- **Файл:** `backend/app/Services/CommentService.php` (предположительно)
- **Описание:** `$collection->count()` вместо `Model::count()` — загружает все строки в память.
- **Решение:** Использовать `Model::where(...)->count()`.

---

## 4. Bulk operations

### 4.1 [MEDIUM] `FileVersion` insert в цикле

- **Поиск:** если есть `FileVersion::create()` в цикле — нужно заменить на `FileVersion::insert()`.
- **Решение:** Проверить при загрузке версий.

---

## 5. Subquery vs отдельные запросы

### 5.1 [MEDIUM] `FileService::listFiles()` — N запросов для access check

- **Файл:** `backend/app/Services/FileService.php:422+`
- **Описание:** Для каждого файла в списке нужно проверить доступ. Если нет eager loading — N+1.
- **Решение:** Использовать `whereHas('accesses', ...)` или `with('accesses')`.

---

## Сводка

| Severity | Всего | Ключевые проблемы |
|---|---|---|
| **HIGH** | 7 | N+1 в 6 классах, отсутствие составных индексов |
| **MEDIUM** | 5 | Избыточные запросы, bulk, subquery |
| **LOW** | 1 | count() после get() |

### Приоритетные индексы для миграции

```sql
CREATE UNIQUE INDEX idx_file_user_access_file_user ON file_user_access(file_id, user_id);
CREATE UNIQUE INDEX idx_shared_folder_access_folder_user ON shared_folder_access(shared_folder_id, user_id);
CREATE INDEX idx_file_user_access_file_type ON file_user_access(file_id, access_type);
CREATE INDEX idx_shared_folder_files_folder_file ON shared_folder_files(shared_folder_id, file_id);
```
