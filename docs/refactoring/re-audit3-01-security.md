# Re-аудит³ безопасности (после спринтов 1–22)

> **Дата:** 2026-05-20
> **Статус:** завершён 🔍
> **Раунд:** 4-й финальный аудит

---

## 🔴 CRITICAL

### 1. `User::$fillable` содержит `is_superuser`

- **Файл:** `backend/app/Models/User.php:27`
- **Код:** `'is_superuser'` в `$fillable`
- **Описание:** Поле суперпользователя никогда не должно быть массово присваиваемым. Если какой-либо путь кода передаст пользовательские данные в `User::create()` или `$user->update()`, злоумышленник может назначить себе права администратора. Сейчас не эксплуатируется (нет ни одного `$request->all()`), но критическая бомба замедленного действия.
- **Решение:** Удалить `'is_superuser'` из `$fillable`. Устанавливать напрямую: `$user->is_superuser = true; $user->save();`.

### 2. `InvitationService::accept()` — отсутствует проверка email

- **Файл:** `backend/app/Services/InvitationService.php:38-77`
- **Код:** Метод проверяет `$invitation->isUsable()` (status=pending + not expired), но **не проверяет**, что `$invitation->target_email` совпадает с email принимающего пользователя.
- **Описание:** Любой аутентифицированный пользователь, получивший токен приглашения, может принять приглашение, предназначенное для другого email. Токен — `Str::random(48)`, но если он утёк (логи, URL в истории, пересылка), злоумышленник получает доступ к файлам, расшаренным через это приглашение.
- **Решение:** Добавить проверку в `InvitationController::accept()`:
  ```php
  if (strtolower($request->user()->email) !== strtolower($invitation->target_email)) {
      return $this->forbidden('This invitation was not sent to you');
  }
  ```

### 3. `InvitationController::reject()` — полное отсутствие авторизации

- **Файл:** `backend/app/Http/Controllers/Invitations/InvitationController.php:93-103`
- **Код:**
  ```php
  public function reject(string $token): JsonResponse  // Нет Request параметра!
  {
      $invitation = Invitation::where('token', $token)->first();
      if (!$invitation) { return $this->notFound(...); }
      $this->invitationService->reject($invitation);  // Нет проверки пользователя
  }
  ```
- **Описание:** Метод не принимает `$request`, не вызывает `$request->user()`. Любой аутентифицированный пользователь может отклонить (отменить) любое приглашение по токену, независимо от того, отправитель он или получатель. `InvitationService::reject()` тоже не проверяет пользователя.
- **Решение:** Добавить параметр `Request $request` и проверку, что пользователь является отправителем или целевым получателем.

---

## 🟠 HIGH

### 4. `SharingController::listLinks` — `canAccess` вместо `isOwnedBy`

- **Файл:** `backend/app/Http/Controllers/Files/SharingController.php:279`
- **Код:**
  ```php
  if (!$file || !$this->fileService->canAccess($request->user(), $file)) {
      return $this->notFound('File not found');
  }
  ```
- **Описание:** Любой пользователь с shared/saved доступом может просмотреть список share-ссылок на файл, включая статус, `expires_at`, `allow_save`. Share-ссылки — публичные URL для скачивания, их список должен быть видим только владельцу.
- **Решение:** Заменить `canAccess` на `$file->isOwnedBy($request->user())`.

### 5. `User::$fillable` содержит `plan`, `account_status`, `email_verified_at`

- **Файл:** `backend/app/Models/User.php:21-26`
- **Код:** `'plan'`, `'account_status'`, `'email_verified_at'` в `$fillable`
- **Описание:** Тарифный план, статус блокировки и верификация email не должны быть массово присваиваемыми. Сейчас управляются только через админ-контроллеры/сервисы, но fillable создаёт риск при будущих изменениях кода.
- **Решение:** Удалить из `$fillable`. Устанавливать напрямую.

### 6. `DocumentService::promoteToDocument()` — любой viewer может включить редактирование

- **Файл:** `backend/app/Services/DocumentService.php:81-98`
- **Код:** Вызывается из `DocumentController::show()` после `canViewDocument()` (который = `canAccess()`).
- **Описание:** Пользователь с view-only доступом (Shared) может навсегда конвертировать `.md` файл в редактируемый документ — установить `is_editable=true`, `editor_type='markdown'`. Владелец файла не уведомляется.
- **Решение:** Проверять `isOwnedBy` перед вызовом `promoteToDocument()`, или добавить параметр `$user` и проверку внутри метода.

### 7. `FileService` — 6 write-методов без проверки владения

