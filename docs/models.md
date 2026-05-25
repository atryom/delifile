# Модели и таблицы БД проекта DeliFile

Всего **44 таблицы**. Модели используют ULID в качестве первичных ключей (кроме `users`, `push_subscriptions`, `password_reset_codes` и системных таблиц Laravel).

---

## 1. Auth / Core

### `users` — `App\Models\User`
Пользователи системы.
| Поле | Тип | Назначение |
|------|-----|------------|
| id | bigint auto-increment | Первичный ключ |
| email | string, unique | Email для входа |
| phone | string, nullable | Телефон (легаси, теперь email) |
| name | string, nullable | Отображаемое имя |
| password | string (hashed) | Хэш пароля |
| email_verified_at | timestamp, nullable | Дата верификации email |
| email_verification_token | string(64), nullable | Токен верификации |
| email_verification_sent_at | timestamp, nullable | Когда отправлено письмо |
| email_verification_deadline_at | timestamp, nullable | Дедлайн верификации (24ч) |
| account_status | string(40) | `active`, `pending_email_verification`, `blocked_unverified_email` |
| plan | enum(TariffPlan) | Тариф: `free`, `silver`, `gold` |
| is_superuser | bool | Флаг администратора |
| notifications_enabled | bool | Вкл/выкл уведомления |
| notify_new_files | bool | Уведомлять о новых файлах |
| notify_contacts_added | bool | Уведомлять о добавлении контактов |
| allow_contacts_without_confirmation | bool | Авто-добавление контактов |
| auto_add_received_files | bool | Авто-принятие полученных файлов |

**Связи:** `files` (owner), `fileAccesses`, `contacts`, `activityLogs`, `folders`, `tags`, `deviceSessions`, `sentInvitations`, `pushSubscriptions`

### `password_reset_codes` — `App\Models\PasswordResetCode`
Коды для сброса пароля (2FA-стиль: 6-значный код + токен).
**Связи:** нет.

### `password_reset_tokens` — системная (Laravel)
Токены сброса пароля (legacy, теперь используется `password_reset_codes`).

### `personal_access_tokens` — системная (Laravel Sanctum)
Токены API-доступа (Sanctum).

### `device_sessions` — `App\Models\DeviceSession`
Активные сессии устройств пользователя.
| Поле | Тип | Назначение |
|------|-----|------------|
| user_id | FK→users | Владелец сессии |
| token_id | FK→personal_access_tokens, nullable | Привязанный токен |
| device_id | string(36), nullable | Идентификатор устройства (UUID клиента) |
| device_type | string(50), nullable | Тип: `web`, `mobile`, `desktop` |
| device_name | string | Название устройства |
| user_agent | string(500), nullable | User-Agent браузера |
| ip_address | string(45), nullable | IP-адрес |
| last_active_at | timestamp, nullable | Последняя активность |

**Связи:** `user` → User

### `sessions` — системная (Laravel)
PHP-сессии (для web-роутов).

---

## 2. File Space

### `files` — `App\Models\File` (SoftDeletes, HasUlids)
Файлы и URL-файлы. Центральная таблица системы.
| Поле | Тип | Назначение |
|------|-----|------------|
| id | ulid | Первичный ключ |
| owner_id | FK→users | Владелец |
| original_name | string(255) | Оригинальное имя файла |
| storage_key | string(500), nullable | Ключ в S3 (null для url-файлов) |
| thumbnail_key | string, nullable | Ключ миниатюры в S3 |
| size | bigint, default 0 | Размер в байтах |
| mime_type | string(100), nullable | MIME-тип |
| checksum | string(64), nullable | SHA-256 хэш |
| content_kind | string(20) | `binary_file` или `url_file` |
| link_url | string(2048), nullable | URL (если url-файл) |
| link_title | string(500), nullable | Заголовок страницы (OG) |
| link_description | text, nullable | Описание (OG) |
| link_image_url | string(2048), nullable | Превью (OG) |
| link_site_name | string(255), nullable | Имя сайта (OG) |
| link_fetched_at | timestamp, nullable | Когда получен OG |
| status | enum(FileStatus) | `uploading`, `available`, `processing`, `expired`, `deleted` |
| folder_id | FK→folders, nullable | Папка |
| shared_folder_only | bool | Файл только в общей папке (не в личных) |
| has_versions | bool | Есть версии |
| display_name | string(255), nullable | Отображаемое имя |
| is_editable | bool, default false | Флаг редактируемого документа |
| editor_type | string(50), nullable | Тип редактора: `markdown` |
| etag | string(255), nullable | ETag для оптимистичных блокировок |
| updated_by | FK→users, nullable | Кто последним обновил содержимое |
| width | unsigned int, nullable | Ширина (для изображений) |
| height | unsigned int, nullable | Высота (для изображений) |
| expires_at | timestamp, nullable | TTL (не используется) |
| deleted_at | timestamp, nullable | Soft delete |
| timestamps | created_at, updated_at | |

