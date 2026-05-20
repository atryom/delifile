# Оптимизация запросов — Бэкенд

## 1. N+1 в SharedFolderController::index()

**Проблема:** Метод `index()` (строка 127) выполняет до 5 отдельных запросов к `shared_folders` и `shared_folder_access` для построения списка корневых папок.

**Текущие запросы:**
1. `SharedFolder::where('owner_id', ...)->pluck('id')`
2. `SharedFolderAccess::where('user_id', ...)->pluck('shared_folder_id')`
3. `SharedFolder::whereIn('id', $ownedIds)->whereNull('parent_id')->pluck('id')`
4. Цикл с N запросами: `SharedFolder::whereIn('id', $toFetch)->get(...)` (для pre-loading ancestors)
5. `SharedFolder::whereIn('id', $showIds)->withCount(...)->get()`
6. `SharedFolderAccess::where('user_id', ...)->whereIn('shared_folder_id', ...)->get()`

**Стратегия:**
- Переписать на один запрос с подзапросами или использовать CTE (Common Table Expression)
- Для pre-loading ancestors использовать рекурсивный LEFT JOIN вместо цикла `while`
- Добавить индекс на `shared_folder_access.user_id` и `shared_folders.parent_id`

**⚠️ Зависимость от версии БД:** Laravel `withExpression()` (CTE) требует MySQL 8.0+ / MariaDB 10.2+ / PostgreSQL / SQLite 3.8.3+. **Проверить версию MySQL перед реализацией.**
- Если БД < 8.0 или MariaDB < 10.2 — CTE недоступен.
- **Альтернатива без CTE:** eager loading цепочки предков с ограничением глубины через `$folder->load('parent.parent.parent')` (max 5 уровней). Менее элегантно, но работает на любой версии.

---

## 2. N+1 в SharedFolderController::subfolders()

**Проблема:** `formatFolder()` вызывает `$folder->children()->count()` (строка 77) для каждой папки, что порождает N+1 запрос.

**Текущий запрос в цикле:**
```php
'children_count' => $folder->children()->count(),  // N+1!
```

**Стратегия:**
- Убрать `children()->count()` из `formatFolder()`
- Вынести в `$folders->loadCount('children as children_count')` при загрузке списка

---

## 3. Неоптимальная загрузка в `FileService::listFiles()`

**Проблема:** Метод `listFiles()` (строка 447) делает `$total = $query->count()`, а затем тот же `$query` снова выполняется с `offset/limit`.

Хуже того: `computeAvailableTypeGroups()` делает **третий** запрос на основе `clone $query` (строка 511) — `SELECT DISTINCT mime_type, content_kind` по всему набору без limit. На больших объёмах это может быть очень тяжело.

**Текущий flow:**
1. `computeAvailableTypeGroups(clone $query)` — полный distinct scan
2. `$total = $query->count()` — полный count scan
3. `$query->with(...)->offset()->limit()->get()` — финальная загрузка

**Стратегия:**
- `computeAvailableTypeGroups` должен выполняться только если требуется (по запросу)
- Кешировать groups на уровне запроса: сделать второй проход только если `available_type_groups` запрошен
- Вынести count в подзапрос через `DB::raw()` для экономии одного полного скана

---

## 4. Отсутствие eager loading в `buildFileCard()`

**Проблема:** `FileService::buildFileCard()` (строка 354) принимает `$file` как модель, но внутри делает дополнительные запросы:

```php
// строка 356-358 — отдельный запрос
$access = FileUserAccess::where('file_id', $file->id)->where('user_id', $user->id)->first();

// строка 378-385 — ещё один запрос через DB::table
DB::table('file_tags')->join('tags', ...)...->get()
```

Вызывается из `FileController::show()` (строка 82) после того, как модель уже загружена. При этом загрузка `$file->load(['owner', 'tags'])` делается только в `createUrlFile()` (строка 339), но не в `show()`.

**Стратегия:**
- Всегда передавать `$file->load(['owner', 'accesses' => fn($q) => ...])` перед вызовом `buildFileCard()`
- В `buildFileCard()` использовать загруженные отношения вместо новых запросов
- Tags загружать через `$file->relationLoaded('tags')` или `$file->tags()->...`

---

## 5. Множественные запросы в `FileController::show()` и `FileDetailComponent`

**Проблема:** С фронтенда при открытии карточки файла уходят 4 параллельных запроса:
```
GET /files/{id}         — загрузка файла
GET /files/{id}/links   — список ссылок
GET /files/{id}/accesses — список доступов
GET /files/{id}/activity — активность
```

Каждый из них делает отдельный запрос к БД на бэкенде.

**Стратегия:**
- Объединить links, accesses и activity в ответ `GET /files/{id}` (опционально, через параметр `?with=links,accesses,activity`)
- Или создать единый endpoint `GET /files/{id}/detail` с полной информацией

---

## 6. Неиспользуемые/избыточные загрузки в `buildListItem()`

**Проблема:** `buildListItem()` (строка 642) делает `FileUserAccess::where(...)->first()` если отношение не загружено (строка 646), но `listFiles()` уже загружает `accesses` с фильтром (строка 533).

**Стратегия:**
- Убрать fallback-запрос из `buildListItem()` — всегда требовать предзагруженное отношение
- Упростить условие: убрать `$user ? null` тернарник

---

## 7. Неоптимальный запрос в `File::canBeDeleted()`

**Проблема:** Метод `canBeDeleted()` (строка 143) делает два отдельных запроса при каждом вызове. Используется в `CleanExpiredFilesJob`.

**Стратегия:**
- Объединить в один запрос с `->exists()` через `orWhere`
- Добавить `withCount` или `loadCount` при использовании в цикле

---

## 8. Сырые SQL запросы

**Проблема:** В коде используются `orderByRaw()` (FileService:527) и `DB::table('file_tags')` напрямую (FileService:281-298, 378-385), что обходит Eloquent-связи.

**Стратегия:**
- Использовать `File::relation('tags')` вместо `DB::table('file_tags')`
- Для сортировки по расширению — добавить виртуальное поле или использовать `orderBy` с выражением через `DB::raw()`
