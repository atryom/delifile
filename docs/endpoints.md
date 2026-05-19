# Полный список endpoint'ов проекта DeliFile

Все API-endpoint'ы имеют префикс `/api/v1`.

---

## 🔐 Auth

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| POST | `/auth/register` | public | Регистрация нового пользователя |
| POST | `/auth/login` | public | Вход, возвращает токен + пользователя |
| POST | `/auth/password/forgot` | public | Отправка письма сброса пароля |
| POST | `/auth/password/verify-reset-token` | public | Проверка токена сброса пароля |
| POST | `/auth/password/reset` | public | Смена пароля по подтверждённому токену |
| GET | `/auth/email/verify/{token}` | public | Верификация email (редирект на SPA) |
| POST | `/auth/logout` | auth | Выход (текущая сессия) |
| POST | `/auth/logout-all` | auth | Выход из всех сессий |
| GET | `/auth/me` | auth | Профиль текущего пользователя |
| GET | `/auth/sessions` | auth | Список активных сессий |
| DELETE | `/auth/sessions/{id}` | auth | Отзыв конкретной сессии |
| POST | `/auth/password/change` | auth | Смена текущего пароля |
| POST | `/auth/email/resend-verification` | auth | Повторная отправка верификации email |
| POST | `/auth/email/change` | auth | Смена email |

## 📦 Файлы

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| GET | `/files` | auth | Список файлов (фильтры: mine/received/favorites, пагинация, поиск) |
| POST | `/files/init-upload` | auth | Шаг 1: инициализация загрузки (проверка квоты, S3 presigned URL) |
| POST | `/files/complete-upload` | auth | Шаг 3: подтверждение завершения загрузки |
| GET | `/files/{id}` | auth | Детальная карточка файла |
| DELETE | `/files/{id}` | auth | Удалить файл (владелец — логическое удаление, нет — открепить) |
| POST | `/files/{id}/cancel-upload` | auth | Отменить незавершённую загрузку |
| POST | `/files/{id}/download` | auth | Сгенерировать подписанную ссылку на скачивание |
| POST | `/files/{id}/pin` | auth | Закрепить файл |
| POST | `/files/{id}/unpin` | auth | Открепить файл |
| POST | `/files/{id}/favorite` | auth | Добавить в избранное |
| POST | `/files/{id}/unfavorite` | auth | Убрать из избранного |
| POST | `/files/{id}/move-folder` | auth | Переместить в папку |
| POST | `/files/{id}/set-tags` | auth | Заменить все теги на файле |
| PATCH | `/files/{id}/description` | auth | Обновить описание (per-user) |
| GET | `/files/{id}/activity` | auth | История действий с файлом |
| GET | `/files/{id}/accesses` | auth | Список пользователей с доступом (только владелец) |
| PATCH | `/files/{id}/accesses/{accessId}` | auth | Обновить права доступа (can_edit) на shared-доступ (только владелец) |
| POST | `/files/{id}/attach-tags` | auth | Прикрепить теги к файлу |
| POST | `/files/{id}/detach-tags` | auth | Открепить теги от файла |
| POST | `/files/{id}/clear-folder` | auth | Убрать файл из папки |

### 📄 Файлы — Версионирование

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| POST | `/files/{id}/versions/init-upload` | auth | Шаг 1: инициализация загрузки новой версии |
| POST | `/files/{id}/versions/complete-upload` | auth | Шаг 2: подтверждение загрузки версии |
| PATCH | `/files/{id}/versions/{vid}` | auth | Обновить метаданные версии (label, comment) |
| POST | `/files/{id}/versions/{vid}/download` | auth | Скачать конкретную версию |
| PATCH | `/files/{id}/display-name` | auth | Обновить отображаемое имя файла |
| GET | `/files/{id}/content` | auth | Стабильный URL содержимого (редирект на presigned S3) |
| GET | `/files/{id}/preview` | auth | Стабильный URL превью (редирект на thumbnail/content) |

## 📝 Markdown-документы

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| POST | `/documents` | auth | Создать новый Markdown-документ |
| GET | `/documents/{id}` | auth | Получить содержимое документа + метаданные |
| PUT | `/documents/{id}` | auth | Сохранить документ (content + etag, проверка конфликтов) |

