# Дублирование кода — Фронтенд

## 1. `formatSize()` — в 7 местах

**Проблема:** Функция форматирования размера файла (bytes → B/KB/MB/GB) реализована в 7 компонентах с одинаковой или похожей логикой.

**Места:**
- `file-detail.component.ts:525-530`
- `file-list.component.ts:203-208`
- `public-link.component.ts:112-117`
- `shared-folders.component.ts:34-38` (отдельная функция компонента)
- `admin.component.ts:508-514`
- `support.component.ts:408-412`
- `folders-tree.component.ts:1224-1230`

**Различия:**
- `file-detail.component.ts` использует `B/KB/MB/GB` (латиница)
- `folders-tree.component.ts` использует `—/КБ/МБ/ГБ` (кириллица) и возвращает `—` для нуля
- `file-list.component.ts` использует `Б/КБ/МБ/ГБ` (смешанный вариант)

**Стратегия:**
- Создать `src/app/shared/utils/format.ts` с единой функцией `formatSize(bytes: number, options?: { locale?: string; fallback?: string }): string`
- Во всех компонентах заменить локальные функции на импорт из shared utils
- Удалить дублирующиеся реализации

---

## 2. `mimeIcon()` / `fileIcon()` — в 4 местах

**Проблема:** Определение иконки по MIME-типу размазано, при этом существует выделенный компонент `FileTypeIconComponent`.

**Места:**
- `file-detail.component.ts:532-538` — использует emoji
- `public-link.component.ts:103-110` — своя реализация
- `shared-folders.component.ts:24-32` — своя функция
- `shared/components/file-type-icon/` — готовый компонент

**Стратегия:**
- Использовать `FileTypeIconComponent` во всех шаблонах
- Убрать дублирующиеся методы из компонентов
- В `FileTypeIconComponent` добавить недостающие типы (link, note, archive и т.д.)

---

## 3. `PLAN_FILE_LIMITS` — константа в 3 местах

**Проблема:** Одна и та же константа с лимитами размера файла по тарифам определена в 3 файлах.

**Места:**
- `file-upload.service.ts:9-13`
- `shared-folders.component.ts:23-27`
- `folders-tree.component.ts:23-27`

При изменении тарифов нужно менять в 3 местах. Несоответствие может привести к тому, что `file-upload.service.ts` пускает загрузку, а `folders-tree.component.ts` — нет (или наоборот).

```typescript
const PLAN_FILE_LIMITS: Record<string, number> = {
  free:   50  * 1024 * 1024,
  silver: 100 * 1024 * 1024,
  gold:   150 * 1024 * 1024,
};
```

**Стратегия:**
- Вынести в `src/app/shared/constants/limits.ts`
- Импортировать из одного места
- В идеале — получать с бэкенда через `GET /tariffs` и не хранить на клиенте

---

## 4. Upload-логика — 2 полные реализации + 1 частичная

**Проблема:** Трёхшаговый процесс загрузки (init → PUT S3 → complete) реализован в 3 местах с разной степенью детализации.

**Места:**
- `file-upload.service.ts` (122 строки) — **основной выделенный сервис**. Полный цикл с поддержкой thumbnail
- `folders-tree.component.ts:903-921` — использует `FileUploadService`, **но** для shared folder — своя полная реализация `uploadToSharedFolder()` (строки 923-995)
- `shared-folders.component.ts:220-286` — **своя полная inline-реализация**

Логика `uploadToSharedFolder()` в `folders-tree.component.ts` — это почти дословная копия `file-upload.service.ts:35-108` с дополнительным параметром `sfId`.

**Стратегия:**
- Расширить `FileUploadService.upload()` для поддержки shared folder (параметр `sharedFolderId?: string`)
- Убрать `uploadToSharedFolder()` из `folders-tree.component.ts`
- Убрать дублирование в `shared-folders.component.ts`
- Весь UI upload-логики должен использовать единый сервис

---

## 5. MD-редактор — почти идентичный код в 2 местах

