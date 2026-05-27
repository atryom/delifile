# Модуль задач — фиксация изменений

Ветка: `feature/task-module`  
Дата: 2026-05-27

---

## 1. Отзыв доступа — исправление 404 для pending-записей

### Проблема
`DELETE /api/v1/files/{fileId}/share-to-contact/{contactId}` возвращал 404 когда:
- передавался числовой `userId`, а у пользователя не было `FileUserAccess` (только `PendingReceivedFile`)
- контакт в статусе «Ожидает принятия» имел только `ContactPendingShare`, но не `FileUserAccess`

### Файл
`backend/app/Http/Controllers/Files/SharingController.php` → `revokeContactAccess()`

### Изменения
- **Ветка по `userId`** (else): дополнительно удаляет `PendingReceivedFile`. 404 возвращается только если не удалено ни одной записи из обеих таблиц.
- **Ветка по `contact_id`** (if): дополнительно удаляет `ContactPendingShare` для данного контакта и файла — покрывает незарегистрированных контактов.

### Тесты
`tests/Feature/Sharing/RevokeAccessTest.php`:
- `test_revoke_by_contact_id_also_removes_contact_pending_share`
- `test_revoke_by_user_id_removes_pending_received_file`
- `test_revoke_by_user_id_returns_404_when_no_access_exists`

---

## 2. Авто-назначение владельца при отзыве доступа у исполнителя

### Проблема
Если отозвать доступ у пользователя, являющегося исполнителем задачи (`task_assigned_user_id`), задача оставалась без исполнителя.

### Файл
`backend/app/Http/Controllers/Files/SharingController.php` → `revokeContactAccess()`

### Изменения
В обеих ветках (contact / userId): если файл является задачей (`is_task = true`) и отзываемый пользователь является текущим исполнителем — автоматически устанавливается `task_assigned_user_id = file->owner_id`.

### Тест
`tests/Feature/Sharing/RevokeAccessTest.php`:
- `test_revoke_reassigns_task_assignee_to_owner_when_assignee_is_revoked`
- `test_revoke_does_not_change_assignee_when_different_user_revoked`

---

## 3. Прямое добавление доступа при наличии доступа через папку

### Проблема
Если П2 имел доступ к файлу через `SharedFolderAccess`, но у него `auto_add_received_files = false`, при явном шаринге файла создавался `PendingReceivedFile`. П2 видел уведомление, но не шёл принимать приглашение (уже имел доступ через папку), и в списке доступов у П1 висело «Ожидает принятия».

### Файл
`backend/app/Http/Controllers/Files/SharingController.php` → `shareToContact()`  
(приватный метод `userHasSharedFolderAccess()`)

### Изменения
Перед созданием `PendingReceivedFile` проверяется: имеет ли получатель `SharedFolderAccess` к папке (или любой папке-предку), в которой лежит файл. Если да — создаётся `FileUserAccess` напрямую.  
Дополнительно импортированы `SharedFolder` и `SharedFolderAccess`.

### Тест
`tests/Feature/Sharing/SharedFolderAccessShareTest.php`:
- `test_share_to_contact_grants_direct_access_when_recipient_has_folder_access`
- `test_share_to_contact_creates_pending_when_no_folder_access`

---

## 4. Фильтрация задач по диапазону дат (пересечение)

### Проблема
Старая логика:
- `task_start_date >= filter_from` AND `task_due_date <= filter_to`

Задача отображалась только если целиком входила в диапазон фильтра. Частичное пересечение не работало; задачи без одной из дат всегда исключались.

### Логика пересечения диапазонов
Задача видна если её диапазон `[start, due]` пересекается с диапазоном фильтра `[from, to]`:
- Если у задачи нет начала — нижняя граница −∞
- Если у задачи нет конца — верхняя граница +∞  
- Если у задачи нет ни одной даты — диапазона нет, задача не включается