## 🔒 Блокировки документов

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| POST | `/documents/{id}/lock` | auth | Установить блокировку для редактирования |
| DELETE | `/documents/{id}/lock` | auth | Снять блокировку (идемпотентно) |
| POST | `/documents/{id}/lock/heartbeat` | auth | Продлить блокировку (TTL, каждые 60 с) |
| POST | `/documents/{id}/lock/takeover` | auth | Принудительно перехватить блокировку (только владелец) |

## 🖼️ Assets

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| GET | `/assets/images` | auth | Список доступных изображений (курсорная пагинация, поиск) |

## 🔗 URL-файлы

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| POST | `/links-preview` | auth | Получить превью URL (title, image, etc.) |
| POST | `/url-files` | auth | Создать URL-файл из ссылки |

## 🤝 Шеринг

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| POST | `/files/{id}/share-to-contact` | auth | Поделиться файлом с контактом |
| DELETE | `/files/{id}/share-to-contact/{contact}` | auth | Отозвать доступ контакта |
| POST | `/files/{id}/create-link` | auth | Создать публичную ссылку (с TTL) |
| GET | `/files/{id}/links` | auth | Список всех ссылок на файл |
| POST | `/links/{id}/disable` | auth | Деактивировать ссылку |

## 👥 Контакты

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| GET | `/contacts` | auth | Список контактов (поиск по имени, email, телефону) |
| POST | `/contacts` | auth | Создать контакт (с авто-разрешением + приглашением) |
| POST | `/contacts/import` | auth | Массовый импорт контактов (до 500) |
| POST | `/contacts/resolve` | auth | Переразрешить все неразрешённые контакты |
| GET | `/contacts/{id}` | auth | Детали контакта |
| GET | `/contacts/{id}/history` | auth | История обмена файлами с контактом |
| DELETE | `/contacts/{id}` | auth | Удалить контакт |

## 📁 Организация — Папки

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| GET | `/folders/tree` | auth | Дерево папок (иерархия) со счётчиками файлов |
| GET | `/folders` | auth | Плоский список папок |
| POST | `/folders` | auth | Создать папку |
| PATCH | `/folders/{id}` | auth | Обновить папку (переименовать, переместить) |
| DELETE | `/folders/{id}` | auth | Удалить папку (флаг force — открепить файлы) |

## 🏷️ Организация — Теги

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| GET | `/tags` | auth | Список тегов (поиск + счётчики файлов) |
| POST | `/tags` | auth | Создать тег |
| PATCH | `/tags/{id}` | auth | Переименовать тег |
| DELETE | `/tags/{id}` | auth | Удалить тег (открепляется от всех файлов) |

## 📨 Приглашения

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| GET | `/invitations/{token}` | public | Информация о приглашении (отправитель, email) |
| POST | `/invitations` | auth | Отправить приглашение незарегистрированному пользователю |
| POST | `/invitations/{token}/accept` | auth | Принять приглашение |
| POST | `/invitations/{token}/reject` | auth | Отклонить приглашение |
| POST | `/invitations/{id}/cancel` | auth | Отозвать отправленное приглашение (только отправитель) |

## 🔔 Push-уведомления

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| GET | `/push/vapid-key` | public | Получить VAPID public key |
| POST | `/push/subscribe` | auth | Сохранить подписку на push-уведомления |
| DELETE | `/push/unsubscribe` | auth | Удалить подписку на push-уведомления |

## 📊 Активность

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| GET | `/activity` | auth | Глобальная лента активности пользователя |

## 💰 Тарифы / Планы

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| GET | `/tariffs` | auth | Список доступных тарифов (free, silver, gold) с лимитами |
| GET | `/tariffs/usage` | auth | Использование vs лимиты текущего пользователя |
| POST | `/tariffs/request` | auth | Запрос на смену тарифа |

## ⚙️ Настройки пользователя

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| PATCH | `/user/settings` | auth | Обновить настройки уведомлений и контактов |

## 🤝 Запросы контактов

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| GET | `/contact-requests` | auth | Список входящих запросов контактов |
| POST | `/contact-requests/{id}/accept` | auth | Принять запрос контакта |
| POST | `/contact-requests/{id}/reject` | auth | Отклонить запрос контакта |

