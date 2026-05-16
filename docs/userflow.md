# UserFlow — DeliFile (FileSpace MVP)

**Стек:** Laravel 13 (Backend API) + Angular 21 (Frontend SPA)

---

## 1. Аутентификация и регистрация

### 1.1 Регистрация нового пользователя

```
/login → "Зарегистрироваться"
  → POST /api/v1/auth/register {email, password, name}
    ← Письмо с подтверждением email
    → Перенаправление на /login
    → Пользователь открывает письмо → GET /api/v1/auth/email/verify/{token}
      ← Редирект на SPA с ?email_verified=true/false
      → Если успех: статус active, можно входить
```

### 1.2 Вход в систему

```
/login → POST /api/v1/auth/login {email, password}
  ← Установка Sanctum cookie, возврат user + token
  → Перенаправление на /files
  ← Если статус blocked_unverified_email → /account-blocked
    → POST /api/v1/auth/email/resend-verification (повторная отправка)
```

### 1.3 Восстановление пароля

```
/login → "Забыли пароль?" → /forgot-password
  → POST /api/v1/auth/password/forgot {email}
    ← Письмо с кодом/токеном
  → /reset-password?token=xxx
    → POST /api/v1/auth/password/verify-reset-token {token/code}
    → POST /api/v1/auth/password/reset {token, password}
      ← Все сессии сброшены, редирект на /login
```

### 1.4 Управление сессиями

```
/settings/security → GET /api/v1/auth/sessions
  ← Список устройств (имя, IP, last active)
  → DELETE /api/v1/auth/sessions/{id} (завершить сессию)
  → POST /api/v1/auth/logout-all (завершить все сессии)
```

---

## 2. Управление файлами (ядро)

### 2.1 Просмотр списка файлов

```
/files → GET /api/v1/files?filter=mine|received|favorites|all
  ← Список файлов с метаданными
  → Фильтрация: search, tag_id, folder_id, content_kind, file_type_group
```

### 2.2 Загрузка файла (3-step direct-to-S3)

```
/files → кнопка "Загрузить"
  → POST /api/v1/files/init-upload {name, size, mime_type, ...}
    ← Создаётся запись file (status=uploading)
    ← Возвращается S3 presigned PUT URL
  → PUT <presigned-url> (прямая загрузка в S3)
    ← 200 OK
  → POST /api/v1/files/complete-upload {file_id}
    ← status=available, создаётся FileUserAccess (owner)
    ← Файл появляется в списке
```

### 2.3 Детальная карточка файла

```
/files/:id → GET /api/v1/files/{id}
  ← Метаданные, preview, размер, MIME, даты
  → Вкладки: информация, активность, доступ
```

### 2.4 Скачивание файла

```
/files/:id → кнопка "Скачать"
  → POST /api/v1/files/{id}/download
    ← Возвращается short-lived S3 signed URL
  → Редирект на S3 signed URL → скачивание
  ← Логируется ActivityType::downloaded
```

### 2.5 Закрепление (Pin/Unpin)

```
/files/:id → кнопка "Закрепить"
  → POST /api/v1/files/{id}/pin
    ← pinned_at устанавливается в FileUserAccess
  → POST /api/v1/files/{id}/unpin (открепить)
```

### 2.6 Избранное (Favorite/Unfavorite)

```
/files/:id → кнопка "В избранное"
  → POST /api/v1/files/{id}/favorite
  → POST /api/v1/files/{id}/unfavorite
```

### 2.7 Удаление файла

```
/files/:id → кнопка "Удалить"
  → DELETE /api/v1/files/{id}
    ← Владелец: soft-delete + S3 cleanup (по крону)
    ← Не-владелец: только detach access
```

### 2.8 Отмена загрузки

```
Во время загрузки → кнопка "Отменить"
  → POST /api/v1/files/{id}/cancel-upload
    ← status=deleted
```

### 2.9 Версионирование файлов