**Связи:** `owner` → User, `folder` → Folder, `accesses` → FileUserAccess, `shareLinks` → ShareLink, `activityLogs` → ActivityLog, `tags` ↔ Tag (pivot `file_tags`), `sharedFolderFiles` → SharedFolderFile, `versions` → FileVersion, `commentSettings` → FileCommentSettings, `updatedByUser` → User, `documentLock` → DocumentLock

### `file_versions` — `App\Models\FileVersion` (HasUlids)
Версии файла (для файлов с `has_versions = true`).
| Поле | Тип | Назначение |
|------|-----|------------|
| file_id | FK→files | Файл |
| version_number | int | Номер версии |
| version_label | string(50), nullable | Метка (например "v2.1") |
| comment | text, nullable | Комментарий к версии |
| storage_key | string(500) | Ключ в S3 |
| thumbnail_key | string(500), nullable | Миниатюра |
| original_name | string(255) | Имя файла версии |
| size | bigint | Размер |
| mime_type | string(100) | MIME-тип |
| is_active | bool | Активная версия (текущая) |
| status | string(20) | Статус загрузки |

**Связи:** `file` → File

### `file_user_access` — `App\Models\FileUserAccess` (HasUlids)
Связь пользователя с файлом: права доступа, избранное, закрепление.
| Поле | Тип | Назначение |
|------|-----|------------|
| file_id | FK→files | Файл |
| user_id | FK→users | Пользователь |
| contact_id | FK→contacts, nullable | Через какой контакт получен доступ |
| access_type | enum(AccessType) | `owner`, `shared`, `saved` |
| is_favorite | bool | В избранном |
| description | text, nullable | Описание (per-user) |
| pinned_at | timestamp, nullable | Закреплён |
| saved_at | timestamp, nullable | Сохранён (скопирован к себе) |
| folder_id | FK→folders, nullable | Папка (у получателя) |
| can_comment | bool, default true | Может комментировать |
| can_edit | bool, default false | Может редактировать Markdown-документ |
| unique | (file_id, user_id) | |

**Связи:** `file` → File, `user` → User, `contact` → Contact

### `document_locks` — `App\Models\DocumentLock` (без timestamps)
Блокировки документов для Markdown-редактора (pessimistic lock, PK=file_id).
| Поле | Тип | Назначение |
|------|-----|------------|
| file_id | string(26), PK, FK→files | Документ (один к одному) |
| user_id | FK→users | Кто захватил блокировку |
| expires_at | timestamp | Когда истекает блокировка |
| created_at | timestamp | Когда создана |

**Особенности:**
- Одна запись на документ (PK=file_id, один к одному)
- Блокировка истекает по `expires_at` (проверка `isExpired(): expires_at->isPast()`)
- Heartbeat продлевает `expires_at` (каждые 60 с)
- Takeover позволяет владельцу принудительно перехватить блокировку

**Связи:** `file` → File, `user` → User

### `folders` — `App\Models\Folder` (HasUlids)
Личные папки пользователя (иерархические).
| Поле | Тип | Назначение |
|------|-----|------------|
| id | ulid | Первичный ключ |
| user_id | FK→users | Владелец |
| parent_id | FK→folders, nullable | Родительская папка |
| name | string(100) | Имя |
| sort_order | int, nullable | Порядок сортировки |

**Связи:** `user` → User, `parent` → Folder (self), `children` → Folder (self), `files` → File, `userAccesses` → FileUserAccess, `commentSettings` → LocalFolderCommentSettings

### `tags` — `App\Models\Tag` (HasUlids)
Теги пользователя.
| unique | (user_id, name) |

**Связи:** `user` → User, `files` ↔ File (pivot `file_tags`)

### `file_tags` — Pivot (без модели)
Связь файлов с тегами.
| Поле | Тип |
|------|-----|
| user_id | FK→users |
| file_id | FK→files |
| tag_id | FK→tags |
| PK | (user_id, file_id, tag_id) |

---

## 3. Sharing

### `share_links` — `App\Models\ShareLink` (HasUlids)
Публичные ссылки на файлы.
| Поле | Тип | Назначение |
|------|-----|------------|
| file_id | FK→files | Файл |
| created_by | FK→users | Создатель |
| token | string(64), unique | Токен ссылки |
| status | enum(ShareLinkStatus) | `active`, `disabled`, `expired` |
| ttl_hours | smallint, default 12 | Время жизни (часов) |
| expires_at | timestamp, nullable | Дата истечения |
| allow_save | bool | Разрешено сохранять файл |

