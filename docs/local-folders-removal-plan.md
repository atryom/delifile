# План полной вычистки локальных папок (folders)

## Контекст

Раньше в проекте были локальные папки (таблица `folders`, модель `Folder`)
и общие папки (таблица `shared_folders`, модель `SharedFolder`).
Решение: оставить только общие папки. Локальные папки уже скрыты в UI,
но на уровне бэкенда весь код (модель, контроллер, сервисы, роуты) продолжает существовать.
Задача — полностью вычистить локальные папки из кода и БД.

**Корень:** `SharedFolder` с флагом `is_personal_root = true` — техническая папка «Мои файлы».
Остаётся скрытой (не показывается в списке shared-папок, доступ к ней не выводится).

**Важно:** Все диагностические данные Фазы 0 и миграции данных Фазы 1 выполняются
**на продуктивном сервере (delifile.ru)**. Код и DB-миграции деплоятся через `./deploy`.

---

## Фаза 0 — Диагностика на ПРОДЕ (обязательна перед стартом)

Выполнить на продуктивном сервере и зафиксировать результаты:

```sql
SELECT COUNT(*) FROM folders;
SELECT COUNT(*) FROM local_folder_comment_settings;
SELECT COUNT(*) FROM files WHERE folder_id IS NOT NULL;
SELECT COUNT(*) FROM file_user_access WHERE folder_id IS NOT NULL;
SELECT COUNT(*) FROM shared_folder_files;
SELECT COUNT(*) FROM files WHERE shared_folder_only = true;
SELECT COUNT(*) FROM files WHERE shared_folder_only = false;
```

```bash
php artisan folders:migrate-to-shared --verify
```

**Результаты на ПРОДЕ (09.06.2026):**

| Таблица / поле | Записей |
|----------------|---------|
| `folders` | **17** |
| `local_folder_comment_settings` | 0 |
| `files.folder_id` (не NULL) | **20** |
| `file_user_access.folder_id` (не NULL) | **108** |
| `shared_folder_files` | 176 |
| `shared_folder_only = true` | 117 |
| `shared_folder_only = false` | **205** |

**Вывод:** Фаза 1 обязательна. На проде 17 локальных папок, 20 файлов привязаны к ним,
108 пользовательских доступов с `folder_id`. 205 из 322 файлов ещё не помечены `shared_folder_only = true`.

---

## Фаза 1 — Миграция данных на ПРОДЕ ✅ ВЫПОЛНЕНО (09.06.2026)

1. ✅ `php artisan folders:migrate-to-shared --verify` — создана 1 новая shared-папка «23asw», привязано 9 файлов, верификация OK
2. ✅ `UPDATE files SET shared_folder_only = true WHERE shared_folder_only = false` — 205 строк
3. ✅ `UPDATE file_user_access SET folder_id = NULL WHERE folder_id IS NOT NULL` — 108 строк
4. ✅ `UPDATE files SET folder_id = NULL WHERE folder_id IS NOT NULL` — 20 строк

**Примечание:** У пользователя #2 было 4 локальных папки «Юмор» — все смаппились на одну SharedFolder «Юмор».

**Текущее состояние БД на проде:**
- `files.folder_id` — все NULL
- `file_user_access.folder_id` — все NULL
- `files.shared_folder_only` — все true
- `folders` — 17 записей (таблица удаляется в Фазе 5)

---

## Фаза 2 — Удаление кода бэкенда

### Принципы безопасности

- Никогда не дропать колонку раньше, чем весь код перестал её использовать
- Никогда не удалять endpoint раньше, чем frontend/mobile перестали его вызывать
- Проверять работоспособность после каждого подшага

### 2a. FileService и FileCardBuilder ✅ ВЫПОЛНЕНО (коммит 1008a03)

- `FileService.php` — удалены: `moveToFolder()`, `folder_id`-фильтр из `listFiles()`, условия `shared_folder_only` в фильтрах mine/all/else
- `FileCardBuilder.php` — убраны `folder_id` и `shared_folder_only` из `buildCard()` и `buildListItem()`
- `FileController.php` — удалены: `use Folder`, блок обработки `folder_id` в `index()`, метод `moveFolder()`