```
/files/:id → вкладка "Версии"
  → POST /api/v1/files/{id}/versions/init-upload {name, size, mime_type, ...}
    ← Создаётся FileVersion (status=uploading)
    ← Возвращается S3 presigned PUT URL
  → PUT <presigned-url> (прямая загрузка в S3)
    ← 200 OK
  → POST /api/v1/files/{id}/versions/complete-upload {version_id, thumbnail_key?}
    ← Новая версия активна
  → PATCH /api/v1/files/{id}/versions/{version_id} {comment, version_label}
    ← Обновление метаданных версии
  → POST /api/v1/files/{id}/versions/{version_id}/download
    ← S3 signed URL
  → PATCH /api/v1/files/{id}/display-name {display_name}
    ← Отображаемое имя файла обновлено
```

---

## 3. Организация файлов

### 3.1 Папки (Folders)

```
/folders → GET /api/v1/folders (плоский список)
/folders → GET /api/v1/folders/tree
  ← Иерархическое дерево папок
  → Создать: POST /api/v1/folders {name, parent_id}
  → Переименовать: PATCH /api/v1/folders/{id}
  → Удалить: DELETE /api/v1/folders/{id}
  → Переместить файл: POST /api/v1/files/{id}/move-folder {folder_id}
  → Очистить папку: POST /api/v1/files/{id}/clear-folder
```

### 3.2 Теги (Tags)

```
/tags → GET /api/v1/tags
  ← Список тегов с file_counts
  → Создать: POST /api/v1/tags {name}
  → Переименовать: PATCH /api/v1/tags/{id}
  → Удалить: DELETE /api/v1/tags/{id}
  → Назначить файлу: POST /api/v1/files/{id}/attach-tags {tag_ids}
  → Открепить: POST /api/v1/files/{id}/detach-tags {tag_ids}
  → Установить полностью: POST /api/v1/files/{id}/set-tags {tag_ids}
```

### 3.3 Поиск и фильтрация

```
/files → строка поиска
  → GET /api/v1/files?search=xxx&tag_id=...&folder_id=...&content_kind=...
```

---

## 4. Шеринг файлов

### 4.1 Шеринг с контактом

```
/files/:id → "Поделиться" → диалог выбора контакта
  → POST /api/v1/files/{id}/share-to-contact {contact_id}
    ← Если контакт зарегистрирован:
      → Создаётся FileUserAccess (shared) для получателя
      → Push-уведомление получателю
    ← Если контакт НЕ зарегистрирован:
      → Создаётся ContactPendingShare (очередь)
      → При регистрации/принятии инвайта файл доставится
  → Отозвать доступ: DELETE /api/v1/files/{id}/share-to-contact/{contact}
```

### 4.2 Создание публичной ссылки (Share Link)

```
/files/:id → "Создать ссылку"
  → POST /api/v1/files/{id}/create-link {ttl_hours, allow_save}
    ← Создаётся ShareLink с уникальным token
    ← URL: /link/{token}
  → GET /api/v1/files/{id}/links (список ссылок)
  → POST /api/v1/links/{id}/disable (отключить)
```

### 4.3 Просмотр через публичную ссылку (неавторизован)

```
/link/:token → POST /api/v1/links/{token}/resolve
  ← Метаданные файла, имя, размер, preview
  → Кнопка "Скачать":
    → POST /api/v1/links/{token}/download
      ← S3 signed URL
  → Кнопка "Сохранить" (если allow_save):
    → POST /api/v1/links/{token}/save (требует auth)
      ← Создаётся FileUserAccess (saved)
      ← Уведомление владельцу
```

---

## 5. Общие папки (Shared Folders)

### 5.1 Создание и просмотр общих папок

```
/shared-folders → "Создать папку"
  → POST /api/v1/shared-folders {name}
    ← Создаётся SharedFolder, владелец получает доступ
/shared-folders → GET /api/v1/shared-folders (список папок пользователя)
/shared-folders → GET /api/v1/shared-folders/all-flat (плоский список)
```