**Связи:** `file` → File, `creator` → User

### `shared_folders` — `App\Models\SharedFolder` (HasUlids)
Общие папки для совместной работы. Единая модель для всех папок пользователя (личные корневые помечаются флагом `is_personal_root`).
| Поле | Тип | Назначение |
|------|-----|------------|
| owner_id | FK→users | Владелец |
| parent_id | FK→shared_folders, nullable | Родительская папка (подпапки) |
| name | string(100) | Название |
| is_private | bool, default false | Приватная — скрыта от гостей родительской папки |
| is_personal_root | bool, default false | Корневая личная папка пользователя («Мои файлы») |
| sort_order | unsigned int, nullable | Порядок сортировки |

**Связи:** `owner` → User, `parent` → SharedFolder (self), `children` → SharedFolder (self), `accesses` → SharedFolderAccess, `links` → SharedFolderLink, `sharedFiles` → SharedFolderFile, `commentSettings` → SharedFolderCommentSettings

### `shared_folder_accesses` — `App\Models\SharedFolderAccess` (HasUlids)
Доступы пользователей/контактов к общей папке.
| Поле | Тип | Назначение |
|------|-----|------------|
| shared_folder_id | FK→shared_folders | Общая папка |
| user_id | FK→users, nullable | Пользователь |
| contact_id | ulid, nullable | Контакт |
| access_type | enum(SharedFolderAccessType) | `view` или `edit` |

**Связи:** `folder` → SharedFolder, `user` → User

### `shared_folder_links` — `App\Models\SharedFolderLink` (HasUlids)
Публичные ссылки на общие папки.
| Поле | Тип | Назначение |
|------|-----|------------|
| shared_folder_id | FK→shared_folders | Папка |
| created_by | FK→users | Создатель |
| token | string(64), unique | Токен |
| access_type | enum(SharedFolderAccessType) | `view` или `edit` |
| allow_save | bool | Разрешить сохранение |
| status | string(20) | `active` / `disabled` |
| ttl_hours | int, nullable |
| expires_at | timestamp, nullable |

**Связи:** `folder` → SharedFolder

### `shared_folder_files` — `App\Models\SharedFolderFile` (HasUlids)
Файлы, добавленные в общую папку.
| Поле | Тип | Назначение |
|------|-----|------------|
| shared_folder_id | FK→shared_folders | Папка |
| file_id | FK→files | Файл |
| added_by | FK→users, nullable | Кто добавил |
| is_private | bool, default false | Приватный — скрыт от гостей папки |
| unique | (shared_folder_id, file_id) |

**Связи:** `folder` → SharedFolder, `file` → File

---

## 4. Contacts

### `contacts` — `App\Models\Contact` (HasUlids)
Контакты пользователя (могут быть как зарегистрированными, так и нет).
| Поле | Тип | Назначение |
|------|-----|------------|
| user_id | FK→users | Владелец контакта |
| name | string(255) | Имя |
| email | string(255), nullable | Email |
| phone | string(20), nullable | Телефон |
| resolved_user_id | FK→users, nullable | Ссылка на зарегистрированного пользователя |
| unique | (user_id, phone) | (легаси) |

**Связи:** `owner` → User, `resolvedUser` → User

### `contact_requests` — `App\Models\ContactRequest` (HasUlids)
Запросы на добавление в контакты.
| unique | (requester_id, target_user_id) |

**Связи:** `requester` → User, `targetUser` → User, `contact` → Contact

### `contact_pending_shares` — `App\Models\ContactPendingShare` (HasUlids)
Файлы, ожидающие отправки контакту (пока контакт не зарегистрируется).
| unique | (contact_id, file_id) |

**Связи:** `contact` → Contact, `file` → File, `sender` → User

---

## 5. Invitations

### `invitations` — `App\Models\Invitation` (HasUlids)
Приглашения незарегистрированных пользователей по email.
| Поле | Тип | Назначение |
|------|-----|------------|
| sender_user_id | FK→users | Отправитель |
| target_email | string(255) | Email получателя |
| file_id | FK→files, nullable | Приглашаемый файл |
| token | string(64), unique | Токен приглашения |
| status | string(20) | `pending`, `accepted`, `rejected`, `cancelled` |
| accepted_by_user_id | FK→users, nullable | Кто принял |
| comment | string(1000), nullable | Комментарий |
| expires_at | timestamp, nullable | Срок (7 дней) |

