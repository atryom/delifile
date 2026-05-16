# План Методики Испытания (ПМИ)

**Проект:** DeliFile (FileSpace MVP)
**Дата составления:** 16 мая 2026 г.
**Версия:** 1.0

---

## 1. Объект испытаний

**DeliFile** — облачный сервис для хранения файлов и быстрого обмена ими с другими пользователями.

### 1.1 Состав объекта испытаний

| Компонент | Технология | Описание |
|-----------|-----------|----------|
| Backend API | Laravel 13 | REST API, ~155 endpoint'ов, аутентификация Laravel Sanctum |
| Frontend SPA | Angular 21 | Progressive Web Application (PWA), Service Worker |
| Хранилище | S3-совместимое (MinIO / AWS S3) | Хранение файлов, presigned URL для загрузки/скачивания |
| База данных | PostgreSQL | Основное хранилище данных |
| Очереди / Фон | Laravel Queue / Cron | Фоновые задачи по расписанию |

### 1.2 Функциональные модули

| № | Модуль | Краткое описание |
|---|--------|-----------------|
| 1 | Аутентификация | Регистрация, вход, выход, восстановление пароля, верификация email, управление сессиями, блокировка |
| 2 | Файлы (ядро) | Загрузка (3-step direct-to-S3), скачивание, удаление, версионирование, pin/favorite, теги, описание |
| 3 | Шеринг | Share-to-contact, публичные ссылки, отзыв доступа, save via link |
| 4 | Общие папки | Создание, управление доступом (view/edit), подпапки, наследование прав, публичные ссылки, leave |
| 5 | Контакты | CRUD, импорт, разрешение, запросы, история, приглашения незарегистрированных |
| 6 | Комментарии | Треды (shared/private), создание/редактирование/удаление, настройки, unread counters, mentions |
| 7 | Inbox (Входящие) | Принятие/отклонение файлов и общих папок, счётчики |
| 8 | Поддержка | Тикеты (создание, сообщения, подтверждение), предложения, вложения |
| 9 | Администрирование | Статистика, управление пользователями (блокировка, план, сброс), тикеты, предложения, уведомления |
| 10 | Тарифы | Просмотр планов (Free/Silver/Gold), usage, запрос смены |
| 11 | URL-файлы | Предпросмотр ссылок (Open Graph), сохранение как файла |
| 12 | Активность | Лента действий пользователя, активность по файлу |
| 13 | PWA / Push | Установка приложения, Web Share Target, push-уведомления, VAPID |
| 14 | Настройки | Смена пароля/email, управление сессиями, приватность, уведомления |

### 1.3 Система прав доступа

Реализованы 4 модели доступа:

| Модель | Сущность | Типы доступа |
|--------|----------|-------------|
| `file_user_access` | Файл | `owner` / `shared` / `saved` |
| `shared_folder_accesses` | Общая папка | `view` / `edit` |
| `share_links` | Публичная ссылка на файл | `allow_save: bool` |
| `shared_folder_links` | Публичная ссылка на папку | `view` / `edit` + `allow_save` |

**Особенности:**
- Наследование прав shared folders по цепочке parent_id вверх
- Owner имеет абсолютный контроль (share, link, delete, manage accesses)
- Shared-пользователь не может пересылать файл
- Saved — неотзываемое владельцем сохранение
- 11 описанных сценариев прав (сценарии A–K)

### 1.4 Фоновые задачи

| Job | Период | Действие |
|-----|--------|----------|
| `ExpireShareLinksJob` | Каждые 30 мин | Просроченные ссылки → expired |
| `CleanExpiredFilesJob` | Каждый час | Удаление истёкших файлов из S3 + БД |
| `auth:block-unverified` | Каждые 15 мин | Блокировка неподтверждённых email (>24ч) |
| `support:auto-close-tickets` | Каждый час | Автозакрытие зависших тикетов |

---

## 2. Цель испытаний

1. **Оценка соответствия функциональным требованиям** — проверка полной реализации всех сценариев, описанных в `userflow.md` и `usermanual.md`.
2. **Верификация API** — проверка корректности всех ~155 API-эндпоинтов (статусы ответов, коды ошибок, права доступа, форматы данных).
3. **Проверка системы прав доступа** — валидация матрицы прав (permission.md) на всех 11 сценариях (A–K).
4. **Оценка стабильности и безопасности** — изоляция данных между пользователями, аутентификация, обработка ошибок, валидация входных данных.
5. **Ввод в эксплуатацию** — подтверждение готовности системы к промышленной эксплуатации.

---

## 3. Требования к программе

### 3.1 Функциональные требования

| ID | Требование | Критерий |
|----|-----------|----------|
| F-01 | Регистрация пользователя с верификацией email | Пользователь создаётся, письмо отправляется, верификация по токену, блокировка через 24ч |
| F-02 | Вход/выход из системы | Sanctum-токен, управление сессиями, logout-all |
| F-03 | Восстановление пароля | Forgot → код/токен → сброс, сброс всех сессий |
| F-04 | Загрузка файла (3-step) | Init-upload (presigned URL) → PUT to S3 → complete-upload |
| F-05 | Скачивание файла | Signed URL, короткоживущая, логирование в Activity |
| F-06 | Версионирование файлов | init/complete/update/download версии, display-name |
| F-07 | Pin/Favorite | Переключение статуса, pin конвертирует Shared → Saved |
| F-08 | Шеринг с контактом | Создание FileUserAccess (shared), push-уведомление, отзыв |
| F-09 | Публичная ссылка на файл | Create/resolve/download/save, TTL, disable |
| F-10 | Общие папки | CRUD, доступы (view/edit), подпапки, наследование прав, публичная ссылка, leave |
| F-11 | Контакты | CRUD, импорт (до 500), запросы (accept/reject), приглашения, история |
| F-12 | Комментарии | Треды shared/private, создание/редактирование/удаление, reply, unread, mentions |
| F-13 | Inbox | Просмотр/принятие/отклонение полученных файлов и общих папок |
| F-14 | Поддержка | Тикеты (new → in_progress → awaiting_confirmation → completed), предложения |
| F-15 | URL-файлы | Preview Open Graph, сохранение как файл (content_kind=url_file) |
| F-16 | Тарифы | Free/Silver/Gold, проверка лимитов при загрузке, usage |
| F-17 | PWA | Установка, Service Worker, Share Target, VAPID push |
| F-18 | Администрирование | Статистика, управление пользователями, тикетами, предложениями, массовые уведомления |

