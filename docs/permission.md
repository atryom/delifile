# Анализ системы прав DeliFile (FileSpace)

## Архитектура системы прав

**4 модели доступа:**

| Модель | Сущность | Типы доступа | Наследование |
|---|---|---|---|---|
| `file_user_access` | Файл | `owner` / `shared` / `saved` | Нет (per-user per-file) |
| `shared_folder_accesses` | Общая папка | `view` / `edit` | Да (по цепочке parent_id до root) |
| `share_links` | Публичная ссылка на файл | `allow_save: bool` | Нет |
| `shared_folder_links` | Публичная ссылка на папку | `view` / `edit` + `allow_save` | Нет |
| `file_user_access.can_edit` | Markdown-документ | `can_edit: bool` на shared-доступе | Нет |

---

## Таблица 1: Права на ФАЙЛ по типу доступа

| Операция | Owner | Shared | Saved |
|---|---|---|---|
| **Просмотр** (show/preview) | ✅ | ✅ | ✅ |
| **Скачивание** (download) | ✅ | ✅ | ✅ |
| **Закрепить/Открепить** (pin/unpin) | ✅ | ✅ (конвертирует в Saved) | ✅ |
| **Избранное** (fav/unfav) | ✅ | ✅ | ✅ |
| **Описание** (description) | ✅ | ✅ | ✅ |
| **Теги** (set-tags) | ✅ | ✅ | ✅ |
| **Переместить в лок. папку** (move-folder) | ✅ | ✅ | ✅ |
| **Удалить** (destroy) | ✅ логическое удаление | ✅ только detach своего доступа | ✅ только detach |
| **Поделиться с контактом** | ✅ **Owner Only** | ❌ | ❌ |
| **Создать публичную ссылку** | ✅ **Owner Only** | ❌ | ❌ |
| **Отозвать доступ** | ✅ **Owner Only** | ❌ | ❌ |
| **Список доступов** (accesses) | ✅ **Owner Only** | ❌ | ❌ |
| **Загрузить версию** | ✅ **Owner Only** | ❌ | ❌ |
| **Обновить display-name** | ✅ **Owner Only** | ❌ | ❌ |
| **Добавить в общую папку** | ✅ (есть edit в папке) | ✅ (есть edit в папке) | ✅ (есть edit в папке) |
| **Комментировать** | ✅ (`can_comment=true`) | ✅ (по умолч. true) | ✅ |
| **Активность (activity)** | ✅ все события | ✅ только свои | ✅ только свои |
| **Скачать версию** | ✅ | ✅ | ✅ |
| **Markdown: просмотр документа** | ✅ | ✅ (с can_edit=false) | ✅ (с can_edit=false) |
| **Markdown: редактирование** | ✅ | ✅ (только can_edit=true) | ❌ |
| **Markdown: захват блокировки** | ✅ | ✅ (только can_edit=true) | ❌ |
| **Markdown: перехват блокировки (takeover)** | ✅ **Owner Only** | ❌ | ❌ |

---

## Таблица 2: Права на ОБЩУЮ ПАПКУ по типу доступа