### 5.2 Управление доступом

```
/shared-folders/:id → "Доступ"
  → GET /api/v1/shared-folders/{id}/accesses
  → POST /api/v1/shared-folders/{id}/accesses {contact_id, access_type: view|edit}
  → DELETE /api/v1/shared-folders/{id}/accesses/{accessId}
```

### 5.3 Загрузка в общую папку

```
/shared-folders/:id → "Загрузить"
  → POST /api/v1/shared-folders/{id}/init-upload
    ← shared_folder_only=true
  → POST /api/v1/shared-folders/{id}/complete-upload
```

### 5.4 Добавление URL в общую папку

```
/shared-folders/:id → "Добавить ссылку"
  → POST /api/v1/shared-folders/{id}/url-file {url}
    ← Fetch Open Graph метаданных
    ← Создаётся url_file, добавляется в папку
```

### 5.5 Публичная ссылка на общую папку

```
/shared-folders/:id → "Создать ссылку"
  → POST /api/v1/shared-folders/{id}/links {access_type, ttl_hours}
    ← URL: /shared-link/{token}
  → /shared-link/:token → POST /api/v1/shared-links/{token}/resolve
    ← Если auth: автоматически выдаётся доступ
  → GET /api/v1/shared-links/{token}/files (публичный список файлов)
```

### 5.6 Управление подпапками

```
/shared-folders/:id → "Добавить подпапку"
  → POST /api/v1/shared-folders/{id}/subfolders {name}
    ← Создаётся вложенная SharedFolder
  → GET /api/v1/shared-folders/{id}/subfolders
    ← Список подпапок
```

### 5.7 Добавление/удаление существующего файла

```
Из файла → "Добавить в общую папку" (диалог)
  → POST /api/v1/shared-folders/{folder_id}/files/{file_id}
    ← Файл привязан к папке
/shared-folders/:id → удалить файл из папки
  → DELETE /api/v1/shared-folders/{id}/files/{file_id}
    ← Файл отвязан от папки
  → GET /api/v1/files/{id}/shared-folders
    ← Список общих папок файла
  → POST /api/v1/files/{id}/shared-folders {folder_ids}
    ← Обновить привязку к общим папкам
```

### 5.8 Выход из общей папки

```
/shared-folders/:id → "Покинуть папку"
  → DELETE /api/v1/shared-folders/{id}/leave
    ← Пользователь удалён из участников папки
```

### 5.9 Добавление в "Мои файлы"

```
Из общей папки → "Добавить в мои файлы"
  → POST /api/v1/files/{id}/add-to-my-files
    ← shared_folder_only=false, создаётся FileUserAccess
```

---

## 6. Контакты

### 6.1 Добавление контакта

```
/contacts → "Добавить"
  → POST /api/v1/contacts {name, email, phone}
    ← Если email/phone принадлежит зарегистрированному пользователю:
      → Создаётся ContactRequest получателю
    ← Если не зарегистрирован:
      → contact.resolved_user_id = null
/contacts → детальная карточка контакта
  → GET /api/v1/contacts/{id}
    ← Метаданные контакта
  → GET /api/v1/contacts/{id}/history
    ← История действий с контактом (шэринг, файлы)
  → DELETE /api/v1/contacts/{id}
    ← Контакт удалён
  → POST /api/v1/contacts/resolve
    ← Резолвинг контактов (связывание с зарегистрированными пользователями)
```

### 6.2 Импорт контактов

```
/contacts → "Импорт"
  → POST /api/v1/contacts/import [{name, email, phone}, ...] (до 500)
```

### 6.3 Запросы на добавление в контакты

```
/contacts → вкладка "Запросы"
  → GET /api/v1/contact-requests
  → POST /api/v1/contact-requests/{id}/accept
    ← resolved_user_id связывается, контакт активируется
  → POST /api/v1/contact-requests/{id}/reject
```

### 6.4 Приглашения (Invitations)

