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
| POST | `/files/{id}/attach-tags` | auth | Прикрепить теги к файлу |
| POST | `/files/{id}/detach-tags` | auth | Открепить теги от файла |
| POST | `/files/{id}/clear-folder` | auth | Убрать файл из папки |

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

**Итого:** ~120 API-endpoint'ов, разделённых на 26 логических групп.
Авторизация: Laravel Sanctum (токены). Формат ответа: `{ result, message, data }`.