### 2b–2e. Контроллеры, сервисы, роуты ✅ ВЫПОЛНЕНО (коммит d6cdf29)

- `CommentService.php` — удалены `LocalFolder` ветка, `localFolderEffectivePolicy()`, `canAccessLocalFolder()`
- `CommentController.php`, `CommentThreadController.php` — удалены `LocalFolder` ветки в match
- `CommentSettingsController.php` — удалён `updateLocalFolderSettings()`, импорты `Folder`, `LocalFolderCommentSettings`
- `MovieController.php` — удалены `search()` и `store()` для локальных папок, `shared_folder_only` из `storeShared()`
- `SharedFolderFileController.php` — удалена логика `shared_folder_only` из `addToMyFiles`, `addFile`, `removeFile`, `updateSharedFolders`; `addToMyFiles` стал no-op
- `SharedFolderController.php` — удалена логика `shared_folder_only` из delete/initUpload/addUrlFile
- `OrganizationController.php` — оставлены только методы тегов, все методы папок удалены
- `routes/api.php` — удалены все роуты `/folders/*`, `/local-folders/*`, `move-folder`, `clear-folder`

### 2d. Модели

- `File.php` — убрать `folder_id` и `shared_folder_only` из `$fillable`, убрать `$casts['shared_folder_only']`, удалить relation `folder()`
- `FileUserAccess.php` — убрать `folder_id` из `$fillable`
- `CommentTargetType.php` — убрать кейс `LocalFolder`

### 2e. Роуты (`routes/api.php`)

Удалить:
- `GET /api/v1/folders/tree`
- `GET /api/v1/folders`
- `POST /api/v1/folders`
- `PATCH /api/v1/folders/{id}`
- `DELETE /api/v1/folders/{id}`
- `POST /api/v1/folders/{folder}/movies/search`
- `POST /api/v1/folders/{folder}/movies`
- `PATCH /api/v1/local-folders/{folderId}/comment-settings`
- `POST /api/v1/files/{id}/clear-folder`
- `POST /api/v1/files/{id}/move-folder`

### 2f. Удаление файлов

- Удалить `app/Models/Folder.php`
- Удалить `app/Models/LocalFolderCommentSettings.php`
- Удалить `app/Console/Commands/MigratePersonalFoldersToShared.php`
- `app/Http/Controllers/Organization/OrganizationController.php` — **не удалять** (содержит теги), только почистить методы папок

**Проверка после фазы 2:**
```bash
php artisan route:list | grep -E '/folders|/local-folders'   # ничего не должно быть
rg 'Folder[^sA-Z]|folder_id|shared_folder_only|local_folder' --include='*.php' app/
php artisan config:clear && php artisan route:clear           # без ошибок
```
Вручную проверить: листинг файлов, теги, shared-папки.

---

## Фаза 3 — Очистка фронтенда (Angular)

Файлы:
- `frontend/src/app/shared/models/api.models.ts` — убрать `folder_id` и `shared_folder_only` из `FileCard` и `FileListItem`
- `frontend/src/app/core/api/files-api.service.ts` — убрать `folder_id` из параметров `list()`, удалить `moveFolder()`
- `frontend/src/app/core/api/organization-api.service.ts` — удалить методы папок: `getFolderTree`, `getFolders`, `createFolder`, `updateFolder`, `deleteFolder`, `clearFolder`
- `frontend/src/app/features/files/pages/file-detail/file-detail.component.ts` — убрать всю логику `folder_id` и `shared_folder_only`
- Проверить `frontend/src/app/features/folders/` — удалить компоненты, которые использовались только для локальных папок

**Проверка после фазы 3:**
```bash
cd frontend && npm run build   # без ошибок TypeScript
```
Открыть приложение в браузере: файлы отображаются, shared-папки работают.

---

## Фаза 4 — Очистка мобильного приложения