```
/contacts → "Пригласить" (для незарегистрированных)
  → POST /api/v1/invitations {email, file_id?, comment}
    ← Создаётся Invitation, отправляется InvitationMail
  → /invite/:token → GET /api/v1/invitations/{token}
    ← Информация о приглашении
  → POST /api/v1/invitations/{token}/accept (требует auth)
    ← Контакт резолвится, ContactPendingShare доставляются
  → POST /api/v1/invitations/{token}/reject
  → POST /api/v1/invitations/{id}/cancel (отозвать отправленное приглашение)
```

### 6.5 Входящие (Inbox)

```
/inbox → GET /api/v1/inbox/count
  ← Количество новых непринятых файлов и общих папок
/inbox → "Файлы"
  → GET /api/v1/inbox/files
    ← Список файлов, которыми поделились (ожидают принятия)
  → POST /api/v1/inbox/files/accept {file_ids}
    ← FileUserAccess создаются, файлы появляются в /files
  → POST /api/v1/inbox/files/reject {file_ids}
    ← Файлы отклонены
/inbox → "Общие папки"
  → GET /api/v1/inbox/shared-folders
    ← Список приглашений в общие папки
  → POST /api/v1/inbox/shared-folders/accept {folder_ids}
    ← Доступ к общей папке активирован
  → POST /api/v1/inbox/shared-folders/reject {folder_ids}
    ← Приглашение отклонено
```

---

## 7. URL-файлы (Link Preview)

### 7.1 Предпросмотр ссылки

```
/files → "Добавить ссылку"
  → POST /api/v1/links-preview {url}
    ← Open Graph метаданные (title, description, image, site_name)
```

### 7.2 Сохранение ссылки как файла

```
После предпросмотра → "Сохранить"
  → POST /api/v1/url-files {url, link_title?, folder_id?, tags?}
    ← Создаётся file с content_kind=url_file
    ← В списке отображается как карточка ссылки
```

---

## 8. Лента активности

### 8.1 Просмотр активности

```
/activity → GET /api/v1/activity
  ← Пагинированный список событий по всем файлам пользователя
  ← Типы: uploaded, downloaded, shared, pinned, favorited, deleted и т.д.
```

### 8.2 Активность по файлу

```
/files/:id → вкладка "Активность"
  → GET /api/v1/files/{id}/activity
    ← История действий с конкретным файлом
```

---

## 9. Тарифы и использование

### 9.1 Просмотр тарифов

```
/tariffs → GET /api/v1/tariffs
  ← Список планов: Free, Silver, Gold
  ← Параметры: лимит файла, хранилище, кол-во устройств
```

### 9.2 Использование

```
/tariffs → GET /api/v1/tariffs/usage
  ← Использовано storage, кол-во устройств, макс. размер файла
  ← Прогресс-бары использования
```

### 9.3 Запрос на смену тарифа

```
/tariffs → "Сменить тариф"
  → POST /api/v1/tariffs/request {plan_key}
    ← Отправляется запрос администратору (stub)
```

---

## 10. Поддержка и предложения

### 10.1 Тикеты поддержки

```
/support → "Создать тикет"
  → POST /api/v1/support/tickets {subject, body, attachments?}
    ← Создаётся SupportTicket (status=new)
  → GET /api/v1/support/tickets (список)
  → GET /api/v1/support/tickets/{id} (детали + сообщения)
  → POST /api/v1/support/tickets/{id}/messages {body, attachments?}
  → POST /api/v1/support/tickets/{id}/confirm (подтвердить решение)
  → POST /api/v1/support/tickets/{id}/mark-read
  → GET /api/v1/support/tickets/{id}/attachments/{attachmentId} (скачать вложение)
```

### 10.2 Предложения (Suggestion)

```
/support → вкладка "Предложения"
  → POST /api/v1/support/suggestions {body, attachments?}
    ← Создаётся SuggestionTicket (status=new)
  → GET /api/v1/support/suggestions (список предложений)
  → GET /api/v1/support/suggestions/{id} (детали предложения)
  → GET /api/v1/support/suggestions/{id}/attachments/{attachmentId} (скачать вложение)
```

