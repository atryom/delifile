# Оптимизация — Фронтенд

## 1. `folders-tree.component` — самый тяжёлый компонент

**Проблема:** `FoldersTreeComponent` (root Tab компонент) имеет:

| Файл | Строк |
|------|-------|
| `folders-tree.component.ts` | 1 309 |
| `folders-tree.component.html` | 1 070 |
| `folders-tree.component.scss` | 1 363 |
| **Total** | **3 742** |

Компонент нарушает принцип единственной ответственности:
- Управление локальными папками (дерево)
- Управление shared folders
- Управление файлами (список, загрузка, удаление, перемещение)
- Управление тегами (фильтрация, bulk-назначение)
- Управление модальными диалогами (add, delete, move, tag)
- Drag-and-drop для загрузки
- Сохранение ссылок (URL files)
- Создание заметок (MD-документов)
- Отображение breadcrumbs, фильтров, сортировки
- Multi-select с bulk-действиями

**Стратегия:**
- Разделить на под-компоненты:
  - `FolderTreeView` — только отображение дерева локальных папок
  - `SharedFolderListView` — только shared folders
  - `FileListView` — список файлов с фильтрацией и пагинацией
  - `FolderBulkActionsComponent` — bulk-операции
  - `FolderUploadComponent` — загрузка файлов (drag'n'drop + кнопка)
- `FoldersTreeComponent` становится контейнером-оркестратором (150-200 строк)

---

## 2. `file-detail.component` — 605 строк

**Проблема:** `FileDetailComponent` — страница детального просмотра файла.

Компонент делает слишком много:
- Отображение карточки файла
- Управление тегами (picker, search, create, add, remove)
- Управление папками (выбор, перемещение)
- Управление версиями (select, edit label/comment, toggle active)
- Управление доступами (revoke, toggle can_edit)
- Управление ссылками (list, disable)
- Отображение активности
- Работа с MD-редактором (панель)
- Работа с комментариями
- Логика back-навигации

**Стратегия:**
- Разделить на под-компоненты:
  - `FileInfoCardComponent` — заголовок, описание, размер, дата
  - `FileVersionsPanelComponent` — список версий
  - `FileAccessPanelComponent` — управление доступом
  - `FileActivityPanelComponent` — лента активности
  - `FileTagPickerComponent` — выбор тегов
  - `FileFolderPickerComponent` — выбор папки
- `FileDetailComponent` оркестрирует под-компоненты (~150 строк)

---

## 3. Отсутствие shared-утилит

**Проблема:** В проекте нет выделенного слоя утилит. Все хелперы размазаны по компонентам.

**Выявленные кандидаты на вынесение:**

| Утилита | Сейчас в | Куда |
|---------|----------|------|
| `formatSize()` | 7 компонентов | `@shared/utils/format.ts` |
| `formatDate()` | компоненты с DatePipe | `@shared/utils/format.ts` |
| `canViewInBrowser()` | 2 компонента | `@shared/utils/file.ts` |
| `classifyMimeType()` | 2+ компонента | `@shared/utils/file.ts` |
| `flattenTree()` | 2 компонента | `@shared/utils/tree.ts` |
| `buildSharedFolderMoveTree()` | 1 компонент | `@shared/utils/tree.ts` |
| `PLAN_FILE_LIMITS` | 3 файла | `@shared/constants/limits.ts` |
| `trackById()` | 2 компонента | `@shared/utils/angular.ts` |

**Стратегия:**
- Создать `src/app/shared/utils/` с файлами по доменам
- Провести рефакторинг: заменить все inline-реализации на вызовы из утилит

---

## 4. Отсутствие мемоизации сложных вычислений

**Проблема:** Некоторые `computed` сигналы пересчитываются чаще, чем нужно, или используют неоптимальные структуры.

**Примеры:**
- `tagDialogCountText()` (folders-tree:199-202) — вычисляется при каждом изменении targetIds, хотя используется только при открытии диалога
- `moveDialogCountText()` (folders-tree:209-212) — аналогично
- `storageText()` (folders-tree:273-279) — форматирование при каждом изменении usage

**Стратегия:**
- Для редких UI-элементов (диалоги) вычислять значение непосредственно при открытии, а не через computed
- Для `storageText()` использовать мемоизацию с debounce (не чаще чем раз в 5 секунд)

---

## 5. Избыточные HTTP-запросы при инициализации

**Проблема:** При открытии `FoldersTreeComponent` выполняются параллельные запросы, часть из которых может быть не нужна.

**Текущие запросы в ngOnInit (строки 309-353):**
1. `orgApi.getFolderTree()` — **всегда**
2. `orgApi.getTags()` — **всегда**
3. `tariffApi.getUsage()` — **всегда**
4. `sfApi.listAll()` / `sfApi.list()` — зависит от tab
5. `sfApi.listFiles()` / `filesApi.list()` — зависит от tab

При первом входе на shared tab — 4 запроса. При первом входе на local tab — 3 запроса + загрузка файлов.

**Стратегия:**
- `getUsage()` загружать lazy при открытии storage-секции (или кешировать на время сессии)
- `getTags()` загружать только при необходимости фильтрации по тегам
- Рассмотреть кеширование на уровне сервиса (через `shareReplay(1)` в RxJS)

---

## 6. Нет кеширования ответов API

**Проблема:** Многие API-вызовы повторяются без кеширования.

**Примеры:**
- `orgApi.getFolderTree()` вызывается при загрузке страницы, при возврате в корень, после создания/удаления папки
- `tariffApi.getUsage()` — при загрузке каждой страницы с файлами
- `sfApi.listAll()` — при каждом открытии move dialog

**Стратегия:**
- Внедрить кеширование на уровне API-сервисов с помощью `shareReplay(1)` + TTL
- Добавить метод `invalidateCache()` для принудительного сброса
- Для `getFolderTree()` — кеш на 30 секунд, инвалидация после CRUD-операций

---

## 7. `share-target.component.ts` — инлайн шаблон и стили

**Проблема:** `ShareTargetComponent` (426 строк) содержит весь шаблон и стили инлайн, что нарушает консистентность с остальными компонентами, использующими внешние HTML/SCSS файлы.

**Стратегия:**
- Выделить шаблон в `share-target.component.html`
- Выделить стили в `share-target.component.scss`