SQL-условия (при активном фильтре дат):
```sql
(task_start_date IS NOT NULL OR task_due_date IS NOT NULL)
AND (task_start_date IS NULL OR task_start_date <= filter_to)   -- если filter_to задан
AND (task_due_date  IS NULL OR task_due_date  >= filter_from)   -- если filter_from задан
```

### Файлы
- `backend/app/Services/FileService.php` — личные файлы
- `backend/app/Http/Controllers/SharedFolders/SharedFolderController.php` → `listFiles()` — файлы в папке

### Тесты
`tests/Feature/Files/TaskDateFilterTest.php`:
- `test_task_with_overlapping_range_is_included`
- `test_task_with_non_overlapping_range_is_excluded`
- `test_task_with_null_start_date_is_included_when_due_in_range`
- `test_task_with_null_due_date_is_included_when_start_in_range`
- `test_task_with_both_null_dates_is_excluded_when_filter_active`
- `test_only_date_from_filter_works_correctly`

---

## 5. Фильтрация папок в режиме задач

### Проблема
В режиме `view=tasks` в списке папок отображались все папки — в том числе не содержащие задач.

### Изменения

**`frontend/src/app/features/folders/pages/folders-tree/folders-tree.component.ts`**:
- `filteredSharedFolders` computed: в режиме `tasks` фильтрует папки с `tasks_count > 0`
- `loadSfSubfolders()`: в режиме задач передаёт `{ task_status, task_date_from, task_date_to }` в `getSubfolders()`
- `onTaskFilterChange()`: дополнительно вызывает `loadSfSubfolders()` если пользователь находится внутри папки

**`backend/app/Http/Controllers/SharedFolders/SharedFolderController.php` → `subfolders()`**:
- Принимает `task_status`, `task_date_from`, `task_date_to`
- `tasks_count` считается с учётом этих фильтров (включая логику пересечения дат)

**`frontend/src/app/core/api/shared-folders-api.service.ts`**:
- `getSubfolders(parentId, taskFilters?)` — второй аргумент добавляет query-параметры

### Тесты
`folders-tree.component.spec.ts`:
- `filteredSharedFolders shows only folders with tasks_count > 0 in tasks mode`
- `filteredSharedFolders shows all folders in table mode`
- `navigateIntoSharedFolder in tasks mode passes filters to getSubfolders`
- `navigateIntoSharedFolder in table mode passes undefined to getSubfolders`
- `onTaskFilterChange inside folder calls getSubfolders`
- `onTaskFilterChange at root does not call getSubfolders`

`shared-folders-api.service.spec.ts`:
- `getSubfolders without filters calls /shared-folders/sf1/subfolders`
- `getSubfolders with task_status filter appends it to URL`
- `getSubfolders with task_date_from and task_date_to appends them to URL`
- `getSubfolders with all filters appends all params to URL`

---

## 6. Счётчик элементов в папке в режиме задач

### Проблема
В режиме задач в колонке размера и на плиточном виде отображалось `N файлов`, хотя в этом режиме актуален счётчик задач.

### Файл
`frontend/src/app/features/folders/pages/folders-tree/folders-tree.component.html`

### Изменения
Все вхождения `folder.files_count + ' файлов'` и `sub.files_count + ' файлов'` заменены на условное выражение:
```
viewMode() === 'tasks' ? (X.tasks_count + ' задач') : (X.files_count + ' файлов')
```
Применено в table-view (мобильная мета, колонка размера) и grid-view для корневых папок и подпапок.

---

## 7. Фильтры задач внутри панели фильтров

### Проблема
Фильтры задач (статус, даты) отображались отдельным блоком под панелью фильтров и не скрывались при закрытии панели.

### Файл
`frontend/src/app/features/folders/pages/folders-tree/folders-tree.component.html`  
`frontend/src/app/features/folders/pages/folders-tree/folders-tree.component.scss`

