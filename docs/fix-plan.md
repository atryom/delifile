# План исправления — аудит после рефакторинга

Дата: 25 мая 2026
Основание: анализ SharedFolderController, SharingController, NotificationController, InboxController, FileCardBuilder, MigratePersonalFoldersToShared, моделей

---

## 1. 🔴 HIGH — `can_edit` теряется при pending-шаринге

**Проблема:** `ContactPendingShare` не имеет колонки `can_edit` ни в таблице, ни в `$fillable`. Когда владелец шарит файл с `can_edit: true` незарегистрированному контакту — право теряется. После регистрации и принятия приглашения `InvitationService::accept()` создаёт `FileUserAccess` с `can_edit = false` по умолчанию.

**Цепочка:**
- `SharingController:90-98` — `ContactPendingShare::firstOrCreate()` без `can_edit`
- `InvitationService:61-68` — `FileUserAccess::firstOrCreate()` без `can_edit`
- `ContactPendingShare.$fillable` — нет `can_edit`
- Миграция `contact_pending_shares` — нет колонки `can_edit`

**Исправление (4 шага):**
1. Создать миграцию: `ALTER TABLE contact_pending_shares ADD COLUMN can_edit TINYINT(1) NOT NULL DEFAULT 0 AFTER sender_user_id`
2. В `ContactPendingShare.$fillable` добавить `'can_edit'`
3. В `SharingController::shareToContact()` строка 92-98 передать `'can_edit' => $canEdit` в `firstOrCreate`
4. В `InvitationService::accept()` строка 62-68 передать `'can_edit' => $pending->can_edit` в `FileUserAccess::firstOrCreate`

---

## 2. 🟠 MEDIUM — `description` шарера копируется получателю

**Проблема:** `SharingController:131` копирует `$sharerAccess?->description` в `FileUserAccess` получателя. Если шарер хранил личные заметки в `description`, они утекают.

**Исправление:**
Убрать `'description' => $sharerAccess?->description` из `firstOrCreate()` на строке 131.

---

## 3. 🟠 MEDIUM — `link_url` URL-файлов через публичную ссылку

**Проблема:** `FileCardBuilder::buildPublicItem()` (строки 159-165) возвращает `link_url`, `link_title`, `link_description`, `link_image_url`, `link_site_name`. Публичный эндпоинт `resolveLink()` не требует авторизации — любой с токеном видит URL, который может указывать на внутренний ресурс.

**Исправление:**
В `buildPublicItem()` исключить поля `link_url`, `link_title`, `link_description`, `link_image_url`, `link_site_name`. Публичная ссылка должна показывать только имя, размер, mime-тип.

---

## 4. 🟠 MEDIUM — `DB::insert()` обходит `$fillable`

**Проблема:** `InboxController:85,173` вставляет данные через `DB::table('file_user_access')->insert($toInsert)` и `DB::table('shared_folder_accesses')->insert($toInsert)`. Это bypass-ит защиту `$fillable` Eloquent-моделей. Сейчас массив формируется явно, но код хрупок.

**Исправление (2 варианта):**
- **А:** Заменить на цикл с `FileUserAccess::create()` и `SharedFolderAccess::create()` (безопаснее)
- **Б:** Оставить batch-insert, но перед вызовом применить `Arr::only($toInsert, (new FileUserAccess)->getFillable())`

Вариант **Б** рекомендован — сохраняет производительность batch-insert, добавляет безопасность.

---

## 5. 🟠 MEDIUM — Race condition в миграции папок

**Проблема:** `MigratePersonalFoldersToShared:122-132` — раздельные `SharedFolder::where(...)->first()` + `create()` вместо атомарного `firstOrCreate()`. При конкурентном запуске возможны дубликаты.

**Исправление:**
Заменить на `SharedFolder::firstOrCreate([...lookup], [...defaults])` внутри транзакции, аналогично тому, как уже сделано в `linkFileToSharedFolder()` (строки 182-194).

---

## 6. 🟡 LOW — `whereIn` с одним элементом

**Проблема:** `whereIn('access_type', [AccessType::Shared->value])` вместо `where('access_type', AccessType::Shared->value)`.

**Файлы:**
- `DocumentController.php:147`
- Возможны другие в SharedFolderController и изменённых контроллерах

**Исправление:**
Заменить `whereIn` на `where` во всех найденных местах.

---

## Сводка

| # | Серьёзность | Описание | Файлы | Сложность |
|---|-------------|----------|-------|-----------|
| 1 | 🔴 HIGH | `can_edit` теряется при pending-шаринге | SharingController, InvitationService, ContactPendingShare + миграция | 4 правки |
| 2 | 🟠 MEDIUM | `description` шарера копируется получателю | SharingController:131 | 1 строка |
| 3 | 🟠 MEDIUM | `link_url` URL-файлов через публичную ссылку | FileCardBuilder:159-165 | 1 метод |
| 4 | 🟠 MEDIUM | `DB::insert()` обходит `$fillable` | InboxController:85,173 | 2 правки |
| 5 | 🟠 MEDIUM | Race condition в миграции папок | MigratePersonalFoldersToShared:122-132 | 1 блок |
| 6 | 🟡 LOW | `whereIn` с одним элементом | DocumentController + др. | Поиск + замена |