- **Файл:** `backend/app/Services/FileService.php`
- **Методы:** `deleteFile()`, `cancelUpload()`, `pin()`, `unpin()`, `setFavorite()`, `moveToFolder()`, `setTags()`
- **Описание:** Все эти методы полагаются на то, что вызывающий контроллер уже проверил `isOwnedBy`/`canAccess`. Если другой код (job, command, future controller) вызовет их без проверки — защита обойдена. Defense-in-depth gap.
- **Решение:** Добавить проверку `if (!$file->isOwnedBy($user)) { throw ... }` в каждый write-метод (или через middleware).

### 8. `DocumentLockController::release()` — отсутствует проверка доступа к файлу

- **Файл:** `backend/app/Http/Controllers/Documents/DocumentLockController.php:107-118`
- **Код:** Не проверяет `canEditDocument()` или `canAccess()` перед вызовом `releaseLock()`.
- **Описание:** Любой аутентифицированный пользователь может вызывать `release()` для любого документа. Внутри `DocumentService::releaseLock()` есть проверка владельца лока, но файл-уровневая проверка доступа отсутствует.
- **Решение:** Добавить `if (!$this->documentService->canEditDocument($request->user(), $file)) { return $this->forbidden(); }`.

### 9. `InvitationService::send()` — `file_id` без проверки владения

- **Файл:** `backend/app/Services/InvitationService.php:20-32`
- **Код:** `$data['file_id']` сохраняется в приглашение без проверки, что отправитель владеет файлом.
- **Описание:** Любой пользователь может создать приглашение, ссылающееся на любой `file_id` в системе. При acceptance создаётся `FileUserAccess` для чужого файла.
- **Решение:** Добавить `'file_id' => 'exists:files,id'` в валидацию + проверку `$file->isOwnedBy($user)`.

---

## 🟡 MEDIUM

### 10. `SharingController::saveViaLink` — TOCTOU race condition

- **Файл:** `backend/app/Http/Controllers/Files/SharingController.php:405-424`
- **Описание:** Два параллельных запроса могут одновременно пройти `$existing === null` и оба создать `FileUserAccess`. Второй упадёт с 500 из-за unique constraint.
- **Решение:** Обернуть в `DB::transaction` с `lockForUpdate()`:
  ```php
  $existing = FileUserAccess::where(...)->lockForUpdate()->first();
  ```

### 11. `SharedFolderController::resolveSharedLink` — перманентный доступ

- **Файл:** `backend/app/Http/Controllers/SharedFolders/SharedFolderController.php:910-917`
- **Описание:** Любой аутентифицированный пользователь, перейдя по публичной ссылке на общую папку, навсегда получает доступ. Без срока действия, без отзыва при деактивации ссылки.
- **Решение:** Рассмотреть добавление `expires_at` на выдаваемый доступ, привязать к времени жизни ссылки.

### 12. `shared_folder_only` — файлы-сироты

- **Файлы:** `SharedFolderController.php:494,574`, `SharedFolderFileController.php:63-67`, `FileService.php:444,455,461`
- **Описание:** Файлы с `shared_folder_only=true` становятся невидимыми сиротами при удалении из последней общей папки. Пользователь не может их найти, хотя они существуют.
- **Решение:** Добавить автоматическую очистку: при `removeFile` из последней shared_folder установить `shared_folder_only=false`.

### 13. `DocumentService::acquireLock()` — TOCTOU (двойной захват блокировки)

- **Файл:** `backend/app/Services/DocumentService.php:209-233`
- **Описание:** Два пользователя могут одновременно пройти проверку `$existing === null || $existing->isExpired()` и оба получить `'acquired' => true`. ETag-контроль в `saveDocument()` ловит конфликт записи, но UX вводит в заблуждение.
- **Решение:** Использовать `updateOrCreate` с атомарным условием или добавить `lockForUpdate`.

### 14. `S3UrlService::contentRedirectUrl()`, `previewRedirectUrl()` — необработанные исключения S3

- **Файл:** `backend/app/Services/S3UrlService.php:136-148`
- **Описание:** Вызывают `Storage::disk('s3')->temporaryUrl()` без try/catch. В отличие от `tryTemporaryUrl()` (который есть в том же сервисе), исключение S3 пролетит в контроллер → HTTP 500.
- **Решение:** Заменить на `$this->tryTemporaryUrl($key, ...)` или обернуть в try/catch.

### 15. `CommentService::processMentions()` — упоминания без проверки доступа

- **Файл:** `backend/app/Services/CommentService.php:300-337`
- **Описание:** При упоминании пользователя в комментарии не проверяется, что упомянутый имеет доступ к файлу/папке. Push-уведомление содержит имя файла и deep link — утечка информации.
- **Решение:** Фильтровать `$mentionedUserIds` — оставлять только тех, у кого есть `canAccess` к целевому файлу.

### 16. `InvitationService::accept()` — доступ к pending-файлам чужого пользователя

