# Re-аудит³ логических ошибок (после спринтов 1–22)

> **Дата:** 2026-05-20
> **Статус:** завершён 🔍
> **Раунд:** 4-й финальный аудит

---

## 🔴 CRITICAL

### 1. `ContactController::store()` — дублирование проверяется только по email

- **Файл:** `backend/app/Http/Controllers/Contacts/ContactController.php:63-68`
- **Код:**
  ```php
  if ($request->email) {
      $duplicateQuery->where('email', $request->email);
  } elseif ($request->phone) {   // ← else-if, а нужно if + orWhere
      $duplicateQuery->where('phone', $request->phone);
  }
  ```
- **Описание:** Если переданы и email, и phone, проверка дубликата выполняется **только по email**. `elseif` не выполняется при наличии email. Позволяет создать два контакта с одинаковым phone (разные email) и с одинаковым email (разные phone).
- **Решение:** Заменить на:
  ```php
  if ($request->email) {
      $duplicateQuery->where('email', $request->email);
  }
  if ($request->phone) {
      $duplicateQuery->orWhere('phone', $request->phone);
  }
  ```

---

## 🟠 HIGH

### 2. `InvitationController::reject()` — полное отсутствие авторизации

- **Файл:** `backend/app/Http/Controllers/Invitations/InvitationController.php:93-103`
- **Код:** Нет `$request`, нет `$request->user()`. Любой аутентифицированный пользователь может отклонить любое приглашение.
- **Решение:** Добавить `Request $request` + проверка sender или target_email.

### 3. `InvitationService::accept()` — отсутствует проверка email

- **Файл:** `backend/app/Services/InvitationService.php:38-77`
- **Описание:** Не проверяет, что `$invitation->target_email` совпадает с email принимающего. Любой, кто знает токен, может принять чужое приглашение.
- **Решение:** Добавить проверку в `InvitationController::accept()`:
  ```php
  if (strtolower($request->user()->email) !== strtolower($invitation->target_email)) {
      return $this->forbidden();
  }
  ```

### 4. `SharingController::disableLink` — проверка `created_by` (известное исключение)

- **Файл:** `backend/app/Http/Controllers/Files/SharingController.php:313`
- **Код:**
  ```php
  if ($link->created_by !== $request->user()->id) { return $this->forbidden(); }
  ```
- **Описание:** Для ссылок, созданных до введения поля `created_by`, его значение — `null`. Владелец файла не может отключить такую ссылку (null !== $user->id → 403). Edge case, известный из предыдущих аудитов.
- **Решение:** `if ($link->created_by !== $request->user()->id && !$link->file->isOwnedBy($request->user())) { ... }`

---

## 🟡 MEDIUM

### 5. `SharingController::listLinks()` — `canAccess` вместо `isOwnedBy`

- **Файл:** `backend/app/Http/Controllers/Files/SharingController.php:279`
- **Описание:** Любой с shared/saved доступом видит список share-ссылок, включая статус и expires_at.
- **Решение:** `$file->isOwnedBy($request->user())`.

### 6. `DocumentService::promoteToDocument()` — любой viewer может включить редактирование

- **Файл:** `backend/app/Services/DocumentService.php:81-98`
- **Описание:** `canViewDocument()` = `canAccess()` — любой shared-пользователь может навсегда сделать файл редактируемым.
- **Решение:** Проверять `isOwnedBy` или `canEdit` перед promote.

### 7. 9× `error($message, 422)` вместо `error($message, 'CODE', [], 422)`

- **Файлы:** `Support/SuggestionController.php:60`, `Support/SupportTicketController.php:70,134,147,195`, `Admin/SupportAdminController.php:86,106,134,147`
- **Описание:** Второй параметр `$code` ожидает строку-код ошибки, но передаётся `int 422`. Ответ: `{"code":"422"}` вместо осмысленного кода.
- **Решение:** Заменить на `$this->error($error, 'DESCRIPTIVE_CODE', [], 422)`.

### 8. `FileController::show()` — information disclosure (404 vs 403)

- **Файл:** `backend/app/Http/Controllers/Files/FileController.php:73-79`
- **Описание:** Сначала `File::find()` (404 если нет), затем `canAccess()` (403 если нет доступа). Злоумышленник может определить существование файла по разнице кодов.
- **Решение:** Использовать единую проверку: `$file = File::find($fileId); if (!$file || !$this->fileService->canAccess(...)) { return $this->notFound(); }`.
- **Аналогично:** `destroy()`, `download()`, `SharedFolderController::files()`, `DocumentController::show()`, `DocumentLockController::acquire()`.

### 9. `SharedFolderController::resolveSharedLink` — перманентный доступ

- **Файл:** `backend/app/Http/Controllers/SharedFolders/SharedFolderController.php:910-917`
- **Описание:** Любой аутентифицированный пользователь, перейдя по публичной ссылке, навсегда получает доступ к общей папке. Не отзывается при деактивации ссылки.
- **Решение:** Добавить `expires_at` на выдаваемый доступ, привязать к времени жизни ссылки.

### 10. `shared_folder_only` — orphan-файлы при удалении последней папки

- **Файл:** `backend/app/Http/Controllers/SharedFolders/SharedFolderController.php:353-363`
- **Описание:** При `destroy` общей папки файлы с `shared_folder_only=true` не обрабатываются — остаются недоступными сиротами.
- **Решение:** При удалении последней shared_folder установить `shared_folder_only=false`.

