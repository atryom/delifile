# Логические ошибки и нестыковки — Бэкенд

## 1. Отсутствие cycle guard в `FileService::canAccess()` и `SharedFolderController::canAccess()`

**Проблема:** В `FileService::canAccess()` (строка 144-155) и `SharedFolderController::canAccess()` (строка 46-66) нет защиты от циклических ссылок в parent chain shared folder. При зацикленной структуре — бесконечный цикл, приводящий к timeout запроса или падению PHP по памяти.

**Как возникает цикл parent_id на практике:**
- Пользователь не может создать цикл через UI/API — бэкенд проверяет только существование `parent_id`, но не его ацикличность
- **Основной источник:** ручное копирование/восстановление данных (SQL-дампы, миграция между инстансами), когда порядок вставки записей нарушает древовидную структуру
- **Потенциальный источник:** баг в клиенте, если `createSubfolder` передаст parent_id потомка как parent для предка
- БД не имеет CHECK-constraint на `parent_id != id` и нет триггера на ацикличность графа → циклы возможны на уровне данных

**Стратегия:** Добавить `$visited = []` во все обходы parent chain. Уже есть в `DocumentService::canViewDocument()` (строка 181-186):
```php
$visited = [];
while ($current) {
    if (isset($visited[$current->id])) { break; }
    $visited[$current->id] = true;
    ...
}
```

---

## 2. Разное поведение `canAccess()` в SharedFolderController

**Проблема:** `SharedFolderController::canAccess()` (строка 43) проверяет parent chain через `SharedFolder::find($current->parent_id)` (новый запрос на каждый уровень), а `DocumentService::canViewDocument()` — через `$current->parent` (Eloquent-отношение). Первый подход создаёт N+1 запросов, второй — загружает lazy relation.

**Стратегия:** Использовать `$current->parent` (lazy loading) или eager load всю цепочку через with.

---

## 3. Race condition в `completeUpload`

**Проблема:** `FileService::completeUpload()` использует `DB::transaction` с `firstOrCreate` для FileUserAccess (строка 97-101). Но между `initUpload` и `completeUpload` проходит время (файл загружается браузером напрямую в S3). За это время статус файла — `Uploading`. Если пользователь дважды вызовет `completeUpload`, второй запрос тоже пройдёт, но файл уже будет `Available`.

**Стратегия:**
- Добавить проверку `$file->status === FileStatus::Uploading` перед обновлением
- Использовать `update(['status' => FileStatus::Available])` с `where('status', FileStatus::Uploading)` как оптимистичную блокировку

---

## 4. Несоответствие между `checkStorageQuota()` и реальным потреблением

**Проблема:** `checkStorageQuota()` считает сумму `size` всех файлов пользователя (строка 30). Но:
- Версии файлов (`FileVersion.size`) не учитываются
- Файлы со статусом `Deleted` исключены через soft delete, но `sum('size')` не фильтрует по статусу

**Стратегия:**
- Добавить фильтр статуса: `where('status', FileStatus::Available)`
- Учитывать размер всех активных версий

---

## 5. `buildListItem()` не возвращает `is_owner`, `access_type`, `is_favorite`, `is_pinned`

**Проблема:** В списке файлов (`listFiles`) каждый элемент строится через `buildListItem()`, который не включает поля:
- `is_owner` — есть в `buildFileCard()`, нет в `buildListItem()`
- `access_type` — есть в карточке, нет в списке
- `is_favorite` — есть в карточке, нет в списке
- `tags` — есть в карточке, нет в списке

Фронтенд ожидает эти поля, что приводит к ошибкам отображения на странице списка.

**Стратегия:**
- Синхронизировать поля между `buildFileCard()` и `buildListItem()`
- В идеале — один базовый метод `toArray(User $user)` на модели File

---

## 6. `formatFileCard()` в SharedFolderController дублирует поля, но иначе

