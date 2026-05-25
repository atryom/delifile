# План миграции mobile — объединённая модель папок

Дата: 25 мая 2026
Контекст: бэкенд перешёл на единую модель `SharedFolder` с флагом `is_personal_root`. Mobile всё ещё использует два параллельных мира: `Folder` (личные) и `SharedFolder` (общие).

---

## 1. Что изменилось на бэкенде

### Новая архитектура
- `SharedFolder` — единая модель папок. Может быть личной корневой (`is_personal_root = true`), общей, приватной (`is_private = true`)
- Старая модель `Folder` (личные папки) **всё ещё существует**, но используется только для обратной совместимости. Новые файлы создаются в `SharedFolder`
- Старый `FoldersController` удалён, заменён `OrganizationController` с теми же 5 endpoint'ами (`/api/v1/folders/*`)
- `SharedFolderController` — 25 endpoint'ов для unified-папок

### Новые endpoint'ы (отсутствуют в mobile)

| Метод | URL | Назначение |
|-------|-----|------------|
| `POST` | `/api/v1/shared-folders/ensure-root` | Создать/получить личную корневую папку |
| `GET` | `/api/v1/shared-folders/all-flat` | Все доступные папки (flat, для tree-picker) |
| `PATCH` | `/api/v1/shared-folders/{id}/privacy` | Установить приватность подпапки |
| `PATCH` | `/api/v1/shared-folders/{id}/files/{fileId}/privacy` | Приватность файла внутри папки |
| `GET/POST` | `/api/v1/shared-folders/{id}/links` | Share-ссылки на папку |
| `POST` | `/api/v1/shared-folders/{id}/links/{linkId}/disable` | Отключить ссылку |
| `POST` | `/api/v1/shared-links/{token}/resolve` | PUBLIC — разрешить ссылку |
| `GET` | `/api/v1/shared-links/{token}/files` | PUBLIC — файлы по ссылке |
| `GET/PATCH` | `/api/v1/shared-folders/{folderId}/comment-settings` | Настройки комментариев |
| `POST` | `/api/v1/files/{id}/add-to-my-files` | Из shared_folder_only → обычный |
| `POST` | `/api/v1/files/{id}/shared-folders` | Синхронизировать членство в папках |
| `GET` | `/api/v1/files/{id}/shared-folders` | Папки, содержащие файл |

### Новые поля в ответе `formatFolder()`

```typescript
is_private: boolean;        // приватность для гостей
is_personal_root: boolean;  // личная корневая папка
sort_order: number | null;  // порядок сортировки
has_shared_access: boolean; // есть ли общий доступ
```

---

## 2. Текущее состояние mobile

### Две полностью параллельные системы

| Аспект | Личные папки (Folder) | Общие папки (SharedFolder) |
|--------|----------------------|---------------------------|
| Тип | `src/types/folder.ts` | `src/types/shared-folder.ts` |
| API | `src/api/folders.ts` (5 методов) | `src/api/shared-folders.ts` (11 методов) |
| Хуки | `src/hooks/useFolders.ts` | Инлайн + react-query в экранах |
| UI | `app/(app)/files/index.tsx` (SectionList) | `app/(app)/files/shared-folders/*` (FlatList) |

### Проблемы

| Проблема | Файл | Серьёзность |
|----------|------|-------------|
| Нет `ensureRoot` при входе | `files/index.tsx` | 🔴 |
| `SharedFolder` не содержит `is_personal_root`, `is_private`, `sort_order`, `has_shared_access` | `src/types/shared-folder.ts` | 🔴 |
| Нет API-методов для `ensure-root`, `allFlat`, `privacy` | `src/api/shared-folders.ts` | 🔴 |
| Tree-picker использует `useFolderTree()` (личные) вместо `allFlat()` (все папки) | `files/[id].tsx:522-547` | 🟠 |
| Нет UI для `setFolderPrivacy` / `setFilePrivacy` | `shared-folders/[id].tsx` | 🟠 |
| Комментарии (`local_folder`) не используются нигде | `types/comment.ts` + экраны | 🟡 |

---

## 3. Что нужно изменить

### 3.1. Типы — `src/types/shared-folder.ts`

```typescript
export interface SharedFolder {
  id: string;
  name: string;
  owner_id: number;
  parent_id: string | null;
  files_count: number;
  children_count: number;
  is_owner: boolean;
  my_access_type: 'view' | 'edit' | null;
  is_private: boolean;          // NEW
  is_personal_root: boolean;    // NEW
  sort_order: number | null;    // NEW
  has_shared_access: boolean;   // NEW
  created_at: string | null;
}
```

### 3.2. API — `src/api/shared-folders.ts`