**Связи:** `sender` → User, `acceptedBy` → User, `file` → File

---

## 6. Activity

### `activity_logs` — `App\Models\ActivityLog` (HasUlids, без timestamps)
Лента действий с файлами.
| Поле | Тип | Назначение |
|------|-----|------------|
| file_id | FK→files | Файл |
| user_id | FK→users | Кто совершил |
| action | enum(ActivityType) | `uploaded`, `downloaded`, `shared_to_contact`, и т.д. |
| meta | json, nullable | Доп. данные |
| created_at | timestamp | Когда (индексирован) |

**Связи:** `file` → File, `user` → User

---

## 7. Notifications

### `user_notifications` — `App\Models\UserNotification` (HasUlids)
Уведомления пользователя (внутренние, не Push API).
| Поле | Тип | Назначение |
|------|-----|------------|
| id | ulid | Первичный ключ |
| user_id | FK→users | Получатель |
| type | string(50), enum(NotificationType) | Тип: `admin_message`, `file_shared`, `folder_shared`, `contact_request`, `access_changed`, `file_expired` |
| title | string | Заголовок |
| body | text, nullable | Текст |
| data | json, nullable | Дополнительные данные |
| read_at | timestamp, nullable | Когда прочитано |
| timestamps | created_at, updated_at | |

**Индексы:** (user_id, created_at), (user_id, read_at)

**Связи:** `user` → User

### `device_push_tokens` — `App\Models\DevicePushToken`
Токены устройств для мобильных Push-уведомлений.
| Поле | Тип | Назначение |
|------|-----|------------|
| id | bigint auto-increment | Первичный ключ |
| user_id | FK→users | Владелец устройства |
| token | string(500) | Push-токен |
| platform | string(10) | `android` или `ios` |
| device_id | string(255), nullable | ID устройства |
| unique | (user_id, token) |

**Связи:** `user` → User

### `push_subscriptions` — `App\Models\PushSubscription`
Подписки браузеров на Push-уведомления (WebPush).
| unique | (user_id, endpoint_hash) |

**Связи:** `user` → User

---

## 8. Support

### `support_tickets` — `App\Models\SupportTicket` (HasUlids)
Тикеты поддержки.
| Поле | Тип | Назначение |
|------|-----|------------|
| user_id | FK→users | Автор |
| status | string(30) | `new`, `in_work`, `awaiting_confirmation`, `completed` |
| completion_reason | string(30), nullable | Причина закрытия |
| taken_at | timestamp, nullable | Взят в работу |
| awaiting_at | timestamp, nullable | Отправлен на подтверждение |
| confirmed_at | timestamp, nullable | Подтверждён |
| auto_closed_at | timestamp, nullable | Автоматически закрыт |
| completed_at | timestamp, nullable | Завершён |

**Связи:** `user` → User, `messages` → SupportMessage

### `support_messages` — `App\Models\SupportMessage` (HasUlids)
Сообщения в тикетах.
**Связи:** `ticket` → SupportTicket, `sender` → User, `attachments` → SupportAttachment

### `support_attachments` — `App\Models\SupportAttachment` (HasUlids)
Вложения сообщений тикетов.
**Связи:** `message` → SupportMessage

### `suggestion_tickets` — `App\Models\SuggestionTicket` (HasUlids)
Предложения пользователей.
**Связи:** `user` → User, `attachments` → SuggestionAttachment, `adminComments` → SuggestionAdminComment

### `suggestion_attachments` — `App\Models\SuggestionAttachment` (HasUlids)
Вложения предложений.
**Связи:** `suggestion` → SuggestionTicket

### `suggestion_admin_comments` — `App\Models\SuggestionAdminComment` (HasUlids)
Комментарии администраторов к предложениям.
**Связи:** `suggestion` → SuggestionTicket

---

## 9. Comments

### `comment_threads` — `App\Models\CommentThread` (HasUlids)
Треды комментариев, привязанные к объекту (файл, общая папка, локальная папка).
| Поле | Тип | Назначение |
|------|-----|------------|
| target_type | enum(CommentTargetType) | `file`, `shared_folder`, `local_folder` |
| target_id | string(26) | ID целевого объекта |
| scope | enum(CommentScope) | `shared` или `private` |
| owner_user_id | FK→users, nullable | Владелец треда |
| context_shared_folder_id | string(26), nullable | Общая папка (контекст) |
| created_by | FK→users | Создатель |
| last_comment_id | string(26), nullable | Последний комментарий |
| comments_count | int | Счётчик |
| status | string(10) | `active` |
| unique | (target_type, target_id, scope, owner_user_id) |