### 3.2 Требования к системе прав

| ID | Требование | Критерий |
|----|-----------|----------|
| P-01 | Owner: полный контроль | share, link, delete, manage accesses, versioning, display-name |
| P-02 | Shared: только просмотр/скачивание/комментирование/теги/fav/pin | Без права пересылать |
| P-03 | Saved: файл навсегда сохранён | Owner не может удалить пока есть Saved |
| P-04 | Shared folder view: R/O | Наследуется на все подпапки |
| P-05 | Shared folder edit: CRUD файлов, подпапки | Без переименования/удаления папки |
| P-06 | Наследование прав shared folders | Только вверх (additive), restrict не применяется |
| P-07 | Публичная ссылка: auth не требуется для resolve/download | Сохранение требует auth |
| P-08 | Публичная ссылка на папку: авто-грант доступа auth-пользователю | Создание SharedFolderAccess |

### 3.3 Нефункциональные требования

| ID | Требование | Критерий |
|----|-----------|----------|
| N-01 | Изоляция данных пользователей | Пользователь видит только свои файлы и расшаренные ему |
| N-02 | Защита неавторизованного доступа | 401/403 для защищённых endpoint'ов |
| N-03 | Валидация входных данных | 422 для некорректных данных |
| N-04 | Обработка ошибок | Единый формат ответа `{ result, message, data }` |
| N-05 | Лимиты тарифов | Проверка max file size и storage quota при загрузке |
| N-06 | Квоты | Не более 500 контактов при импорте |
| N-07 | TTL для публичных ссылок | Автоматическое истечение (ExpireShareLinksJob) |
| N-08 | Очистка удалённых файлов | CleanExpiredFilesJob (каждый час) |

---

## 4. Требования к программной документации

| Документ | Назначение | Статус |
|----------|-----------|--------|
| `docs/userflow.md` | Описание потоков пользователя по всем модулям | ✅ |
| `docs/usermanual.md` | Руководство пользователя (17 разделов) | ✅ |
| `docs/endpoints.md` | Полный список API-эндпоинтов (~155 шт.) | ✅ |
| `docs/permission.md` | Матрица прав доступа, сценарии A–K | ✅ |
| `docs/tests.md` | Сводный отчёт по тестированию (866 тестов) | ✅ |
| `docs/pmt.md` | План методики испытания (данный документ) | ✅ |

Все документы должны поддерживаться в актуальном состоянии при изменении функциональности.

---

## 5. Средства и порядок испытаний

### 5.1 Тестовые среды

| Среда | Назначение | Конфигурация |
|-------|-----------|-------------|
| Разработка (local) | Модульное тестирование | PHP 8.3, Node 22, SQLite, MinIO |
| Staging | Интеграционное тестирование | PostgreSQL, MinIO/AWS S3 |
| Production | Приёмочное тестирование | Полная инфраструктура |

### 5.2 Инструменты тестирования

| Компонент | Инструмент | Назначение |
|-----------|-----------|-----------|
| Backend (Laravel) | PHPUnit 11 | Модульные и интеграционные тесты API |
| Backend (Laravel) | RefreshDatabase | Сброс БД между тестами |
| Backend (Laravel) | Storage::fake() | Эмуляция S3 |
| Backend (Laravel) | Http::fake() | Эмуляция HTTP-запросов (Open Graph) |
| Frontend (Angular) | Karma + Jasmine | Модульные тесты компонентов и сервисов |
| Frontend (Angular) | HttpClientTestingController | Перехват HTTP-запросов |

### 5.3 Порядок проведения испытаний

1. **Модульное тестирование** (Unit) — изолированная проверка сервисов, компонентов и утилит
2. **Интеграционное тестирование** (Integration) — проверка API-эндпоинтов с БД и внешними сервисами
3. **Функциональное тестирование** — проверка соответствия userflow.md, сквозные сценарии
4. **Тестирование прав доступа** — проверка всех сценариев permission.md
5. **Регрессионное тестирование** — полный прогон после изменений

### 5.4 Критерии прохождения

- Все тесты выполнены без ошибок (OK/зелёный)
- Код ошибок HTTP: 200/201 для успешных запросов, 4xx для ожидаемых ошибок
- Ответы соответствуют структуре `{ result, message, data }`

---

## 6. Методы испытаний

### 6.1 Модуль «Аутентификация»

Всего тестов: **64** (Frontend 33 + Backend 31)