- **Файл:** `backend/app/Services/InvitationService.php:38-77`
- **Описание:** При acceptance создаётся `FileUserAccess` для файлов, которые отправитель расшарил для `$invitation->target_email`. Если email не совпадает (см. CRITICAL #2), пользователь получает доступ к файлам, предназначенным другому.
- **Решение:** Исправление CRITICAL #2 автоматически закрывает эту проблему.

### 17. `Comment::$fillable` содержит `replies_count`, `deleted_at`

- **Файл:** `backend/app/Models/Comment.php:21,23`
- **Описание:** Системные поля не должны быть массово присваиваемыми.
- **Решение:** Удалить из `$fillable`.

### 18. `CommentThread::$fillable` содержит `comments_count`, `last_comment_id`, `status`

- **Файл:** `backend/app/Models/CommentThread.php:24-26`
- **Описание:** Счётчики и статус должны управляться системой.
- **Решение:** Удалить из `$fillable`.

### 19. `DocumentLock::$fillable` содержит `user_id`, `created_at`

- **Файл:** `backend/app/Models/DocumentLock.php:15-20`
- **Описание:** `user_id` и `created_at` не должны быть массово присваиваемыми.
- **Решение:** Удалить из `$fillable`.

---

## 🔵 LOW

### 20. `SharingController::disableLink` — проверка `created_by`

- **Файл:** `backend/app/Http/Controllers/Files/SharingController.php:313`
- **Описание:** Проверяет `$link->created_by`, а не `$link->file->isOwnedBy()`. Известное исключение из предыдущих аудитов. Работает корректно, т.к. `createLink` требует `isOwnedBy`.
- **Решение:** Добавить `|| $link->file->isOwnedBy($request->user())` как запасной вариант.

### 21. `UrlFileController::store` — отсутствует санитизация preview-данных

- **Файл:** `backend/app/Http/Controllers/Links/UrlFileController.php:36-43`
- **Описание:** `LinkPreviewService::fetch()` получает данные с внешнего URL. Поля `title`, `description`, `site_name`, `image_url` сохраняются без санитизации.
- **Решение:** Добавить trim, strip_tags, ограничение длины.

### 22. `FileService::createUrlFile()` — отсутствует валидация URL

- **Файл:** `backend/app/Services/FileService.php:381-413`
- **Описание:** URL сохраняется напрямую без проверки схемы. Потенциально `javascript:` или SSRF- payload.
- **Решение:** Валидировать URL схему.

### 23. `PasswordResetService::sendResetLink()` — сброс всех старых кодов

- **Файл:** `backend/app/Services/PasswordResetService.php:22-23`
- **Описание:** `PasswordResetCode::where('email', $email)->delete()` удаляет все существующие коды. DoS: злоумышленник, зная email, может бесконечно сбрасывать коды сброса пароля.
- **Решение:** Удалять только истёкшие коды, или ограничить частоту запросов.

### 24. `SupportAttachmentService::validateUserFiles()` — доверие MIME от клиента

- **Файл:** `backend/app/Services/SupportAttachmentService.php:26-40`
- **Описание:** MIME-тип от клиента не перепроверяется после загрузки на S3.
- **Решение:** Перепроверять MIME после загрузки через `$file->getMimeType()` на сервере.

### 25. Разные модели с `status`/`token` в $fillable

- **Файлы:** `File.php:27`, `FileVersion.php:23-24`, `ShareLink.php:19-20`, `SharedFolderLink.php:20,23`, `Invitation.php:16-21`, `ContactRequest.php:17`, `SupportTicket.php:16`, `SuggestionTicket.php:17`
- **Описание:** Системные поля (`status`, `token`, `is_active`) в `$fillable` — потенциальный риск при будущих изменениях.
- **Решение:** Удалить из `$fillable`.

---

## Сводка

| Severity | Всего | Проблемы |
|----------|-------|----------|
| **CRITICAL** | 3 | `User::is_superuser` fillable, `InvitationService::accept` без email, `reject` без авторизации |
| **HIGH** | 6 | `listLinks` canAccess, User fillable (plan/status/email), `promoteToDocument`, 6 write-методов без check, `releaseLock` без доступа, `send` без file_id |
| **MEDIUM** | 10 | TOCTOU saveViaLink, resolveSharedLink перманентный, shared_folder_only orphans, TOCTOU acquireLock, S3Url без try/catch, mentions без доступа, invitation accept chained, Comment/CommentThread/DocumentLock fillable |
| **LOW** | 6 | disableLink created_by, preview без санитизации, createUrlFile без валидации, PasswordReset DoS, MIME доверие, прочие fillable |

**Всего: 25 находок** (3 CRITICAL, 6 HIGH, 10 MEDIUM, 6 LOW)