---

## 11. Админ-панель

### 11.1 Статистика

```
/admin → GET /api/v1/admin/stats
  ← Всего пользователей, файлов, размер, pinned
```

### 11.2 Управление пользователями

```
/admin → список пользователей
  → GET /api/v1/admin/users
  → PATCH /api/v1/admin/users/{id}/plan {plan_key}
  → POST /api/v1/admin/users/{id}/block (заблокировать / разблокировать)
  → POST /api/v1/admin/users/{id}/reset-link (сгенерировать ссылку сброса пароля)
  → POST /api/v1/admin/users/{id}/reset-sessions (сбросить все сессии)
  → POST /api/v1/admin/users/{id}/notify {title, body} (отправить уведомление)
  → POST /api/v1/admin/notify-all {title, body} (уведомить всех пользователей)
```

### 11.3 Управление тикетами поддержки

```
/admin → "Тикеты"
  → GET /api/v1/admin/support/tickets
  → GET /api/v1/admin/support/tickets/{id}
  → POST /api/v1/admin/support/tickets/{id}/take (взять в работу)
  → POST /api/v1/admin/support/tickets/{id}/await-confirmation (отправить на подтверждение)
  → POST /api/v1/admin/support/tickets/{id}/messages (ответить)
  → POST /api/v1/admin/support/tickets/{id}/mark-read
```

### 11.4 Управление предложениями

```
/admin → "Предложения"
  → GET /api/v1/admin/suggestions
  → PATCH /api/v1/admin/suggestions/{id}/status (new/accepted)
  → POST /api/v1/admin/suggestions/{id}/comments (внутренний комментарий)
```

---

## 12. PWA и Push-уведомления

### 12.1 Установка PWA

```
Браузер → кнопка "Установить приложение" (PwaInstallService)
  ← PWA manifest + service worker
  ← Работает как нативное приложение
```

### 12.2 Web Share Target

```
/share-target (SPA страница, PWA Share Target)
Другое приложение → "Поделиться" → DeliFile
  → Принимает входящие файлы через Web Share Target API
  → POST /api/v1/files/init-upload (делегирование в стандартный флоу загрузки)
```

### 12.3 Push-уведомления

```
/settings/security → "Включить уведомления"
  → GET /api/v1/push/vapid-key (публичный VAPID ключ)
  → POST /api/v1/push/subscribe {endpoint, keys}
    ← Уведомления о шеринге, новых сообщениях поддержки и т.д.
  → DELETE /api/v1/push/unsubscribe
```

---

## 13. Настройки пользователя

### 13.1 Безопасность

```
/settings/security
  → POST /api/v1/auth/password/change {current_password, new_password}
  → POST /api/v1/auth/email/change {new_email}
  → PATCH /api/v1/user/settings {notifications_enabled, ...}
```

### 13.2 PIN-код (локальный, только устройство)

```
После логина → PIN-экран (локальный, не серверный)
  ← Хранится в localStorage/IndexedDB
  ← Разблокировка при повторном открытии SPA
```

---

## 14. Фоновые задачи (Scheduled Jobs)

| Job | Период | Действие |
|-----|--------|----------|
| `ExpireShareLinksJob` | Каждые 30 мин | Просроченные ссылки → expired |
| `CleanExpiredFilesJob` | Каждый час | Удаление истёкших файлов из S3 + БД |
| `auth:block-unverified` | Каждые 15 мин | Блокировка неподтверждённых email (>24ч) |
| `support:auto-close-tickets` | Каждый час | Автозакрытие зависших тикетов |

---

## 15. Комментарии и треды

### 15.1 Треды комментариев