### 11. `AdminController::users()` — нет пагинации

- **Файл:** `backend/app/Http/Controllers/Admin/AdminController.php:29-50`
- **Описание:** `User::select(...)->orderByDesc('created_at')->get()` загружает всех пользователей в память. Риск OOM на крупных инсталляциях.
- **Решение:** Добавить `->paginate(50)` или `->cursor()`.

### 12. Rate limiting — нет отдельного лимита на auth-эндпоинты

- **Файл:** `backend/app/Providers/AppServiceProvider.php:19-21`
- **Описание:** Единый лимит 60 req/min на всё API. `login`, `register`, `password/forgot` должны иметь более строгий лимит (5–10 req/min).
- **Решение:** Добавить отдельные `RateLimiter::for('auth', ...)`.

### 13. `InvitationService::send()` — нет валидации `file_id`

- **Файл:** `backend/app/Http/Controllers/Invitations/InvitationController.php:21-34`
- **Описание:** `'file_id' => 'nullable|string'` без `exists:files,id`. Любой пользователь может создать приглашение с любым file_id.
- **Решение:** Добавить `'exists:files,id'`.

### 14. `CompleteUploadRequest` — нет `exists:files,id`

- **Файл:** `backend/app/Http/Requests/Files/CompleteUploadRequest.php:17`
- **Описание:** `'file_id' => ['required', 'string']` без `exists:files,id`. 404 вместо 422.
- **Решение:** Добавить `'exists:files,id'`.

### 15. `ContactController::import` — потеря данных при дубликатах в batch

- **Файл:** `backend/app/Http/Controllers/Contacts/ContactController.php:172-193`
- **Описание:** Если в одном импорте два элемента с одинаковым email, `updateOrCreate` перезапишет первый. Данные (имя) потеряны.
- **Решение:** Дедуплицировать `$request->contacts` по email перед обработкой.

### 16. `CommentService::processMentions()` — упоминания без проверки доступа

- **Файл:** `backend/app/Services/CommentService.php:300-337`
- **Описание:** Push-уведомление об упоминании содержит имя файла и deep link. Если упомянутый не имеет доступа к файлу — утечка информации.
- **Решение:** Фильтровать `$mentionedUserIds` по `canAccess`.

---

## 🔵 LOW

### 17. `FileController::setTags()` — не проверяет ownership тегов в валидации

- **Файл:** `backend/app/Http/Controllers/Files/FileController.php:375`
- **Описание:** `$request->validate(['tag_ids' => 'required|array'])` без `exists:tags,id,user_id,...`. Проверка только в бизнес-логике `FileService::setTags()`.
- **Решение:** Добавить `'tag_ids.*' => 'exists:tags,id,user_id,' . $request->user()->id`.

### 18. `FileController::index()` — нет bounds checking на per_page

- **Файл:** `backend/app/Http/Controllers/Files/FileController.php:34-35`
- **Описание:** `(int) $request->get('per_page', 20)` — без min/max. Отрицательные значения приводят к невалидному SQL.
- **Решение:** `'per_page' => 'nullable|integer|min:1|max:100'`.

### 19. `ContactController::index()` — нет пагинации

- **Файл:** `backend/app/Http/Controllers/Contacts/ContactController.php:29-44`
- **Описание:** Список контактов без пагинации.
- **Решение:** Добавить `->paginate(50)`.

### 20. `PasswordResetService::sendResetLink()` — DoS на сброс пароля

- **Файл:** `backend/app/Services/PasswordResetService.php:22-23`
- **Описание:** `PasswordResetCode::where('email', $email)->delete()` удаляет все старые коды. Злоумышленник может бесконечно сбрасывать коды сброса пароля.
- **Решение:** Удалять только истёкшие, или ограничить частоту запросов.

### 21. `UrlFileController::store()` — отсутствует санитизация preview

- **Файл:** `backend/app/Http/Controllers/Links/UrlFileController.php:36-43`
- **Описание:** Поля `title`, `description`, `site_name` от внешнего URL сохраняются без санитизации.
- **Решение:** Добавить trim, strip_tags, ограничение длины.

### 22. `ContactController::store()` — хардкод русского текста

- **Файл:** `backend/app/Http/Controllers/Contacts/ContactController.php:116-119`
- **Описание:** Текст push-уведомления на русском — неинтернационализирован.
- **Решение:** Использовать `__('messages.contact_request')` или аналогичный i18n-метод.

---

## Сводка

| Severity | Всего | Проблемы |
|----------|-------|----------|
| **CRITICAL** | 1 | ContactController duplicate check (else-if вместо OR) |
| **HIGH** | 3 | InvitationController reject без auth, InvitationService accept без email, disableLink created_by |
| **MEDIUM** | 12 | listLinks, promoteToDocument, 9× error(422), 404vs403, resolveSharedLink, shared_folder_only orphans, Admin пагинация, rate limit, InvitationService send, CompleteUploadRequest, Contact import duplicates, CommentService mentions |
| **LOW** | 6 | setTags validation, per_page bounds, ContactController пагинация, PasswordReset DoS, preview sanitize, hardcoded ru |

**Всего: 22 находки** (1 CRITICAL, 3 HIGH, 12 MEDIUM, 6 LOW)