| № | Метод проверки | Входные данные | Ожидаемый результат | Кол-во тестов |
|---|---------------|----------------|-------------------|:------------:|
| 1.1 | Регистрация с валидными данными | email, password, name | 201, user создан, статус pending_email_verification | 5 |
| 1.2 | Регистрация с дублирующим email | email существующего пользователя | 422 VALIDATION_ERROR | 1 |
| 1.3 | Регистрация с коротким паролем | password < 8 символов | 422 | 1 |
| 1.4 | Регистрация без password_confirmation | email, password | 422 | 1 |
| 1.5 | Вход с корректными данными | email + password | 200, token + user | 5 |
| 1.6 | Вход с неверным паролем | email + wrong password | 401 INVALID_CREDENTIALS | 1 |
| 1.7 | Вход с несуществующим email | nonexistent@email | 401 | 1 |
| 1.8 | Вход заблокированного пользователя | blocked email + password | 200 (ограниченный доступ) | 1 |
| 1.9 | Валидация формы логина | пустые поля | 422 | 1 |
| 1.10 | Выход (logout) | authenticated | 200, токен удалён | 1 |
| 1.11 | Выход из всех сессий | authenticated, 2 токена | 200, все токены удалены | 1 |
| 1.12 | Список сессий | authenticated | 200, структура items | 1 |
| 1.13 | Удаление сессии | DELETE /sessions/{id} | 200 | 1 |
| 1.14 | Удаление несуществующей сессии | DELETE /sessions/nonexistent | 404 | 1 |
| 1.15 | GET /auth/me | authenticated | 200, email совпадает | 2 |
| 1.16 | GET /auth/me без auth | unauthenticated | 401 | 1 |
| 1.17 | Восстановление пароля (forgot) | existing email | 200 success | 2 |
| 1.18 | Верификация токена сброса | valid token | 200 success | 1 |
| 1.19 | Сброс пароля | valid token + new password | 200 success | 1 |
| 1.20 | Сброс пароля с невалидным токеном | invalid token | 422 INVALID_RESET_TOKEN | 1 |
| 1.21 | Смена пароля | current_password + new | 200 success | 1 |
| 1.22 | Смена пароля с неверным текущим | wrong current_password | 422 WRONG_PASSWORD | 1 |
| 1.23 | Смена пароля без auth | unauthenticated | 401 | 1 |
| 1.24 | Верификация email | token | 302 redirect на SPA | 1 |
| 1.25 | Повторная отправка верификации | unverified | 200 | 1 |
| 1.26 | Повторная отправка для verified | verified | 422 EMAIL_ALREADY_VERIFIED | 1 |
| 1.27 | Смена email | new email | 200, email обновлён | 1 |
| 1.28 | Смена email на занятый | duplicate email | 422 | 1 |
| 1.29 | Frontend: форма регистрации | данные формы | валидация, вызов API, navigate | 9 |
| 1.30 | Frontend: форма логина | данные формы | валидация, вызов API, navigate | 10 |
| 1.31 | Frontend: восстановление пароля | email/code/password | шаги email→code→password→done | 13 |
| 1.32 | Frontend: AuthStateService | user/token | сигналы isAuthenticated, isBlocked, isSuperUser | 10 |
| 1.33 | Frontend: authGuard/guestGuard/adminGuard | auth state | редирект / allow | 8 |
| 1.34 | Frontend: PIN-setup | PIN 4-6 цифр | localStorage + navigate | 6 |

### 6.2 Модуль «Файлы»

Всего тестов: **143** (Frontend 93 + Backend 50)

| № | Метод проверки | Входные данные | Ожидаемый результат | Кол-во тестов |
|---|---------------|----------------|-------------------|:------------:|
| 2.1 | Список файлов с фильтрацией | filter=mine|received|favorites | 200, items + pagination | 5 |
| 2.2 | Поиск файлов | search=unique | 200, count=1 | 1 |
| 2.3 | Пагинация файлов | per_page=10&page=1 | 200, count=10, total=25 | 1 |
| 2.4 | Просмотр файла (owner) | GET /files/{id} | 200 | 2 |
| 2.5 | Просмотр файла (shared) | GET /files/{id} | 200 | 1 |
| 2.6 | Просмотр без доступа | other user | 403 | 1 |
| 2.7 | Просмотр несуществующего файла | nonexistent | 404 | 1 |
| 2.8 | Просмотр без auth | unauthenticated | 401 | 1 |
| 2.9 | Init upload (в пределах квоты) | file metadata | 201, file + upload_url | 1 |
| 2.10 | Init upload (превышение max file size) | size=999999999999 | 422 VALIDATION_ERROR | 1 |
| 2.11 | Init upload (превышение storage quota) | >500MB used | 422 STORAGE_LIMIT_EXCEEDED | 1 |
| 2.12 | Complete upload | file_id | 200, status=available | 1 |
| 2.13 | Complete upload чужого файла | other owner | 403 | 1 |
| 2.14 | Cancel upload | file_id | 200 | 1 |
| 2.15 | Скачивание файла | POST /files/{id}/download | 200, url + expires_in | 1 |
| 2.16 | Скачивание недоступного файла | status=uploading | 422 FILE_NOT_AVAILABLE | 1 |
| 2.17 | Скачивание без доступа | other | 403 | 1 |
| 2.18 | Pin/Unpin файла | POST pin/unpin | 200 | 2 |
| 2.19 | Favorite/Unfavorite | POST fav/unfav | 200 | 2 |
| 2.20 | Move to folder | folder_id | 200 | 1 |
| 2.21 | Clear folder | folder_id=null | 200 | 1 |
| 2.22 | Set tags | tag_ids[] | 200 | 1 |
| 2.23 | Update description | description text | 200 | 1 |
| 2.24 | Activity по файлу | GET /files/{id}/activity | 200, items | 1 |
| 2.25 | Accesses list (owner) | GET /files/{id}/accesses | 200, items | 1 |
| 2.26 | Accesses list (non-owner) | other | 404 | 1 |
| 2.27 | Удаление файла (owner) | DELETE | 200, soft delete | 1 |
| 2.28 | Открепление (shared) | DELETE | 200, access удалён | 1 |
| 2.29 | Удаление без доступа | other | 404 | 1 |
| 2.30 | **Версионирование (17 тестов)** | | | 17 |
| 2.30.1 | Init upload версии (owner) | file metadata | 201 | 1 |
| 2.30.2 | Init upload версии (not owner) | other | 404 | 1 |
| 2.30.3 | Init upload для url_file | url_file | 422 NOT_SUPPORTED | 1 |
| 2.30.4 | Complete upload версии | version_id | 200 | 1 |
| 2.30.5 | Update version metadata | label + comment | 200, данные в БД | 1 |
| 2.30.6 | Update display name | display_name | 200 | 1 |
| 2.30.7 | Download version (owner) | version_id | 200, url | 1 |
| 2.30.8 | Download version (с доступом) | shared user | 200 | 1 |
| 2.30.9 | Download version (без доступа) | other | 404 | 1 |
| 2.30.10 | Download несуществующей версии | nonexistent | 404 | 1 |
| 2.30.11 | Download uploading version | status=uploading | 404 | 1 |
| 2.31 | Frontend: file-list (загрузка, превью, URL) | компонент | создание, валидация, upload lifecycle | 23 |
| 2.32 | Frontend: file-detail (27 тестов) | компонент | просмотр, fav, pin, теги, версии, диалоги | 27 |
| 2.33 | Frontend: FileUploadService | файл 4 байта | init→upload→complete lifecycle | 6 |
| 2.34 | Frontend: PublicLinkComponent | token | resolve, download, save | 11 |
| 2.35 | Frontend: CreateLinkDialog | ttl_hours | создание, копирование ссылки | 8 |
| 2.36 | Frontend: AddVersionDialog | fileId, mimeType | upload version lifecycle | 8 |
| 2.37 | Frontend: AddToSharedFolderDialog | fileId | загрузка папок, toggle, save | 5 |
| 2.38 | Frontend: ShareContactDialog | fileId | выбор контакта, submit | 4 |