```
/folders или /files/:id → вкладка "Комментарии"
  → GET /api/v1/comment-threads?target_type=file|shared_folder|local_folder&target_id=...&scope=private|shared
    ← Список тредов с последними комментариями
  → GET /api/v1/comment-threads/{threadId}?page=...&per_page=...
    ← Комментарии треда с пагинацией
  → POST /api/v1/comment-threads/{threadId}/read
    ← Отметить тред прочитанным
  → GET /api/v1/comment-threads/unread-counters {thread_ids}
    ← Счётчики непрочитанных по тредам
```

### 15.2 CRUD комментариев

```
Внутри треда → "Написать комментарий"
  → POST /api/v1/comments {thread_id, body, parent_comment_id?, mentions_json?}
    ← Создаётся Comment, replies_count обновляется
  → PATCH /api/v1/comments/{id} {body}
    ← Комментарий отредактирован
  → DELETE /api/v1/comments/{id}
    ← Комментарий помечен как удалённый
```

### 15.3 Настройки комментариев

```
Для файла:
  → GET /api/v1/files/{fileId}/comment-settings
    ← shared_comments_enabled, private_comments_enabled, mentions_enabled
  → PATCH /api/v1/files/{fileId}/comment-settings {settings}
    ← Обновление настроек

Для локальной папки:
  → PATCH /api/v1/local-folders/{folderId}/comment-settings

Для общей папки:
  → GET /api/v1/shared-folders/{folderId}/comment-settings
  → PATCH /api/v1/shared-folders/{folderId}/comment-settings
```

---

## Сводная диаграмма потоков пользователя

```
                    ┌─────────────────────┐
                    │    Гость (Guest)     │
                    └──────┬──────────────┘
                           │
              ┌────────────┼────────────┬─────────────────┐
              ▼            ▼            ▼                  ▼
         /register     /login     /link/:token     /shared-link/:token
              │            │            │                  │
              ▼            ▼            ▼                  ▼
     Регистрация    POST /login  Resolve link      Resolve shared
     + верификация  ────────►    + download        folder link
         email         │         + save (auth)     + browse files
                       │
              ┌────────┴──────────────┐
              ▼                       ▼
    /account-blocked           Аутентифицирован
    (email не верифицирован)        │
                                   │
               ┌──────────────┼──────────────────────────────────┐
               ▼              ▼                  ▼                ▼
         ┌──────────┐  ┌────────────┐  ┌──────────────┐  ┌─────────────────────┐
         │ /files    │  │  /inbox    │  │ /contacts    │  │ /shared-folders      │
         │ (главная) │  │ (входящие) │  │              │  │                     │
         └────┬─────┘  └─────┬──────┘  └──────┬───────┘  └──────────┬──────────┘
              │              │                │                     │
    ┌─────────┼────────┐    │     ┌───────────┼──────────┐  ┌───────┼──────┐
    ▼         ▼        ▼    ▼     ▼           ▼          ▼  ▼       ▼      ▼
   /files/:id  /folders  /tags  │  Создать/   Принять/   │  Соз-   Загру-  Ссылка
   (детали)    (дерево)  (теги) │  удалить    отклонить  │  дать   зить    на
        │                      │  контакт    инвайт     │  папку  файлы   папку
        │                      │                       │
   ┌────┼────┬─────┐          ▼                       ▼
   │    │    │     │    Контакты → приглашения     Подпапки
   ▼    ▼    ▼     ▼    Запросы в контакты         Добавить файл
  Шеринг Шеринг Pin /                               Выйти из папки
  → контакт → ссылка Favorite
                         Скачать / Удалить
                         Описание / Теги / Версии
                         Комментарии

             ┌──────────────────────────┐
             │ Доп. страницы             │
             ├──────────────────────────┤
             │ /activity    — лента     │
             │ /tariffs     — тарифы    │
             │ /support     — тикеты    │
             │ /settings    — настройки │
             │ /invite/:token — инвайт  │
             │ /admin       — админка  │
             │ /privacy     — политика │
             │ /share-target — PWA     │
             └──────────────────────────┘
```