| Операция | Owner | View | Edit |
|---|---|---|---|
| **Видеть папку в списке** | ✅ | ✅ | ✅ |
| **Смотреть список файлов** | ✅ | ✅ | ✅ |
| **Скачать/просмотреть файлы** | ✅ | ✅ | ✅ |
| **Создать подпапку** | ✅ | ❌ | ✅ |
| **Загрузить файл** (init/complete upload) | ✅ | ❌ | ✅ |
| **Добавить URL-file** | ✅ | ❌ | ✅ |
| **Добавить существующий файл** | ✅ | ❌ | ✅ (с наследованием от родительских папок) |
| **Удалить файл из папки** | ✅ | ❌ | ✅ (с наследованием от родительских папок) |
| **Выйти из папки** (leave) | ❌ (Owner can't leave) | ✅ | ✅ |
| **Переименовать папку** | ✅ **Owner Only** | ❌ | ❌ |
| **Удалить папку** | ✅ **Owner Only** | ❌ | ❌ |
| **Управлять доступами** | ✅ **Owner Only** | ❌ | ❌ |
| **Создать публичную ссылку** | ✅ **Owner Only** | ❌ | ❌ |
| **Листинг доступов** | ✅ **Owner Only** | ❌ | ❌ |

---

## Таблица 3: Сценарии "U1 и U2"

### Сценарий A — Локальная папка (personal folder)

U1: создаёт `folders` с `user_id = U1.id`.

| Аспект | U1 | U2 |
|---|---|---|
| Видит папку | ✅ в своём дереве | ❌ не существует для U2 |
| Видит файлы внутри | ✅ свои | ❌ |
| Операции с папкой | ✅ все | ❌ |

### Сценарий B — Прямой шэринг файла (share-to-contact)

U1 загружает `file1`, делится с U2. Создаётся `FileUserAccess(U1=owner, U2=shared)`.

| Операция | U1 (owner) | U2 (shared) |
|---|---|---|
| Просмотр | ✅ | ✅ |
| Скачивание | ✅ | ✅ |
| Pin | ✅ | ✅ → Saved (закрепление сохраняет файл) |
| Delete | ✅ логическое удаление | ✅ detach (файл пропадает у U2) |
| Share | ✅ | ❌ |
| CreateLink | ✅ | ❌ |
| Accesses list | ✅ | ❌ |
| Версионирование | ✅ | ❌ |
| Activity | ✅ все события | ✅ только свои события |
| Комментарии | ✅ | ✅ |

### Сценарий C — Общая папка, U2 с доступом view

U1: `SharedFolder(root)` → addAccess(U2, view)

| Операция | U1 (owner) | U2 (view) |
|---|---|---|
| Видит папку | ✅ | ✅ |
| Список файлов | ✅ | ✅ |
| Скачать/просмотреть | ✅ | ✅ |
| Создать подпапку | ✅ | ❌ |
| Загрузить файл | ✅ | ❌ |
| Удалить файл из папки | ✅ | ❌ |
| Выйти из папки | ❌ | ✅ |
| Переименовать/удалить папку | ✅ | ❌ |
| Управлять доступами | ✅ | ❌ |

### Сценарий D — Общая папка, U2 с доступом edit

U1: `SharedFolder(root)` → addAccess(U2, edit)

| Операция | U1 (owner) | U2 (edit) |
|---|---|---|
| Создать подпапку | ✅ | ✅ |
| Загрузить файл | ✅ | ✅ (shared_folder_only=true) |
| Добавить URL-file | ✅ | ✅ |
| Удалить свой файл из папки | ✅ | ✅ (как fileOwner ИЛИ edit) |
| Удалить чужой файл из папки | ✅ | ✅ (как edit доступ) |
| Переименовать/удалить папку | ✅ | ❌ |
| Управлять доступами | ✅ | ❌ |

**Важно:** U2 загружает файл → `file.owner_id = U2.id`, `shared_folder_only = true`. Файл привязан к общей папке. Право U2 на файл — через `SharedFolderFile`, не через `FileUserAccess`.

### Сценарий E — Shared folder с вложенными, U2 имеет доступ на корень

```
SharedFolder(root)  ← U2: view
  └── Sub1
       └── Sub2
```

U2 получает доступ по **наследованию**: `canAccess()` ходит вверх по parent_id. Для Sub2: check Sub2 → нет прямой записи → check Sub1 → нет → check root → есть view → true.

**Результат:** U2 видит все подпапки и файлы на всех уровнях (с правом view).

### Сценарий F — Shared folder, U2 имеет доступ только на подпапку

```
SharedFolder(root)  ← U1: owner, U2: нет доступа
  └── Sub1          ← U2: view (прямая запись)
```

| Аспект | U2 |
|---|---|
| Видит `root` | ❌ (нет доступа, нет owner) |
| Видит `Sub1` | ✅ (появляется на верхнем уровне в index) |
| Видит файлы в `Sub1` | ✅ |
| Видит родительскую `root` | ❌ |

**Логика `index()`:** если у U2 есть доступ к `Sub1`, но ни один ancestor (`root`) не доступен, `Sub1` показывается как корневая папка для U2.

### Сценарий G — Файлы в общей папке (shared_folder_only)

U1 создаёт root с доступом edit для U2.

U1 загружает `fileA` напрямую в папку:
- `fileA.owner_id = U1.id`, `shared_folder_only = true`
- `SharedFolderFile(root, fileA, added_by=U1)`
- U2 видит fileA через shared folder (view/edit)

U2 загружает `fileB`:
- `fileB.owner_id = U2.id`, `shared_folder_only = true`
- U1 видит fileB через shared folder

**Критическое отличие:** Файлы с `shared_folder_only=true`:
- НЕ появляются в `filter=mine` у owner (если `shared_folder_only=true`)
- После upload автоматически получают `shared_folder_only=true`
- Могут быть перенесены в личные через `POST add-to-my-files` (owner only, сбрасывает `shared_folder_only`)

### Сценарий H — Публичная ссылка на файл

U1 создаёт `ShareLink` для `file1`:

| Действие | Unauthenticated user | U2 (authenticated) |
|---|---|---|
| `resolveLink` (получить метаданные) | ✅ | ✅ |
| `downloadViaLink` (скачать) | ✅ | ✅ |
| `saveViaLink` (сохранить к себе) | ❌ (требует auth) | ✅ если `allow_save=true` |

При saveViaLink: создаётся `FileUserAccess(U2, saved)`.
- Нельзя сохранить свой же файл.
- Нельзя сохранить если уже есть доступ.

### Сценарий I — Публичная ссылка на общую папку

U1 создаёт `SharedFolderLink` для `root`:

| Действие | Unauthenticated | U2 (auth) |
|---|---|---|
| `resolveSharedLink` | ✅ | ✅ (плюс авто-добавление доступа!) |
| `publicFiles` (список файлов) | ✅ | ✅ |

**Авто-грант при resolveSharedLink:** если пользователь авторизован и не owner, создаётся `SharedFolderAccess(U2, folder, link.access_type)`. Это даёт постоянный доступ.

### Сценарий J — Файл и в общей папке, и расшарен напрямую

U1 создаёт `file1`, добавляет в `root` shared folder (edit для U2), И делится напрямую share-to-contact с U2.

- U2 имеет доступ через `FileUserAccess(U2, shared)` И через `SharedFolderFile → SharedFolderAccess(U2, edit)`
- `canAccess()` для файла: срабатывает первый же путь.
- Для owner: delete удаляет файл полностью (логически). U2: detach удаляет только `FileUserAccess`, но доступ через shared folder остаётся!

### Сценарий K — Наследование с разными типами на разных уровнях

```
SharedFolder(root)  ← U2: view
  └── Sub1          ← U2: edit (прямая запись — расширение прав)
       └── Sub2     ← нет записи для U2
```

| Уровень | U2 доступ |
|---|---|
| root | view (прямая) |
| Sub1 | edit (прямая — расширяет права) |
| Sub2 | edit (наследование от Sub1) |

| Проверка | Результат |
|---|---|
| `canAccess(Sub2, 'view')` | **true** (Sub1 → edit подходит под view; root → view) |
| `canAccess(Sub2, 'edit')` | **true** (Sub1 → edit подходит под edit) |
| `canAccess(root, 'edit')` | **false** (root → view, не подходит под edit; нет записи edit) |

---

### Сценарий L — Markdown-документ с блокировками

U1 создаёт Markdown-документ (`is_editable=true`, `editor_type='markdown'`). Файл расшарен с U2 (shared, `can_edit=true`). U3 имеет shared-доступ с `can_edit=false`.

```
Файл (markdown): owner=U1
├── U1: FileUserAccess(owner)
├── U2: FileUserAccess(shared, can_edit=true)
└── U3: FileUserAccess(shared, can_edit=false)
```

| Операция | U1 (owner) | U2 (shared, can_edit) | U3 (shared, no edit) |
|---|---|---|---|
| Просмотр документа | ✅ | ✅ | ✅ |
| Редактирование (PUT document) | ✅ | ✅ | ❌ (403) |
| Захват блокировки | ✅ | ✅ | ❌ (403) |
| Heartbeat блокировки | ✅ | ✅ | ❌ (423) |
| Перехват блокировки (takeover) | ✅ | ❌ (403) | ❌ (403) |
| Снятие блокировки | ✅ (своей) | ✅ (своей) | ❌ |
| Сохранение (quota_exceeded → 413) | ✅ (проверка квоты) | ✅ (проверка квоты) | ❌ |

**Проверка блокировки при сохранении:**
- При PUT /documents/{id} проверяется `hasValidLock()` — 423 `LOCK_REQUIRED`, если блокировка не захвачена или истекла
- При конфликте etag → 409 `DOCUMENT_CONFLICT` с текущим состоянием

**Логика `canViewDocument()`:**
1. Owner → true
2. Есть `FileUserAccess` → true
3. Доступ через shared folder → true
4. Иначе → false

**Логика `canEditDocument()`:**
1. Owner → true
2. `FileUserAccess` с `access_type=shared` AND `can_edit=true` → true
3. Иначе → false

---

## Исправления

### Исправлено: наследование прав в `SharedFolderFileController`

В `addFile()`, `removeFile()` и `updateSharedFolders()` проверка edit-доступа теперь использует обход ancestry (аналогично `SharedFolderController::canAccess()`), через новый приватный метод `canAccessSharedFolder()`, который ходит по цепочке parent_id до root.

**Было:** прямая проверка `SharedFolderAccess::where('shared_folder_id', $folderId)...` без учёта наследования от родительских папок.

**Стало:** вызов `$this->canAccessSharedFolder($user, $folder, 'edit')` с полным обходом parent_id до root.

### Поведение, не являющееся багом (запроектированное)

- **Отзыв доступа у shared folder не каскадный** — удаляется только запись на конкретной папке, прямые назначения на подпапках сохраняются.
- **Pin конвертирует Shared в Saved** — это штатное поведение: закрепление файла получателем означает сохранение файла у себя.

---

## Итоговая сводка

| Концепция | Особенность |
|---|---|
| **Local folders** | Только для owner, не шарится |
| **File share (direct)** | Только view/скачивание/комментирование/tags/fav/pin. Без права пересылать. |
| **Shared folder (view)** | R/O, наследуется на все подпапки |
| **Shared folder (edit)** | Добавление/удаление файлов, создание подпапок |
| **Наследование прав** | Только вверх (additive), нет механизма restrict для подпапок |
| **Public file link** | Можно разрешить save себе в аккаунт |
| **Public folder link** | Auth-юзеру авто-выдаётся постоянный доступ |
| **Owner** | Абсолютный контроль (share, link, delete, rename, manage accesses) |
| **Saved** | Файл навсегда сохранён пользователем — owner не может удалить пока есть Saved (см. `File::canBeDeleted()`) |
| **Markdown document** | Owner может редактировать и управлять блокировками. Shared-пользователь редактирует только с `can_edit=true`. Блокировка — pessimistic lock с heartbeat/takeover. |