## 🆘 Поддержка — Тикеты

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| GET | `/support/tickets` | auth | Список тикетов пользователя (пагинация) |
| POST | `/support/tickets` | auth | Создать новый тикет с первым сообщением |
| GET | `/support/tickets/{id}` | auth | Детали тикета (сообщения, вложения) |
| POST | `/support/tickets/{id}/messages` | auth | Добавить сообщение в тикет |
| POST | `/support/tickets/{id}/confirm` | auth | Подтвердить закрытие тикета |
| POST | `/support/tickets/{id}/mark-read` | auth | Отметить сообщения администратора прочитанными |
| GET | `/support/tickets/{id}/attachments/{attachmentId}` | auth | Скачать вложение тикета |

## 💡 Поддержка — Предложения

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| GET | `/support/suggestions` | auth | Список предложений пользователя (пагинация) |
| POST | `/support/suggestions` | auth | Отправить новое предложение |
| GET | `/support/suggestions/{id}` | auth | Детали предложения |
| GET | `/support/suggestions/{id}/attachments/{attachmentId}` | auth | Скачать вложение предложения |

## 📂 Общие папки (Shared Folders)

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| GET | `/shared-folders` | auth | Список общих папок (свои + доступные) |
| POST | `/shared-folders` | auth | Создать новую общую папку |
| PATCH | `/shared-folders/{id}` | auth | Переименовать (только владелец) |
| DELETE | `/shared-folders/{id}` | auth | Удалить (только владелец) |
| GET | `/shared-folders/{id}/files` | auth | Файлы в общей папке (пагинация) |
| POST | `/shared-folders/{id}/init-upload` | auth | Начать загрузку в общую папку (нужно право edit) |
| POST | `/shared-folders/{id}/complete-upload` | auth | Завершить загрузку в общую папку |
| POST | `/shared-folders/{id}/url-file` | auth | Добавить URL-файл в общую папку |
| GET | `/shared-folders/{id}/accesses` | auth | Список доступов к папке (только владелец) |
| POST | `/shared-folders/{id}/accesses` | auth | Выдать доступ контакту (только владелец) |
| DELETE | `/shared-folders/{id}/accesses/{accessId}` | auth | Удалить доступ (только владелец) |
| GET | `/shared-folders/{id}/links` | auth | Список ссылок на папку (только владелец) |
| POST | `/shared-folders/{id}/links` | auth | Создать ссылку на папку (только владелец) |
| POST | `/shared-folders/{id}/links/{linkId}/disable` | auth | Отключить ссылку (только владелец) |
| GET | `/shared-folders/all-flat` | auth | Плоский список всех общих папок (без иерархии) |
| GET | `/shared-folders/{id}/subfolders` | auth | Список подпапок внутри общей папки |
| POST | `/shared-folders/{id}/subfolders` | auth | Создать подпапку в общей папке |
| POST | `/shared-folders/{id}/files/{fileId}` | auth | Добавить существующий файл в общую папку |
| DELETE | `/shared-folders/{id}/files/{fileId}` | auth | Удалить файл из общей папки |
| DELETE | `/shared-folders/{id}/leave` | auth | Покинуть общую папку (не владелец) |

## 🔄 Операции файл ↔ общая папка

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| POST | `/files/{id}/add-to-my-files` | auth | Перенести файл из общей папки в личные |
| POST | `/files/{id}/shared-folders` | auth | Синхронизировать членство файла в общих папках |
| GET | `/files/{id}/shared-folders` | auth | Получить членство файла в общих папках |

## 🔓 Публичные ссылки (без auth)

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| POST | `/links/{token}/resolve` | public | Получить метаданные по ссылке (preview URLs) |
| POST | `/links/{token}/download` | public | Скачать файл по ссылке (возвращает signed URL) |
| POST | `/links/{token}/save` | auth | Сохранить файл из публичной ссылки к себе |
| POST | `/shared-links/{token}/resolve` | public | Информация о расшаренной папке |
| GET | `/shared-links/{token}/files` | public | Файлы в расшаренной папке |