### Изменения
- Блок `.task-filters-bar` перенесён внутрь `@if (filtersOpen())` → `.filters-panel`
- Отображается в конце панели только при `viewMode() === 'tasks'`
- Переименован в `.task-filters-row`, отступы выровнены с остальными строками панели (`padding: 8px 16px 10px`)
- Старый standalone-блок удалён

---

## 8. Компактное управление доступом к файлу (попап)

### Проблема
В секции «Кто имеет доступ» детализации файла занимали место инлайн-кнопки «Редактирование» / «Просмотр» и крестик.

### Файлы
- `frontend/src/app/features/files/pages/file-detail/file-detail.component.html`
- `frontend/src/app/features/files/pages/file-detail/file-detail.component.ts`
- `frontend/src/app/features/files/pages/file-detail/file-detail.component.scss`

### Изменения
- Убраны инлайн-кнопки «Редактирование»/«Просмотр» и крестик
- Добавлена компактная кнопка с иконкой: карандаш (редактирование, синяя) / глаз (просмотр, серая)
- По клику открывается попап с:
  - текущим режимом доступа
  - кнопкой смены прав (только для markdown)
  - кнопкой «Забрать доступ» (красная)
- Попап закрывается кликом вне (`document:click` через `host` binding)
- Добавлен сигнал `accessPopupId`, методы `toggleAccessPopup(id, event)` и `closeAccessPopup()`

### Тесты
`file-detail.component.spec.ts`:
- `toggleAccessPopup opens popup for the given id`
- `toggleAccessPopup closes popup when same id is toggled again`
- `closeAccessPopup resets accessPopupId to null`

---

## 9. Ограничение управления задачей по роли

### Проблема
Пользователи без прав (не владелец, не исполнитель) видели кнопки статусов и поля дат задачи. При нажатии запросы уходили на сервер и падали с ошибкой в консоль.

### Файлы
- `frontend/src/app/features/files/pages/file-detail/file-detail.component.ts`
- `frontend/src/app/features/files/pages/file-detail/file-detail.component.html`
- `frontend/src/app/features/files/pages/file-detail/file-detail.component.scss`

### Изменения
- Добавлен computed `canEditTask`: `true` если `file.is_owner || file.task_assigned_user?.id === Number(authState.user().id)`
- Кнопки статусов и поля дат обёрнуты в `@if (canEditTask())`
- Для остальных отображается только текущий статус строкой (`.task-status-readonly`)

### Тесты
`file-detail.component.spec.ts`:
- `canEditTask returns true for file owner`
- `canEditTask returns true for assigned user`
- `canEditTask returns false for unrelated user`

---

## 10. Переименование кнопки и удаление «Снять» в задачах

### Проблема
Кнопка «Назначить» не передавала смысл делегирования задачи. Кнопка «Снять» позволяла оставить задачу без исполнителя.

### Файлы
- `frontend/src/assets/i18n/ru.json`
- `frontend/src/app/features/files/pages/file-detail/file-detail.component.html`

### Изменения
- `tasks.assign_btn` изменён с «Назначить» на «Делегировать»
- `tasks.unassign_btn` и соответствующая кнопка удалены
- Значок исполнителя (иконка пользователя) остаётся как индикатор текущего назначения

---

## Итог по тестам

| Группа | До | После | Статус |
|---|---|---|---|
| `tests/Feature/Sharing/*` | 29 | 42 | ✅ все проходят |
| `tests/Feature/Files/TaskDateFilterTest.php` | 0 | 6 | ✅ все проходят |
| `folders-tree.component.spec.ts` | 29 (0 проходили) | 35 | ✅ все проходят |
| `shared-folders-api.service.spec.ts` | 6 | 10 | ✅ все проходят |
| `file-detail.component.spec.ts` | 34 | 40 | ✅ все проходят |
| **Итого frontend** | **575 passing** | **604 passing** | ✅ |
| **Итого backend** | **119 passing** | **161 passing** | ✅ |