**Связи:** `comments` → Comment, `createdBy` → User, `owner` → User, `readRecord` → CommentRead

### `comments` — `App\Models\Comment` (HasUlids)
Комментарии в тредах (поддерживают вложенность и упоминания).
**Связи:** `thread` → CommentThread, `author` → User, `parent` → Comment (self), `replies` → Comment (self), `mentions` → CommentMention

### `comment_reads` — `App\Models\CommentRead` (HasUlids, без timestamps)
Отметки о прочтении тредов.
| unique | (thread_id, user_id) |

**Связи:** `thread` → CommentThread, `user` → User

### `comment_mentions` — `App\Models\CommentMention` (HasUlids, без timestamps)
Упоминания пользователей в комментариях.
**Связи:** `comment` → Comment, `mentionedUser` → User

### `comment_audit_log` — `App\Models\CommentAuditLog` (HasUlids, без timestamps)
Аудит изменений комментариев.
**Связи:** `actor` → User

### `file_comment_settings` — `App\Models\FileCommentSettings`
Настройки комментариев для файла.
| PK | file_id |
| Поле | Назначение |
|------|-----|
| shared_comments_enabled | bool |
| shared_comments_override | enum(SharedCommentOverride): `inherit`, `enabled`, `disabled` |
| private_comments_enabled | bool |
| mentions_enabled | bool |

**Связи:** `file` → File, `updatedBy` → User

### `shared_folder_comment_settings` — `App\Models\SharedFolderCommentSettings`
Настройки комментариев для общей папки.
| PK | shared_folder_id |
| Поле | Назначение |
|------|-----|
| shared_comments_mode | enum(SharedCommentMode): `enabled`, `disabled`, `inherit_for_items` |
| private_comments_enabled | bool |
| mentions_enabled | bool |

**Связи:** `sharedFolder` → SharedFolder, `updatedBy` → User

### `local_folder_comment_settings` — `App\Models\LocalFolderCommentSettings`
Настройки комментариев для локальной папки.
| PK | local_folder_id |
| Поле | Назначение |
|------|-----|
| private_comments_enabled | bool |

**Связи:** `folder` → Folder, `updatedBy` → User

---

## 10. Inbox

### `pending_received_files` — `App\Models\PendingReceivedFile` (HasUlids)
Файлы, отправленные пользователю, ожидающие принятия (если `auto_add_received_files = false`).
| unique | (file_id, recipient_user_id) |

**Связи:** `file` → File, `recipient` → User, `sender` → User

### `pending_received_shared_folders` — `App\Models\PendingReceivedSharedFolder` (HasUlids)
Общие папки, ожидающие принятия пользователем.
| unique | (shared_folder_id, recipient_user_id) |

**Связи:** `sharedFolder` → SharedFolder, `recipient` → User, `inviter` → User

---

## Системные таблицы (Laravel)

| Таблица | Назначение |
|---------|------------|
| `cache` | Кэш (драйвер database) |
| `cache_locks` | Блокировки кэша |
| `jobs` | Очередь задач |
| `job_batches` | Батчи задач |
| `failed_jobs` | Упавшие задачи |

---

## Сводка enum'ов

| Enum | Значения | Используется в |
|------|----------|----------------|
| `TariffPlan` | `free`, `silver`, `gold` | users.plan |
| `FileStatus` | `uploading`, `available`, `processing`, `expired`, `deleted` | files.status |
| `AccessType` | `owner`, `shared`, `saved` | file_user_access.access_type |
| `ShareLinkStatus` | `active`, `disabled`, `expired` | share_links.status |
| `SharedFolderAccessType` | `view`, `edit` | shared_folder_accesses.access_type, shared_folder_links.access_type |
| `ActivityType` | `uploaded`, `downloaded`, `shared_to_contact`, `share_revoked`, `link_created`, `link_disabled`, `pinned`, `unpinned`, `favorited`, `unfavorited`, `moved_to_folder`, `tag_updated`, `saved_by_recipient`, `deleted`, `file_received`, `saved_via_link` | activity_logs.action |
| `CommentTargetType` | `file`, `shared_folder`, `local_folder` | comment_threads.target_type |
| `CommentScope` | `shared`, `private` | comment_threads.scope |
| `SharedCommentMode` | `enabled`, `disabled`, `inherit_for_items` | shared_folder_comment_settings.shared_comments_mode |
| `SharedCommentOverride` | `inherit`, `enabled`, `disabled` | file_comment_settings.shared_comments_override |
| `EditorType` | `markdown` | files.editor_type |
| `NotificationType` | `admin_message`, `file_shared`, `folder_shared`, `contact_request`, `access_changed`, `file_expired` | user_notifications.type |