## 💬 Комментарии

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| GET | `/comment-threads` | auth | Список тредов комментариев для текущего пользователя |
| GET | `/comment-threads/unread-counters` | auth | Счётчики непрочитанных по каждому треду |
| GET | `/comment-threads/{threadId}` | auth | Детали треда с комментариями |
| POST | `/comment-threads/{threadId}/read` | auth | Отметить тред прочитанным |
| POST | `/comments` | auth | Создать новый комментарий |
| PATCH | `/comments/{id}` | auth | Редактировать комментарий |
| DELETE | `/comments/{id}` | auth | Удалить комментарий |
| GET | `/files/{fileId}/comment-settings` | auth | Настройки комментариев файла |
| PATCH | `/files/{fileId}/comment-settings` | auth | Обновить настройки комментариев файла |
| GET | `/shared-folders/{folderId}/comment-settings` | auth | Настройки комментариев общей папки |
| PATCH | `/shared-folders/{folderId}/comment-settings` | auth | Обновить настройки комментариев общей папки |
| PATCH | `/local-folders/{folderId}/comment-settings` | auth | Обновить настройки комментариев локальной папки |

## 📥 Входящие (Inbox)

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| GET | `/inbox/count` | auth | Количество ожидающих файлов и общих папок |
| GET | `/inbox/files` | auth | Список файлов, ожидающих принятия |
| POST | `/inbox/files/accept` | auth | Принять выбранные файлы (IDs в теле) |
| POST | `/inbox/files/reject` | auth | Отклонить выбранные файлы |
| GET | `/inbox/shared-folders` | auth | Список общих папок, ожидающих принятия |
| POST | `/inbox/shared-folders/accept` | auth | Принять выбранные общие папки |
| POST | `/inbox/shared-folders/reject` | auth | Отклонить выбранные общие папки |

## 🔧 Admin (Superuser)

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| GET | `/admin/stats` | superuser | Статистика платформы (пользователи, файлы, хранилище) |
| GET | `/admin/users` | superuser | Список всех пользователей |
| POST | `/admin/notify-all` | superuser | Push-уведомление всем пользователям |
| PATCH | `/admin/users/{id}/plan` | superuser | Сменить тариф пользователя |
| POST | `/admin/users/{id}/block` | superuser | Переключить блокировку пользователя |
| POST | `/admin/users/{id}/reset-link` | superuser | Сгенерировать ссылку сброса пароля |
| POST | `/admin/users/{id}/reset-sessions` | superuser | Отозвать все сессии пользователя |
| POST | `/admin/users/{id}/notify` | superuser | Push-уведомление конкретному пользователю |

## 🎫 Admin — Тикеты поддержки

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| GET | `/admin/support/tickets` | superuser | Все тикеты (с фильтром по статусу) |
| GET | `/admin/support/tickets/{id}` | superuser | Полная информация о тикете |
| POST | `/admin/support/tickets/{id}/take` | superuser | Взять тикет в работу |
| POST | `/admin/support/tickets/{id}/await-confirmation` | superuser | Отправить на подтверждение |
| POST | `/admin/support/tickets/{id}/messages` | superuser | Ответ администратора |
| POST | `/admin/support/tickets/{id}/mark-read` | superuser | Отметить сообщения пользователя прочитанными |
| GET | `/admin/support/tickets/{id}/attachments/{attachmentId}` | superuser | Скачать вложение тикета |

## 💡 Admin — Предложения

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| GET | `/admin/suggestions` | superuser | Все предложения (с фильтром по статусу) |
| GET | `/admin/suggestions/{id}` | superuser | Детали предложения с комментариями |
| PATCH | `/admin/suggestions/{id}/status` | superuser | Сменить статус предложения |
| POST | `/admin/suggestions/{id}/comments` | superuser | Добавить комментарий администратора |
| GET | `/admin/suggestions/{id}/attachments/{attachmentId}` | superuser | Скачать вложение предложения |

---

## Веб-роуты (HTML, не API)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/` | Лендинг / приветственная страница |
| GET | `/link/{token}` | Публичная SPA-страница с OG-мета-тегами для соцсетей |

---

## Плановые задачи (cron)

| Команда | Интервал | Описание |
|---------|----------|----------|
| `ExpireShareLinksJob` | каждые 30 мин | Удаление истёкших ссылок |
| `CleanExpiredFilesJob` | каждый час | Очистка записей об истёкших файлах |
| `auth:block-unverified` | каждые 15 мин | Блокировка неподтверждённых аккаунтов (24ч) |
| `support:auto-close-tickets` | каждый час | Автоматическое закрытие устаревших тикетов |

---

**Итого:** ~166 API-endpoint'ов, разделённых на 33 логические группы.
Авторизация: Laravel Sanctum (токены). Формат ответа: `{ result, message, data }`.