Добавить 10 новых методов:
- `ensureRoot()`
- `allFlat()`
- `setFolderPrivacy(id, isPrivate)`
- `setFilePrivacy(folderId, fileId, isPrivate)`
- `links(id)`, `createLink(id, opts)`, `disableLink(folderId, linkId)`
- `addFile(folderId, fileId)`, `removeFile(folderId, fileId)`
- `addToMyFiles(fileId)`
- `getFileFolders(fileId)`, `updateFileFolders(fileId, folderIds)`

### 3.3. Хуки — создать `src/hooks/useSharedFolders.ts`

```typescript
useEnsurePersonalRoot()     // ensure-root
useSharedFolderTree()       // allFlat
useSetFolderPrivacy()
useSetFilePrivacy()
useAddFileToFolder()
useRemoveFileFromFolder()
useFolderLinks(id)
useCreateFolderLink(id)
useDisableFolderLink(folderId, linkId)
useFileFolders(fileId)      // какие папки содержат файл
useUpdateFileFolders(fileId)
```

### 3.4. Главный экран — `app/(app)/files/index.tsx`

**Изменения:**
1. Заменить `useFolderList()` на `useSharedFolderTree()` (allFlat)
2. При загрузке — вызвать `ensurePersonalRoot()` для получения корня
3. Убрать отдельную кнопку "Общие папки" — интегрировать всё в общий список
4. Учитывать `is_personal_root` (иконка домика) и `is_private` (иконка замка)
5. Заменить `useFileList({ folder_id })` на вызов `sharedFoldersApi.files(folderId)` при навигации в папку, или оставить `useFileList` для файлов (бэкенд поддерживает оба)

### 3.5. Навигация — `app/(app)/files/_layout.tsx`

Текущий стек:
```
files/index → files/[id]
files/index → shared-folders/index → shared-folders/[id] → shared-folders/add
```

Нужный стек (unified):
```
files/index (unified)
  → files/[id] (детали файла — без изменений)
  → files/add (добавление — без изменений)
  → shared-folders/[id] (универсальный экран содержимого папки)
  → shared-folders/add (добавление в папку)
```

Можно удалить `shared-folders/index.tsx` — его функциональность (список корневых папок) переносится в `files/index.tsx`.

### 3.6. Экран содержимого папки — `shared-folders/[id].tsx`

**Добавить:**
- Кнопка приватности (владелец) — вызов `setFolderPrivacy`
- Иконка замка для приватных подпапок/файлов
- Сортировка по `sort_order`
- Кнопка "Добавить в мои файлы" (`addToMyFiles`) для файлов в shared-папке
- В контекстном меню файла — "Сделать приватным" (`setFilePrivacy`)

### 3.7. Панель перемещения — `files/[id].tsx`

**Заменить:**
```typescript
// Было:
const { data: folderTree } = useFolderTree();  // только личные папки
// flattens дерево

// Стало:
const { data: allFolders } = useSharedFolderTree();  // все папки
// фильтрует по parent_id для построения дерева
```

### 3.8. Inbox — `connections/index.tsx`

Проверить типы `InboxSharedFolder` — возможно, нужно обновить интерфейс. Сейчас уже работает через `inboxApi.sharedFolders()`.

---

## 4. Порядок реализации

### Спринт 1: Типы + API
Файлы: `src/types/shared-folder.ts`, `src/api/shared-folders.ts`
- Обновить `SharedFolder` — добавить все новые поля
- Добавить 10 новых методов API
- Создать `src/hooks/useSharedFolders.ts`

### Спринт 2: Unified корень
Файлы: `app/(app)/files/index.tsx`, `app/(app)/files/_layout.tsx`
- Вызывать `ensurePersonalRoot()` при загрузке
- Заменить `useFolderList()` → `allFlat()`
- Убрать отдельную кнопку "Общие папки"
- Удалить `shared-folders/index.tsx` (перенести функциональность)

### Спринт 3: Приватность
Файлы: `app/(app)/files/shared-folders/[id].tsx`
- Переключатель приватности папки
- Приватность для файлов
- Иконки замка

### Спринт 4: Tree-picker
Файлы: `app/(app)/files/[id].tsx`
- `allFlat()` вместо `folderTree()` для выбора папки
- `addToMyFiles` для shared_folder_only файлов

### Спринт 5: Share-ссылки на папки
Файлы: `app/(app)/files/shared-folders/[id].tsx`
- Создание/просмотр ссылок

---

## 5. Риски

| Риск | Митигация |
|------|-----------|
| Старые `Folder` ещё существуют на бэкенде | Поддерживать оба варианта до полной миграции |
| `allFlat()` может быть медленным при 1000+ папок | У бэкенда без пагинации — мониторить, добавить lazy loading при необходимости |
| ensure-root может создать дубликат | На бэкенде `firstOrCreate` — безопасно |
| Сломается навигация в старых установках | Проверить deep linking при обновлении |