**Проблема:** `SharedFolderController::formatFileCard()` (строка 84) собирает поля файла для shared folder, но:
- Не включает `tags`, `description`, `is_favorite`, `access_type`, `is_pinned`
- Использует `$addedBy` вместо вычисления `is_owner`
- Добавляет `link_url/link_title/link_image_url/link_site_name` для **всех** файлов, не только URL (строка 96-99)

**Стратегия:**
- Использовать `FileService::buildListItem()` вместо своей реализации
- Привести к единому формату

---

## 7. `Content-Type` в `SharingController::publicLinkPage()` неверный

**Проблема:** `publicLinkPage()` (строка 462) возвращает HTML с `Content-Type: text/html; charset=utf-8`, что правильно. Но если `$link` не найден, возвращается тот же SPA index.html с 200-статусом вместо 404.

**Стратегия:**
- При `!$link || !$link->isValid()` отдавать 404 статус или редирект на страницу "ссылка недействительна"

---

## 8. `resolveLink()` включает `view_url` только для video/audio, но не для image

**Проблема:** В `SharingController::resolveLink()` (строки 337-350):
- Для image: previewUrl заполняется, viewUrl = null
- Для video/audio: viewUrl заполняется, previewUrl = null
- Для pdf: оба null

Фронтенд `public-link.component.ts` использует `view_url` для открытия в браузере. Для image `view_url` будет null, хотя файл можно показать.

**Стратегия:**
- Для image: previewUrl = viewUrl = presigned URL (как делает `resolvePreviewAndViewUrls()` в FileService)
- Для pdf: тоже давать viewUrl (как в `resolvePreviewAndViewUrls()`)

---

## 9. Несоответствие `content()` и `preview()` в FileController

**Проблема:** `FileController::content()` (строка 255) и `preview()` (строка 276) проверяют `$file->isAvailable()` перед `canAccess()`. Если файл не доступен — 404, независимо от прав доступа. Это может ввести в заблуждение: пользователь с доступом видит 404 вместо более точной ошибки.

**Стратегия:**
- Менять порядок: сначала проверка `canAccess()` (403 если нет доступа), потом `isAvailable()` (410/422 если файл удалён)
- Либо объединить проверки

---

## 10. ETag в документах может быть неконсистентным

**Проблема:** `DocumentService::promoteToDocument()` (строка 73) при неудаче HeadObject от S3 вычисляет `md5($content)` как fallback ETag. Это корректно **только** для однопоточных (non-multipart) загрузок. В проекте файлы грузятся напрямую в S3 через presigned PUT URL. S3 ETag для multipart-загрузки — не `md5(content)`, а `md5(concat(md5(chunk1), md5(chunk2), ...)) + "-N"` (где N — число чанков). Laravel не может воспроизвести этот ETag локально без знания границ чанков.

**Реальное положение дел:**
- `fetchEtagFromS3()` (строка 493) получает корректный ETag от S3 через HeadObject — эта часть работает
- `promoteToDocument()` (строка 76-83) при неудаче HeadObject вызывает `Storage::disk('s3')->get(...)` + `md5()` — для multipart-файлов это даст **некорректный** ETag
- `saveDocument()` (строка 106) сравнивает клиентский ETag с `$file->etag` — если ETag не совпадает из-за неверного fallback, пользователь будет видеть ложные конфликты
- После успешного `Storage::disk('s3')->put()` (строка 129) — `fetchEtagFromS3` снова получает правильный ETag, поэтому проблема проявляется только при `promoteToDocument()` для multipart-файлов

**Стратегия:**
- Убрать fallback на `md5($content)` из `promoteToDocument()`
- При невозможности получить ETag от S3 — генерировать UUID-ETag на сервере при initUpload и передавать его клиенту
- При saveDocument клиент присылает тот же UUID → сравнение простое: `$clientEtag === $file->etag`
- **Примечание:** полное решение ETag-консистентности для multipart-загрузок требует изменения архитектуры upload (передавать chunk boundary info на сервер) — отложено до версии 2.0.
