# Re-аудит² логических ошибок (после спринтов 1–17)

> **Дата:** 2026-05-20
> **Статус:** завершён 🔍
> **Раунд:** 3-й финальный аудит

---

## 🔴 CRITICAL

### 1. `SharedFolderController::destroy` — отсутствует каскадное удаление

- **Файл:** `backend/app/Http/Controllers/SharedFolders/SharedFolderController.php:330-343`
- **Описание:** При удалении общей папки выполняется только `$folder->delete()`. Не удаляются:
  - дочерние папки (`SharedFolder` с `parent_id`)
  - связи с файлами (`SharedFolderFile`)
  - записи доступов (`SharedFolderAccess`)
  - ссылки (`SharedFolderLink`)
  - настройки комментариев (`SharedFolderCommentSettings`)
  - `PendingReceivedSharedFolder`
- **Последствия:** Orphan-записи в БД. Дочерние папки теряют связь с корнем.
- **Решение:** Каскадное удаление через `DB::transaction()` или `cascadeOnDelete()` в миграции.

### 2. `FileVersionController` — race condition при создании первой версии

- **Файл:** `backend/app/Http/Controllers/Files/FileVersionController.php:126-144`
- **Описание:** Две параллельные транзакции могут одновременно прочитать `!$file->has_versions === true` и обе создать версию #1. Затем обе вычислят `nextNumber = 2` и попытаются создать #2.
- **Решение:** Использовать `File::where('id', $id)->where('has_versions', false)->update(['has_versions' => true])` как optimistic lock.

---

## 🟠 HIGH

### 3. `FileController::updateDescription` — не работает для shared-folder доступа

- **Файл:** `backend/app/Http/Controllers/Files/FileController.php:180-186`
- **Описание:** `canAccess()` (FileService) проверяет доступ через shared folder, но `updateDescription` затем ищет `FileUserAccess::where(...)->first()` — если доступа только через shared folder (без прямой записи), возвращается 404 «Access not found».
- **Решение:** `FileUserAccess::firstOrCreate()` как в `setFavorite()`.

### 4. `SharingController::shareToContact/createLink` — `canAccess` вместо `isOwnedBy`

- **Файл:** `backend/app/Http/Controllers/Files/SharingController.php:53,233`
- **Описание:** `canAccess` проверяет любой доступ (включая shared folder), но шаринг и создание ссылок должен быть доступен только владельцу. Любой участник shared folder может создать публичную ссылку.
- **Решение:** Заменить `canAccess` на `isOwnedBy`.

---

## 🟡 MEDIUM

### 5. `SharedFolderFileController::updateSharedFolders` — неполная проверка доступа

- **Файл:** `backend/app/Http/Controllers/Files/SharedFolderFileController.php:85-87`
- **Описание:** `$hasAccess` проверяет `isOwnedBy || FileUserAccess::exists()`, но **не** учитывает доступ через shared folder (который есть в `FileService::canAccess`).
- **Решение:** `$file->isOwnedBy($user) || $this->fileService->canAccess($user, $file)`.

### 6. `FileController::moveFolder` — не валидирует `folder_id`

- **Файл:** `backend/app/Http/Controllers/Files/FileController.php:358`
- **Описание:** Правило валидации: `'folder_id' => 'nullable|string'` — нет проверки, что папка принадлежит пользователю. Можно указать чужой folder_id.
- **Решение:** Добавить `exists:folders,id,user_id,' . $user->id` или проверку в контроллере.

### 7. `setTags`/`attachTags` — `tag_id` без проверки владельца

- **Файлы:** `backend/app/Services/FileService.php:341`, `OrganizationController.php:320`
- **Описание:** `tag_id` не проверяется на принадлежность пользователю перед записью в `file_tags`. Можно «прикрепить» чужой тег.
- **Решение:** `Tag::where('user_id', $user->id)->whereIn('id', $tagIds)->pluck('id')`.

### 8. `ContactController::import` — не проверяет наличие email или phone

- **Файл:** `backend/app/Http/Controllers/Contacts/ContactController.php:162-193`
- **Описание:** `store` проверяет `if (empty($email) && empty($phone))` — отклоняет. `import` такой проверки не имеет. Контакт с `email=null, phone=null` может перезаписать существующую запись.
- **Решение:** Добавить `'contacts.*.email' => 'required_without_all:contacts.*.phone'`.

---

## ⬜ INFO

### 9. `FilePolicy` — мёртвый код

- **Файл:** `backend/app/Policies/FilePolicy.php`
- **Описание:** Политика полностью определена (56 строк), но нигде не вызывается — ни через `$this->authorize()`, ни через `Gate`. Все проверки доступа реализованы вручную.
- **Решение:** Удалить или начать использовать через `Gate`.

### 10. `SharedFolderLink` — отсутствует cast для `status`

- **Файл:** `backend/app/Models/SharedFolderLink.php:28-35`
- **Описание:** `ShareLink` имеет `'status' => ShareLinkStatus::class`. `SharedFolderLink` — нет. При смене значения enum `isValid()` может незаметно сломаться.
- **Решение:** Добавить `'status' => ShareLinkStatus::class` в `$casts`.

---

## ✅ Подтверждено — исправлено/не проблема

| Проблема | Статус |
|---|---|
| addFile canAccess | ✅ Исправлено Sprint 13 |
| content/preview url_file | ✅ Исправлено Sprint 13 |
| OrganizationController hasAccessFor | ✅ Исправлено Sprint 13 |
| heartbeat canEditDocument | ✅ Исправлено Sprint 13 |
| setFavorite firstOrCreate | ✅ Исправлено Sprint 13 |
| formatFileCard удалён | ✅ Исправлено Sprint 15 |
| deleteFile orphan cleanup | ✅ Исправлено Sprint 16 |
| moveToFolder silent | ✅ Исключено (by design) |
| disableLink only created_by | ✅ Исключено (LOW, отложено) |

---

## Сводка

| Severity | Всего | Проблемы |
|---|---|---|
| **CRITICAL** | 2 | destroy без каскада, race condition версий |
| **HIGH** | 2 | updateDescription для shared-folder, canAccess вместо isOwnedBy |
| **MEDIUM** | 4 | updateSharedFolders, moveFolder, setTags, import |
| **INFO** | 2 | FilePolicy dead code, SharedFolderLink cast |
