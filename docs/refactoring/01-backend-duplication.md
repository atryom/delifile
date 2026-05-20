# Дублирование кода — Бэкенд

## 1. Presigned URL-генерация

**Проблема:** Вызовы `Storage::disk('s3')->temporaryUrl(...)` разбросаны по 8 файлам (~15 мест). Нет центрального метода, разные TTL, разная обработка ошибок.

**→ Подробное описание, список всех мест и стратегия: `03-backend-s3-optimization.md`**

---

## 2. Проверка доступа к файлу (access check)

**Проблема:** Логика проверки доступа к файлу с обходом shared folder parent chain дублируется.

**Места:**
- `FileService::canAccess()` (строки 126-158) — основная, 33 строки
- `DocumentService::canViewDocument()` (строки 166-200) — почти идентичный код, 35 строк
- `DocumentService::canEditDocument()` (строки 152-164) — упрощённая версия, 13 строк
- `SharedFolderController::canAccess()` (строки 43-67) — свой велосипед обхода parent chain, 25 строк
- `File::hasAccessFor()` (строки 138-141) — только прямая проверка accesses, без shared folder

**Различия между `FileService::canAccess` и `DocumentService::canViewDocument`:**
- `DocumentService` имеет cycle guard (`$visited[]`)
- `DocumentService` использует `$current->parent` (relation) вместо `SharedFolder::find()`
- В остальном — одинаковая логика обхода parent chain

**Стратегия:**
- Единый метод на модели `File::userCanAccess(User $user): bool` или в `FileService`
- `DocumentService::canViewDocument()` делегирует в `FileService::canAccess()`
- SharedFolder проверки вынести в `SharedFolderAccessService`
- Добавить cycle guard во все обходы parent chain (сейчас есть только в `DocumentService`)

---

## 3. Построение file card / list item

**Проблема:** 5 разных реализаций сборки массива с данными файла, каждая со своими полями.

**Места:**
- `FileService::buildFileCard()` (строка 354) — **45+ полей**, полная карточка
- `FileService::buildListItem()` (строка 642) — **15 полей**, урезанный список
- `SharedFolderController::formatFileCard()` (строка 84) — **16 полей**, своя версия
- `SharingController::resolveLink()` (строка 353) — **ручное построение** массива
- `SharedFolderController::publicFiles()` — ещё одна ручная сборка

**Стратегия:**
- Создать `FileCardBuilder` (или расширить модель `File` методами `toCard()`, `toListItem()`)
- Убрать `formatFileCard()` из `SharedFolderController`, заменить на `FileService::buildListItem()`
- `resolveLink()` должен использовать общий метод с минимальным набором полей для публичного доступа
- Ввести DTO/Value Object для file card с чёткой спецификацией полей

---

## 4. MIME-тип классификация

**Проблема:** Логика классификации MIME-типов по группам (image, video, document, archive и т.д.) размножена.

**Места:**
- `FileService::classifyMimeType()` (строка 623) — 18 строк, полная классификация
- `FileService::applyTypeGroupFilter()` (строка 547) — 64 строки, те же паттерны для SQL
- `SharingController::buildOgDescription()` (строка 501) — свои `match()` по MIME
- `FileVersionController::getMimeGroup()` (строка 266) — упрощённая (image/video/audio/other)
- `FileController::content()` / `preview()` — неявная классификация через `str_starts_with()`

**Стратегия:**
- Создать `MimeService` с методами:
  - `classify(string $mime): string` — image/video/audio/document/archive/note/link/other
  - `buildSqlTypeGroupFilter(Builder $query, string $group): void`
  - `isPreviewable(string $mime): bool`
  - `isViewableInBrowser(string $mime): bool`
- Использовать `MimeService` во всех контроллерах и сервисах
- Убрать дублирование `str_starts_with` / `str_contains` по файлам

---

## 5. Обход parent chain shared folder

**Проблема:** Одинаковый паттерн подъёма по дереву shared folder для проверки прав повторяется в 4 местах.

**→ Подробное описание, места и стратегия: `04-backend-logical-errors.md` (п.1-2)**

---

## 6. QUOTA_EXCEEDED проверки

**Проблема:** Одинаковый паттерн проверки квоты и размера файла, разный текст ошибок.

**Места:**
- `FileController::initUpload()` — проверка file size limit + storage quota
- `SharedFolderController::initUpload()` — то же самое
- `DocumentService::saveDocument()` — только delta quota
- `FileVersionController::initUpload()` — только storage quota

**Стратегия:**
- Вынести в `FileService` методы:
  - `validateFileSizeLimit(User $user, int $fileSize): ?array` (возвращает ошибку или null)
  - `validateStorageQuota(User $user, int $size): ?array`
- Единообразные сообщения об ошибках через Lang-файлы

---

## 7. Upload Flow

**Проблема:** Логика инициализации загрузки файла с опциональным thumbnail дублируется.

**Места:**
- `FileService::initUpload()` (строка 38) — основной upload
- `FileVersionController::initUpload()` (строка 24) — загрузка версии, та же логика генерации storage key и presigned URL
- `SharedFolderController::initUpload()` (строка 456) — через `FileService::initUpload()`, но добавляет свою логику shared_folder_only

**Стратегия:**
- `FileVersionController::initUpload()` должен делегировать в `FileService::initVersionUpload()`
- Единая генерация storage key: вынести в `StorageKeyGenerator`

---

## 8. Отправка уведомлений при шаринге

**Проблема:** Логика отправки push + activity при предоставлении доступа размазана.

**Места:**
- `SharingController::shareToContact()` — push + activity
- `SharedFolderController::shareToContact()` — своя реализация
- `InvitationService` — ещё одна вариация

**Стратегия:**
- Создать `NotificationDispatcher` с методом `notifyShared(File|SharedFolder, User $sender, User $recipient)`
- Использовать во всех местах, где предоставляется доступ