### 6.3 Модуль «Шеринг»

Всего тестов: **28** (Frontend 8 + Backend 20)

| № | Метод проверки | Входные данные | Ожидаемый результат | Кол-во тестов |
|---|---------------|----------------|-------------------|:------------:|
| 3.1 | Share-to-contact (resolved) | contact_id | 200, FileUserAccess created | 1 |
| 3.2 | Revoke contact access | DELETE | 200, FileUserAccess deleted | 1 |
| 3.3 | Non-owner share | other user | 404 | 1 |
| 3.4 | Create share link | ttl_hours=24 | 201, link created | 1 |
| 3.5 | List links (owner) | GET /links | 200 | 1 |
| 3.6 | Disable link | POST /disable | 200, статус disabled | 1 |
| 3.7 | Resolve public link | token | 200, file + link info | 2 |
| 3.8 | Resolve disabled/expired link | disabled/expired token | 404 LINK_INVALID | 2 |
| 3.9 | Download via link | token | 200, url + expires_in | 1 |
| 3.10 | Download via invalid link | bad token | 404 | 1 |
| 3.11 | Save via link (auth) | authenticated user | 200 | 1 |
| 3.12 | Save via link (unauth) | unauthenticated | 401 | 1 |
| 3.13 | Save own file via link | owner | 422 OWN_FILE | 1 |
| 3.14 | Save without allow_save | allow_save=false | 403 SAVE_NOT_ALLOWED | 1 |
| 3.15 | Save already saved file | already has access | 422 ALREADY_SAVED | 1 |
| 3.16 | Frontend: PublicLinkComponent (11 тестов) | token | resolve, download, save, error states | 11 |
| 3.17 | Frontend: CreateLinkDialog (8 тестов) | fileId | create, copy, validation | 8 |

### 6.4 Модуль «Общие папки»

Всего тестов: **99** (Frontend 41 + Backend 58)

