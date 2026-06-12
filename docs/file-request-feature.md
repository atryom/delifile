# File Request Feature

## Описание

Функционал одноразового запроса файла: пользователь создаёт ссылку с описанием, отправляет её кому угодно (анонимно), получатель загружает файл через браузерную форму, после чего ссылка деактивируется, пользователь получает уведомление и принимает файл с правами владельца.

## Компоненты

### Backend

| Файл | Назначение |
|------|-----------|
| `database/migrations/2026_06_12_000001_create_file_requests_table.php` | Таблица `file_requests` |
| `app/Models/FileRequest.php` | Eloquent-модель |
| `app/Http/Controllers/Files/FileRequestController.php` | Контроллер (8 методов) |
| `app/Enums/NotificationType.php` | Добавлен `FileRequestFulfilled` |
| `app/Services/NotificationService.php` | Добавлен `notifyFileRequestFulfilled()` |

### Маршруты

**Публичные (без авторизации):**
- `GET /api/v1/file-requests/{token}/resolve` — получить детали запроса
- `POST /api/v1/file-requests/{token}/init-upload` — инициализировать загрузку
- `POST /api/v1/file-requests/{token}/complete-upload` — завершить загрузку

**Защищённые:**
- `POST /api/v1/file-requests` — создать запрос
- `GET /api/v1/file-requests` — список запросов
- `POST /api/v1/file-requests/{id}/cancel` — отменить
- `POST /api/v1/file-requests/{id}/accept` — принять (создаёт FileUserAccess Owner)
- `POST /api/v1/file-requests/{id}/reject` — отклонить (удаляет файл из S3)

### Frontend

| Файл | Назначение |
|------|-----------|
| `core/api/file-requests-api.service.ts` | API-сервис |
| `features/file-requests/pages/file-request-public/` | Публичная страница `/file-request/:token` |
| `features/file-requests/dialogs/create-file-request/` | Диалог создания запроса |
| `features/inbox/pages/inbox/inbox.component` | Обновлён — вкладка «Запросы» |
| `features/files/pages/file-list/file-list.component` | Кнопка «Запросить файл» |
| `features/folders/pages/folders-tree/folders-tree.component` | Кнопка «Запросить файл» + передаёт `currentSharedFolderId` |
| `app/app.routes.ts` | Добавлен маршрут `/file-request/:token` |

## Особенности реализации

- Файл создаётся под `owner_id` запрашивающего (квота считается его), но `FileUserAccess` не создаётся до принятия
- При принятии создаётся `FileUserAccess` с `access_type = Owner`
- При отклонении файл физически удаляется из S3 через `CleanOrphanedS3ObjectJob`
- Ссылка становится недоступной (статус `fulfilled`) сразу после загрузки
- Уведомления: in-app (DB) + Web Push + FCM для мобильных
- Тип уведомления: `file_request_fulfilled`, группа `access`
- Если запрос создан внутри папки, `folder_id` сохраняется в `file_requests`; при принятии файл попадает в эту папку (`file.folder_id` + `SharedFolderFile`)
- Публичная страница отображает логотип Delifile со ссылкой на сайт и футер «Присоединяйтесь к Delifile»