**Проблема:** Два компонента редактора Markdown имеют практически одинаковую логику создания TipTap-редактора, расширений, блокировки, сохранения, конфликтов.

**Места:**
- `markdown-editor.component.ts` (437 строк) — полноэкранный редактор
- `markdown-editor-panel.component.ts` (589 строк) — панельный редактор на странице деталей

**Совпадающий код:**
```typescript
// Создание TipTap редактора — одинаковое в обоих
private createEditor(content: string): Editor {
  return new Editor({
    extensions: [
      StarterKit.configure({
        document: false, // ...
      }),
      ResizableImage, Link, TaskList, TaskItem, Table,
      TableRow, TableHeader, TableCell, Markdown,
      // ...
    ],
    content,
    // ...
  });
}
```

- Оба используют одинаковый набор расширений
- Оба внедряют `DocumentLockService` с одинаковой логикой
- Оба имеют одинаковые методы `save()`, `revert()`, `reacquire()`, `insertImage()`
- Отличаются только UI-шаблоном (один на весь экран, другой — панель)

**Стратегия:**
- Создать `MarkdownEditorService` (сервис с DI, не базовый класс — наследование компонентов в Angular deprecated)
- Вынести общую логику создания TipTap редактора, расширений, save/load/revert
- Оба компонента инжектят сервис и вызывают его методы
- Разница — только в шаблоне и UI-логике

---

## 6. Ticketing (поддержка) — дублирование между admin и support

**Проблема:** Компоненты `admin.component.ts` и `support.component.ts` имеют дублирующиеся паттерны работы с тикетами.

**Места дублирования:**

| Паттерн | admin | support |
|---------|-------|---------|
| `_scheduleMarkRead` | строки ~260-269 | строки ~160-169 |
| `_cancelMarkRead` | строки ~271-276 | строки ~172-176 |
| `sendMessage` | строки ~306-329 | строки ~179-206 |
| download attachment | строки ~343-353 | строки ~360-370 |
| pagination helpers | строки ~77-80, ~101-104 | строки ~85-93 |
| `trackById()` | строки 552-554 | строки 414-416 |

**Стратегия:**
- Вынести методы работы с тикетами в `SupportTicketService` (сервис Angular)
- `admin` и `support` компоненты оставить только для UI-логики (разные данные, разная вёрстка)

---

## 7. `canViewInBrowser()` — в 2 местах

**Проблема:** Одинаковая проверка возможности просмотра файла в браузере.

**Места:**
- `file-detail.component.ts:238-248`
- `shared-folders.component.ts:296-303`

**Стратегия:**
- Вынести в shared utility: `export function canViewInBrowser(f: { content_kind: string; mime_type: string; view_url: string | null }): boolean`

---

## 8. `trackById()` — в 2 местах

**Проблема:** Шаблон `trackById` для `*ngFor`.

**Места:**
- `admin.component.ts:552-554`
- `support.component.ts:414-416`

**Стратегия:**
- Использовать `trackBy` с Angular утилитой: вынести в shared или использовать `$index` в новых шаблонах Angular

---

## 9. `flattenTree()` — в 2 местах

**Проблема:** Функция разворачивания дерева папок в плоский список.

**Места:**
- `folders-tree.component.ts:1214-1221` — возвращает `{ folder, depth }[]`
- `file-detail.component.ts:202-211` — возвращает `{ id, name, indent }[]`

**Стратегия:**
- Вынести в shared utility с обоими вариантами форматирования

---

## 10. Логика работы с тегами — в 3 местах

**Проблема:** Поиск, фильтрация, создание тегов дублируются.

**Места:**
- `file-detail.component.ts:302-377` — open tag picker, filter, create, add, remove
- `folders-tree.component.ts:1103-1144` — bulk tag dialog
- `shared-folders.component.ts` — ещё одна вариация

**Стратегия:**
- Вынести логику работы с тегами в `TagService` (управление списком тегов, создание, назначение)