| № | Метод проверки | Входные данные | Ожидаемый результат | Кол-во тестов |
|---|---------------|----------------|-------------------|:------------:|
| 4.1 | Список общих папок | GET | 200, items | 1 |
| 4.2 | Создание общей папки | POST { name } | 201, is_owner=true | 1 |
| 4.3 | Переименование (owner) | PATCH { name } | 200 | 1 |
| 4.4 | Переименование (non-owner) | other | 403 | 1 |
| 4.5 | Удаление (owner) | DELETE | 200, БД очищена | 1 |
| 4.6 | Удаление (non-owner) | other | 403 | 1 |
| 4.7 | Создание подпапки (owner) | POST subfolders | 201 | 1 |
| 4.8 | Создание подпапки (edit) | editor | 201 | 1 |
| 4.9 | Создание подпапки (view) | viewer | 403 | 1 |
| 4.10 | Список доступов (owner) | GET accesses | 200 | 1 |
| 4.11 | Список доступов (non-owner) | other | 403 | 1 |
| 4.12 | Добавление доступа | contact_id, access_type | 201 | 1 |
| 4.13 | Добавление дублирующегося доступа | duplicate | 422 DUPLICATE_ACCESS | 1 |
| 4.14 | Удаление доступа | DELETE accesses/{id} | 200 | 1 |
| 4.15 | Создание публичной ссылки (owner) | access_type, ttl_hours | 201 | 1 |
| 4.16 | Создание ссылки (non-owner) | other | 403 | 1 |
| 4.17 | Отключение ссылки (owner) | POST disable | 200, status=disabled | 1 |
| 4.18 | Leave (member) | DELETE leave | 200 | 1 |
| 4.19 | Leave (owner) | owner | 422 OWNER_CANNOT_LEAVE | 1 |
| 4.20 | Resolve shared link (public) | token | 200 | 1 |
| 4.21 | Resolve expired shared link | expired | 410 LINK_INVALID | 1 |
| 4.22 | Public files via shared link | token | 200, items + pagination | 1 |
| 4.23 | All-flat список | GET /all-flat | 200 | 1 |
| 4.24 | Список файлов в папке (member) | GET files | 200 | 1 |
| 4.25 | Список файлов (non-member) | other | 403 | 1 |
| 4.26 | Init upload (edit) | file metadata | 201 | 1 |
| 4.27 | Init upload (view) | viewer | 403 | 1 |
| 4.28 | Complete upload (owner/edit) | file_id | 200 | 2 |
| 4.29 | Complete upload (view/non-member) | viewer/other | 403 | 2 |
| 4.30 | Add URL file (edit) | url | 201 | 1 |
| 4.31 | Add URL file invalid url | bad url | 422 | 1 |
| 4.32 | Add file to folder (edit) | POST files/{id} | 200 | 1 |
| 4.33 | Add file to folder (view) | viewer | 403 | 1 |
| 4.34 | Remove file from folder (edit/owner) | DELETE | 200 | 2 |
| 4.35 | Remove file (view) | viewer | 403 | 1 |
| 4.36 | Add to my files (shared_folder_only) | POST | 200, флаг сброшен | 1 |
| 4.37 | Add to my files (not shared_folder_only) | normal file | 422 ALREADY_IN_MY_FILES | 1 |
| 4.38 | Add to my files (other's file) | other's file | 403 | 1 |
| 4.39 | Sync shared folders | folder_ids[] | 200 | 1 |
| 4.40 | Sync для shared_folder_only | shared_folder_only=true | 403 | 1 |
| 4.41 | Sync only editable folders | editor | игнорирование чужих папок | 1 |
| 4.42 | Наследование прав (сценарии E–K) | parent_id chain | корректный доступ через ancestry | в составе 4.1–4.41 |
| 4.43 | Frontend: SharedFoldersComponent (22 теста) | компонент | list, select, navigate, upload, dialogs | 22 |
| 4.44 | Frontend: SharedFolderAccessDialog | folderId | load accesses, remove, disable link | 4 |
| 4.45 | Frontend: SharedFolderAddContactDialog | folderId | select contact, add access | 4 |
| 4.46 | Frontend: SharedFolderCreateLinkDialog | folderId | create link, copy | 5 |
| 4.47 | Frontend: PublicSharedLinkComponent | token | resolve, files, error | 6 |

### 6.5 Модуль «Контакты»

Всего тестов: **57** (Frontend 18 + Backend 27 + Invitations 12)

| № | Метод проверки | Входные данные | Ожидаемый результат | Кол-во тестов |
|---|---------------|----------------|-------------------|:------------:|
| 5.1 | Список контактов | GET | 200, items | 1 |
| 5.2 | Поиск контактов | search=john | 200, фильтрация | 1 |
| 5.3 | Создание контакта (email) | POST { name, email } | 201 | 1 |
| 5.4 | Создание контакта (phone) | POST { name, phone } | 201 | 1 |
| 5.5 | Создание без email/phone | POST { name } | 422 | 1 |
| 5.6 | Создание дубликата email | duplicate | 422 | 1 |
| 5.7 | Просмотр контакта | GET /contacts/{id} | 200 | 1 |
| 5.8 | Просмотр чужого контакта | other's contact | 404 | 1 |
| 5.9 | Удаление контакта | DELETE | 200 | 1 |
| 5.10 | Импорт контактов | contacts[] до 500 | 200, imported count | 1 |
| 5.11 | Разрешение по email/phone | POST resolve | 200, newly_resolved | 2 |
| 5.12 | Разрешение уже разрешённых | already resolved | 0 новых | 1 |
| 5.13 | Разрешение без контактов | no contacts | 0 новых | 1 |
| 5.14 | История контакта | GET /contacts/{id}/history | 200, items (FileUserAccess) | 1 |
| 5.15 | Пустая история | no shares | 200, [] | 1 |
| 5.16 | История чужого контакта | other | 404 | 1 |
| 5.17 | Запросы контактов (list) | GET contact-requests | 200, pending only | 2 |
| 5.18 | Принятие запроса | POST accept | 200, status=accepted | 1 |
| 5.19 | Отклонение запроса | POST reject | 200, status=rejected | 1 |
| 5.20 | Отклонение чужого запроса | other | 404 | 1 |
| 5.21 | **Приглашения (12 тестов)** | | | 12 |
| 5.21.1 | Отправка приглашения | POST invitations | 201, структура | 1 |
| 5.21.2 | Приглашение без email | no email | 422 | 1 |
| 5.21.3 | Просмотр приглашения по токену | token | 200, информация | 1 |
| 5.21.4 | Невалидный токен | bad token | 404 | 1 |
| 5.21.5 | Принятие приглашения | POST accept | 200 | 1 |
| 5.21.6 | Принятие просроченного | expired | 422 EXPIRED | 1 |
| 5.21.7 | Принятие уже принятого | accepted | 422 NOT_PENDING | 1 |
| 5.21.8 | Отклонение приглашения | POST reject | 200 | 1 |
| 5.21.9 | Отмена приглашения (sender) | POST cancel | 200, status=cancelled | 1 |
| 5.21.10 | Отмена чужого приглашения | other | 403 | 1 |
| 5.22 | Frontend: ContactsComponent | компонент | load, add, validate, delete | 8 |
| 5.23 | Frontend: InviteAcceptComponent | token | resolve, accept/reject states | 10 |

### 6.6 Модуль «Комментарии»

Всего тестов: **36** (Frontend 11 + Backend 25)

| № | Метод проверки | Входные данные | Ожидаемый результат | Кол-во тестов |
|---|---------------|----------------|-------------------|:------------:|
| 6.1 | Список тредов | targetType, targetId, scope | 200, policy + threads | 1 |
| 6.2 | Детали треда (с пагинацией) | threadId, page, perPage | 200, comments | 1 |
| 6.3 | Создание комментария | POST /comments { body } | 201 | 1 |
| 6.4 | Ответ на комментарий | parentCommentId | 201 | 1 |
| 6.5 | Редактирование своего комментария | PATCH { body } | 200 | 1 |
| 6.6 | Редактирование чужого комментария | other | 403 | 1 |
| 6.7 | Удаление своего комментария | DELETE | 200 | 1 |
| 6.8 | Удаление чужого комментария | other | 403 | 1 |
| 6.9 | Mark thread as read | POST read | 200 | 1 |
| 6.10 | Unread counters | thread_ids[] | 200 | 1 |
| 6.11 | Комментарий без thread/target | orphan | 422 | 1 |
| 6.12 | Комментарий с пустым body | body='' | 422 | 1 |
| 6.13 | **Настройки комментариев (12 тестов)** | | | 12 |
| 6.13.1 | Get settings shared folder (owner) | GET | 200 | 1 |
| 6.13.2 | Get settings (editor) | editor | 200 | 1 |
| 6.13.3 | Get settings (viewer) | viewer | 403 | 1 |
| 6.13.4 | Update settings (owner) | PATCH | 200 | 1 |
| 6.13.5 | Update settings (editor) | editor | 200 | 1 |
| 6.13.6 | Update settings (viewer) | viewer | 403 | 1 |
| 6.13.7 | Update settings invalid value | invalid | 422 | 1 |
| 6.13.8 | Local folder settings (owner) | PATCH | 200 | 1 |
| 6.13.9 | Local folder settings (other) | other | 404 | 1 |
| 6.14 | Frontend: ThreadCommentsComponent | компонент | load, create, edit, delete, reply | 10 |
| 6.15 | Frontend: CommentsApiService | сервис | getThreads, create, update, delete | 11 |

### 6.7 Модуль «Inbox»

Всего тестов: **17** (Frontend 10 + Backend 7)

| № | Метод проверки | Входные данные | Ожидаемый результат | Кол-во тестов |
|---|---------------|----------------|-------------------|:------------:|
| 7.1 | Inbox count (empty) | GET /inbox/count | files=0, folders=0, total=0 | 1 |
| 7.2 | Inbox count (with items) | 1 file + 1 folder | files=1, folders=1, total=2 | 1 |
| 7.3 | List inbox files (empty) | GET /inbox/files | [] | 1 |
| 7.4 | List inbox files (with items) | pending files | 200, items | 1 |
| 7.5 | Изоляция файлов | other's pending | 0 items | 1 |
| 7.6 | Accept files | POST accept { ids } | 200, FileUserAccess created | 1 |
| 7.7 | Accept without ids | no ids | 422 | 1 |
| 7.8 | Reject files | POST reject { ids } | 200, pending removed | 1 |
| 7.9 | List shared folders | GET /inbox/shared-folders | 200, items | 1 |
| 7.10 | Accept shared folders | POST accept | 200, SharedFolderAccess created | 1 |
| 7.11 | Reject shared folders | POST reject | 200, pending removed | 1 |
| 7.12 | Frontend: InboxComponent | компонент | load, toggle, accept/reject | 10 |

### 6.8 Модуль «Поддержка и предложения»

Всего тестов: **56** (Frontend 2 + Backend 22 + Admin 20)

| № | Метод проверки | Входные данные | Ожидаемый результат | Кол-во тестов |
|---|---------------|----------------|-------------------|:------------:|
| 8.1 | Create ticket | POST { body } | 201 | 1 |
| 8.2 | Create ticket without body | no body | 422 | 1 |
| 8.3 | List own tickets | GET | 200, only own | 2 |
| 8.4 | Show own ticket | GET /tickets/{id} | 200 | 1 |
| 8.5 | Show other's ticket | other | 404 | 1 |
| 8.6 | Add message to ticket | POST messages { body } | 200 | 1 |
| 8.7 | Add message to other's ticket | other | 404 | 1 |
| 8.8 | Confirm ticket (awaiting_confirmation) | POST confirm | 200, completed | 1 |
| 8.9 | Confirm with wrong status | status=new | 422 | 1 |
| 8.10 | Mark ticket read | POST mark-read | 200 | 1 |
| 8.11 | Create suggestion | POST { body } | 201 | 1 |
| 8.12 | Create suggestion without body | no body | 422 | 1 |
| 8.13 | List own suggestions | GET | 200, only own | 2 |
| 8.14 | Show own suggestion | GET /suggestions/{id} | 200 | 1 |
| 8.15 | Show other's suggestion | other | 404 | 1 |
| 8.16 | **Admin: тикеты (15 тестов)** | | | 15 |
| 8.17 | **Admin: предложения (11 тестов)** | | | 11 |
| 8.18 | Frontend: SupportComponent | компонент | create ticket, send message, confirm | 12 |

### 6.9 Модуль «Администрирование»

Всего тестов: **68** (Frontend 28 + Backend 40)

| № | Метод проверки | Входные данные | Ожидаемый результат | Кол-во тестов |
|---|---------------|----------------|-------------------|:------------:|
| 9.1 | Доступ к админке (superuser) | is_superuser=true | 200 | 1 |
| 9.2 | Доступ к админке (обычный) | is_superuser=false | 403 FORBIDDEN | 2 |
| 9.3 | Доступ к админке (unauth) | unauthenticated | 401 | 1 |
| 9.4 | Stats | GET /admin/stats | 200, структура | 1 |
| 9.5 | List users | GET /admin/users | 200, структура | 1 |
| 9.6 | Update user plan | PATCH /admin/users/{id}/plan | 200, план изменён | 1 |
| 9.7 | Update plan with invalid plan | platinum | 422 | 1 |
| 9.8 | Block/unblock user | POST /admin/users/{id}/block | 200, статус изменён | 1 |
| 9.9 | Generate reset link | POST /admin/users/{id}/reset-link | 200, url | 1 |
| 9.10 | Reset sessions | POST /admin/users/{id}/reset-sessions | 200 | 1 |
| 9.11 | Notify user | POST /admin/users/{id}/notify | 200 | 1 |
| 9.12 | Notify without title/body | no title/body | 422 | 1 |
| 9.13 | Notify all | POST /admin/notify-all | 200 | 1 |
| 9.14 | Nonexistent user | POST /admin/users/nonexistent/* | 404 | 2 |
| 9.15 | Frontend: AdminComponent | компонент | stats, users, tickets, suggestions | 28 |

### 6.10 Модуль «Тарифы»

Всего тестов: **11** (Frontend 3 + Backend 8)

| № | Метод проверки | Входные данные | Ожидаемый результат | Кол-во тестов |
|---|---------------|----------------|-------------------|:------------:|
| 10.1 | List tariffs | GET /tariffs | 200, все 3 плана | 2 |
| 10.2 | View usage | GET /tariffs/usage | 200, структура | 1 |
| 10.3 | Usage excludes deleted files | 1 normal + 1 deleted | 500 bytes | 1 |
| 10.4 | Usage excludes uploading files | 1 uploading | 0 bytes | 1 |
| 10.5 | Request plan change | POST /tariffs/request | 200 | 1 |
| 10.6 | Request invalid plan | platinum | 422 | 1 |
| 10.7 | Frontend: TariffsComponent | компонент | load usage, format bytes | 3 |

### 6.11 Модуль «URL-файлы»

Всего тестов: **10** (Frontend 2 + Backend 8)

| № | Метод проверки | Входные данные | Ожидаемый результат | Кол-во тестов |
|---|---------------|----------------|-------------------|:------------:|
| 11.1 | Preview URL | POST /links-preview { url } | 200, Open Graph metadata | 1 |
| 11.2 | Preview invalid URL | not-a-url | 422 | 1 |
| 11.3 | Preview on fetch failure | 500 from target | 200, min preview (hostname) | 1 |
| 11.4 | Create URL file | POST /url-files { url } | 201, content_kind=url_file | 1 |
| 11.5 | Create URL file invalid | invalid | 422 | 1 |
| 11.6 | Verify URL file structure | created file | content_kind=url_file, link_url | 1 |
| 11.7 | Frontend: UrlFilesApiService | сервис | preview, create | 2 |

### 6.12 Модуль «Активность»

Всего тестов: **10** (Frontend 5 + Backend 5)

| № | Метод проверки | Входные данные | Ожидаемый результат | Кол-во тестов |
|---|---------------|----------------|-------------------|:------------:|
| 12.1 | List activity | GET /activity | 200, items + pagination | 1 |
| 12.2 | Pagination | per_page=2 | 200, count=2 | 1 |
| 12.3 | Response structure | GET | id, action, created_at | 1 |
| 12.4 | Data isolation | user1 vs user2 | только своя активность | 1 |
| 12.5 | Unauthenticated | no auth | 401 | 1 |
| 12.6 | Frontend: ActivityComponent | компонент | load, paginate, actionIcon | 5 |

### 6.13 Модуль «PWA / Push-уведомления»

Всего тестов: **22** (Frontend 14 + Backend 8)

| № | Метод проверки | Входные данные | Ожидаемый результат | Кол-во тестов |
|---|---------------|----------------|-------------------|:------------:|
| 13.1 | VAPID key (public) | GET /push/vapid-key | 200, public_key | 1 |
| 13.2 | Subscribe | POST /push/subscribe | 200, subscription saved | 1 |
| 13.3 | Subscribe without fields | no fields | 422 | 1 |
| 13.4 | Subscribe updates existing | same endpoint | обновление ключей | 1 |
| 13.5 | Unsubscribe | DELETE /push/unsubscribe | 200, removed | 1 |
| 13.6 | Unsubscribe without endpoint | no endpoint | 422 | 1 |
| 13.7 | Frontend: PushService | сервис | subscribe, unsubscribe | 4 |
| 13.8 | Frontend: NotificationService | сервис | show, dismiss, queue limit | 10 |

### 6.14 Модуль «Настройки пользователя»

Всего тестов: **18** (Frontend 14 + Backend 6)

| № | Метод проверки | Входные данные | Ожидаемый результат | Кол-во тестов |
|---|---------------|----------------|-------------------|:------------:|
| 14.1 | Update settings | PATCH /user/settings | 200 | 1 |
| 14.2 | Settings persist in DB | PATCH then refresh | значения в БД | 1 |
| 14.3 | Update contact settings | allow_contacts, auto_add | 200 | 1 |
| 14.4 | Invalid boolean | string for boolean | 422 | 1 |
| 14.5 | Empty update | {} | 200 | 1 |
| 14.6 | Unauthenticated | no auth | 401 | 1 |
| 14.7 | Frontend: SecurityComponent | компонент | sessions, password, email, settings | 14 |

### 6.15 Модуль «Организация (папки и теги)»

Всего тестов: **54** (Frontend 32 + Backend 22)

| № | Метод проверки | Входные данные | Ожидаемый результат | Кол-во тестов |
|---|---------------|----------------|-------------------|:------------:|
| 15.1 | List folders | GET /folders | 200, items | 1 |
| 15.2 | Folder tree | GET /folders/tree | 200 | 1 |
| 15.3 | Create folder | POST { name } | 201 | 1 |
| 15.4 | Create subfolder | POST { name, parent_id } | 201 | 1 |
| 15.5 | Create folder with invalid parent | nonexistent parent | 404 | 1 |
| 15.6 | Update folder name | PATCH { name } | 200 | 1 |
| 15.7 | Update other's folder | other | 404 | 1 |
| 15.8 | Delete empty folder | DELETE | 200 | 1 |
| 15.9 | Force delete with files | DELETE ?force=1 | 200 | 1 |
| 15.10 | Delete folder with children | has children | 422 HAS_CHILDREN | 1 |
| 15.11 | Cycle detection | parent→child→parent | 422 CYCLE_DETECTED | 1 |
| 15.12 | List tags | GET /tags | 200, items | 1 |
| 15.13 | Search tags | search=urg | 200, count=1 | 1 |
| 15.14 | Create tag | POST { name } | 201 | 1 |
| 15.15 | Create duplicate tag | same name | 422 TAG_EXISTS | 1 |
| 15.16 | Update tag | PATCH { name } | 200 | 1 |
| 15.17 | Update other's tag | other | 404 | 1 |
| 15.18 | Delete tag | DELETE | 200 | 1 |
| 15.19 | Attach tags to file | POST attach-tags | 200 | 1 |
| 15.20 | Detach tags from file | POST detach-tags | 200 | 1 |
| 15.21 | Frontend: FoldersTreeComponent | компонент | tree, navigation, filters, bulk | 32 |

### 6.16 Core-сервисы и инфраструктура

Всего тестов: **55** (Frontend 55)

| № | Модуль | Компоненты | Кол-во тестов |
|---|--------|-----------|:------------:|
| 16.1 | API | ApiService, AdminApiService, AuthApiService, FilesApiService и др. | 96 |
| 16.2 | Auth | AuthStateService, authInitializer | 13 |
| 16.3 | Guards | adminGuard, authGuard, guestGuard | 8 |
| 16.4 | i18n | translateInitializer | 1 |
| 16.5 | Interceptors | authInterceptor, errorInterceptor | 4 |
| 16.6 | Layout | AppLayoutComponent | 6 |
| 16.7 | Notifications | NotificationService, PushService | 14 |
| 16.8 | Services | DeviceService, PwaInstallService, ThemeService, VersionCheckService | 11 |
| 16.9 | Shared components | CookieConsentComponent, FileTypeIconComponent, FooterComponent, NotificationBannerComponent, ThreadCommentsComponent | 23 |

### 6.17 Фоновые задачи (cron)

| № | Job | Метод проверки | Ожидаемый результат |
|---|-----|---------------|-------------------|
| 17.1 | ExpireShareLinksJob | Запуск, проверка истёкших ссылок | Статус → expired |
| 17.2 | CleanExpiredFilesJob | Запуск, проверка удалённых файлов | Очистка S3 + БД |
| 17.3 | auth:block-unverified | Неподтверждённые email >24ч | Статус → blocked_unverified_email |
| 17.4 | support:auto-close-tickets | Зависшие тикеты >24ч | Статус → completed |

### 6.18 Сводная таблица методов испытаний

| № | Модуль | Frontend | Backend | Всего |
|---|--------|:--------:|:-------:|:----:|
| 6.1 | Аутентификация | 33 | 31 | **64** |
| 6.2 | Файлы | 93 | 50 | **143** |
| 6.3 | Шеринг | 19 | 20 | **28** (часть в 6.2) |
| 6.4 | Общие папки | 41 | 58 | **99** |
| 6.5 | Контакты | 18 | 39 | **57** |
| 6.6 | Комментарии | 21 | 25 | **36** (часть в 6.4) |
| 6.7 | Inbox | 10 | 12 | **17** (часть в 6.5) |
| 6.8 | Поддержка и предложения | 12 | 44 | **56** |
| 6.9 | Администрирование | 28 | 40 | **68** |
| 6.10 | Тарифы | 3 | 8 | **11** |
| 6.11 | URL-файлы | 2 | 8 | **10** |
| 6.12 | Активность | 5 | 5 | **10** |
| 6.13 | PWA / Push | 14 | 8 | **22** |
| 6.14 | Настройки | 14 | 6 | **18** |
| 6.15 | Организация (папки + теги) | 32 | 22 | **54** |
| 6.16 | Core-сервисы | 55 | — | **55** |
| 6.17 | Фоновые задачи | — | — | 4 jobs |
| | **Итого** | **~400** | **~376** | **~866** |

---

## 7. Приложения

### Приложение A: Полный перечень API-эндпоинтов

См. `docs/endpoints.md` — ~155 REST API endpoint'ов, разделённых на 30 логических групп.

### Приложение B: Матрица прав доступа

См. `docs/permission.md` — 4 модели доступа, сценарии A–K.

### Приложение C: Тестовые сценарии для проверки прав (permission.md)

| Сценарий | Описание | Ключевая проверка |
|----------|----------|------------------|
| A | Локальная папка (personal folder) | U1 видит, U2 не видит |
| B | Прямой шэринг файла (share-to-contact) | Owner → все права, Shared → ограничен |
| C | Общая папка, U2 с доступом view | R/O, без upload/delete |
| D | Общая папка, U2 с доступом edit | Upload/delete своих и чужих |
| E | Shared folder с вложенными, U2 доступ на корень | Наследование view на все подпапки |
| F | Shared folder, U2 доступ только на подпапку | Sub1 видна как корневая |
| G | Файлы в общей папке (shared_folder_only) | Не в filter=mine, add-to-my-files |
| H | Публичная ссылка на файл | resolve/download (public), save (auth) |
| I | Публичная ссылка на общую папку | resolve (public), авто-грант (auth) |
| J | Файл и в общей папке, и расшарен напрямую | Двойной доступ, delete owner vs detach |
| K | Наследование с разными типами на уровнях | Edit на подпапку расширяет view с корня |

### Приложение D: Структура ответа API

```json
{
  "result": "success|error",
  "message": "Описание результата",
  "data": {
    // специфичные для endpoint'а данные
  }
}
```

### Приложение E: Коды ошибок

| HTTP | Код | Описание |
|:----:|-----|----------|
| 401 | — | Неаутентифицирован |
| 403 | FORBIDDEN | Нет прав доступа |
| 404 | — | Ресурс не найден |
| 410 | LINK_INVALID | Ссылка просрочена/невалидна |
| 422 | VALIDATION_ERROR | Ошибка валидации |
| 422 | STORAGE_LIMIT_EXCEEDED | Превышена квота хранилища |
| 422 | FILE_SIZE_LIMIT_EXCEEDED | Превышен макс. размер файла |
| 422 | DUPLICATE_ACCESS | Дублирующийся доступ |
| 422 | OWNER_CANNOT_LEAVE | Владелец не может покинуть папку |
| 422 | NOT_SUPPORTED | Операция не поддерживается |
| 422 | ALREADY_SAVED | Файл уже сохранён |
| 422 | OWN_FILE | Свой файл через ссылку |
| 422 | SAVE_NOT_ALLOWED | Сохранение запрещено |
| 422 | WRONG_PASSWORD | Неверный текущий пароль |
| 422 | INVALID_RESET_TOKEN | Невалидный токен сброса |
| 422 | TAG_EXISTS | Тег с таким именем уже существует |
| 422 | HAS_CHILDREN | Папка имеет подпапки |
| 422 | CYCLE_DETECTED | Обнаружен цикл parent_id |
| 422 | FILE_NOT_AVAILABLE | Файл ещё не загружен |
| 422 | EMAIL_ALREADY_VERIFIED | Email уже подтверждён |
| 422 | NO_VERSIONS | Версионирование не включено |
| 422 | ALREADY_IN_MY_FILES | Файл уже в личных |

---

*Конец документа.*