Файлы:
- `mobile/src/api/folders.ts` — удалить файл целиком
- `mobile/src/types/file.ts` — убрать `folder_id` и `shared_folder_only` из интерфейсов `FileListItem`, `FileCard`, `FileListParams`
- `mobile/src/api/files.ts` — удалить `moveFolder()`
- `mobile/src/hooks/useFiles.ts` — удалить мутацию `moveFolder`

**Проверка после фазы 4:**
TypeScript-сборка без ошибок.

---

## Фаза 5 — Миграции БД (только после фаз 1-4)

Создать миграции в указанном порядке:

**1. Удалить `folder_id` из `file_user_access`:**
```php
Schema::table('file_user_access', function (Blueprint $table) {
    $table->dropForeign(['folder_id']);
    $table->dropColumn('folder_id');
});
```

**2. Удалить `folder_id` и `shared_folder_only` из `files`:**
```php
Schema::table('files', function (Blueprint $table) {
    $table->dropForeign(['folder_id']);
    $table->dropColumn(['folder_id', 'shared_folder_only']);
});
```

**3. Удалить `local_folder_comment_settings`:**
```php
Schema::dropIfExists('local_folder_comment_settings');
```

**4. Удалить `folders`:**
```php
Schema::dropIfExists('folders');
```

К этому моменту все колонки уже NULL — дроп безопасен.

---

## Финальная валидация

```bash
php artisan migrate                                   # без ошибок
php artisan route:list | grep -E '/folders|/local'    # пусто (кроме shared-folders)
rg 'Folder[^sA-Z]|folder_id|shared_folder_only' --include='*.php' app/  # пусто
```

Функциональный прогон:
- Открыть приложение
- Загрузить файл
- Добавить файл в shared-папку
- Добавить тег
- Оставить комментарий
- Проверить галерею и фильмы

---

## Риски и замечания

1. **OrganizationController содержит теги** — нельзя удалять файл целиком, только методы папок
2. **`shared_folder_only` убирается из кода до дропа колонки** — порядок критичен
3. **Фаза 0 на проде** — реальное состояние данных может отличаться от тестового; план может потребовать корректировки после диагностики
4. **Фаза 1 на проде** — выполнять в транзакции, иметь резервную копию БД

---

## Задачи к выполнению (зафиксировано)

### TODO-001: Удаление папки с файлами — мобильное приложение

**Статус:** не реализовано

**Контекст:** В Angular-фронте реализовано двухшаговое удаление папки:
1-й клик → API возвращает `422 FOLDER_HAS_FILES` с `file_count`
→ показывается предупреждение → 2-й клик с `force=true` → удаление.

В мобильном приложении это не обработано:
- `mobile/src/api/shared-folders.ts:43` — `delete(id)` без `force`
- Хук и UI-компонент не знают о `FOLDER_HAS_FILES`

**Что нужно сделать:**
1. `mobile/src/api/shared-folders.ts` — добавить `force` param в `deleteFolder(id, force?)`
2. Найти хук/компонент, вызывающий удаление папки, добавить обработку `FOLDER_HAS_FILES`
3. Показать Alert с количеством файлов и кнопкой подтверждения, повторить с `force=true`

---

## Известные баги (зафиксировано, не блокирует текущую задачу)

### BUG-001: Фильтры и сортировка не работают внутри папок

**Симптом:** Фильтр по типу файлов, тегам и сортировка работают только в корне («Мои файлы»),
но не внутри shared-папок.

**Причина:** Endpoint `/api/v1/shared-folders/{id}/files` (`SharedFolderFileController`)
не принимает и не применяет параметры `sort_by`, `sort_order`, `file_type_group`, `tag_id`, `content_kind`.
Frontend (`shared-folders-api.service.ts::listFiles()`) также не передаёт эти параметры.

**Не связано с текущей задачей** — баг существовал до удаления локальных папок.

**Что нужно сделать:**
- Бэкенд: добавить обработку `sort_by`, `sort_order`, `file_type_group`, `tag_id`, `content_kind` в `SharedFolderFileController::listFiles()`
- Фронтенд: добавить эти параметры в `shared-folders-api.service.ts::listFiles()`
