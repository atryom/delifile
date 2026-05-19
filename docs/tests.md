# Сводный отчёт по тестированию проекта Delifile

> **Всего проанализировано тестов: 1005**  
> **Дата составления:** 16 мая 2026 г.  
> **Назначение:** детальное описание всех тестов проекта (Frontend Angular 21 + Backend Laravel 11)  
> для формирования методики тестирования, контрольных примеров и тестовой документации.

---

## Содержание

- [core/api](#core-api) — 96 тестов
- [core/auth](#core-auth) — 13 тестов
- [core/guards](#core-guards) — 8 тестов
- [core/i18n](#core-i18n) — 1 тестов
- [core/interceptors](#core-interceptors) — 4 тестов
- [core/layout](#core-layout) — 6 тестов
- [core/notifications](#core-notifications) — 14 тестов
- [core/services](#core-services) — 11 тестов
- [features/activity](#features-activity) — 5 тестов
- [features/admin](#features-admin) — 28 тестов
- [features/auth](#features-auth) — 51 тестов
- [features/contacts](#features-contacts) — 8 тестов
- [features/files](#features-files) — 93 тестов
- [features/folders](#features-folders) — 32 тестов
- [features/inbox](#features-inbox) — 10 тестов
- [features/invitations](#features-invitations) — 10 тестов
- [features/legal](#features-legal) — 2 тестов
- [features/settings](#features-settings) — 14 тестов
- [features/share-target](#features-share-target) — 11 тестов
- [features/markdown-editor](#features-markdown-editor) — 92 тестов
- [features/shared-folders](#features-shared-folders) — 41 тестов
- [features/support](#features-support) — 12 тестов
- [features/tags](#features-tags) — 12 тестов
- [features/tariffs](#features-tariffs) — 3 тестов
- [shared/components](#shared-components) — 23 тестов
- [Feature/Activity](#backend-feature-activity) — 5 тестов
- [Feature/Admin](#backend-feature-admin) — 40 тестов
- [Feature/Auth](#backend-feature-auth) — 31 тестов
- [Feature/Comments](#backend-feature-comments) — 25 тестов
- [Feature/Contacts](#backend-feature-contacts) — 27 тестов
- [Feature/Files](#backend-feature-files) — 50 тестов
- [Feature/Invitations](#backend-feature-invitations) — 12 тестов
- [Feature/Links](#backend-feature-links) — 8 тестов
- [Feature/Organization](#backend-feature-organization) — 22 тестов
- [Feature/Push](#backend-feature-push) — 8 тестов
- [Feature/Documents](#backend-feature-documents) — 47 тестов
- [Feature/SharedFolders](#backend-feature-sharedfolders) — 58 тестов
- [Feature/Sharing](#backend-feature-sharing) — 20 тестов
- [Feature/Support](#backend-feature-support) — 22 тестов
- [Feature/Tariff](#backend-feature-tariff) — 8 тестов
- [Feature/User](#backend-feature-user) — 18 тестов
- [app](#app) — 1 тестов
- [app.component](#app.component) — 2 тестов
- [Unit/ExampleTest](#backend-unit-exampletest) — 1 тестов

---
## Frontend (Angular)

### `core/api`
*Всего тестов: 96*

#### `admin-api.service.spec`
*Компонент/Сервис: `AdminApiService` | Тестов: 8*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should get stats` | Проверяет получение статистики админ-панели через GET /api/v1/admin/stats. | AdminApiService проинициализирован с HttpClientTesting | GET запрос на /api/v1/admin/stats | req.request.method === 'GET' |
| 2 | `should get users` | Проверяет получение списка пользователей через GET /api/v1/admin/users. | AdminApiService проинициализирован | GET запрос на /api/v1/admin/users | req.request.method === 'GET' |
| 3 | `should update user plan` | Проверяет обновление тарифного плана пользователя через PATCH /api/v1/admin/users/u1/plan с телом { plan: 'pro' }. | Параметры userId='u1', plan='pro' передаются в service.updatePlan() | PATCH запрос на /api/v1/admin/users/u1/plan, тело { plan: 'pro' } | req.request.method === 'PATCH', req.request.body === { plan: 'pro' } |
| 4 | `should block user` | Проверяет блокировку пользователя через POST /api/v1/admin/users/u1/block. | userId='u1' передаётся в service.blockUser() | POST запрос на /api/v1/admin/users/u1/block | req.request.method === 'POST' |
| 5 | `should generate reset link` | Проверяет генерацию ссылки сброса пароля через POST /api/v1/admin/users/u1/reset-link. | userId='u1' передаётся в service.generateResetLink() | POST запрос на /api/v1/admin/users/u1/reset-link | req.request.method === 'POST' |
| 6 | `should reset sessions` | Проверяет сброс всех сессий пользователя через POST /api/v1/admin/users/u1/reset-sessions. | userId='u1' передаётся в service.resetSessions() | POST запрос на /api/v1/admin/users/u1/reset-sessions | req.request.method === 'POST' |
| 7 | `should notify user` | Проверяет отправку уведомления конкретному пользователю через POST /api/v1/admin/users/u1/notify с заголовком и телом сообщения. | userId='u1', title='Hello', body='Test' передаются в service.notifyUser() | POST запрос на /api/v1/admin/users/u1/notify, тело { title: 'Hello', body: 'Test' } | req.request.method === 'POST', req.request.body === { title: 'Hello', body: 'Test' } |
| 8 | `should notify all users` | Проверяет массовую рассылку уведомлений всем пользователям через POST /api/v1/admin/notify-all. | title='All', body='Broadcast' передаются в service.notifyAll() | POST запрос на /api/v1/admin/notify-all, тело { title: 'All', body: 'Broadcast' } | req.request.method === 'POST', req.request.body === { title: 'All', body: 'Broadcast' } |

#### `api.service.spec`
*Компонент/Сервис: `ApiService` | Тестов: 7*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should send GET request` | Проверяет, что метод get отправляет GET-запрос по адресу /api/v1/test. Сервис ApiService вызывается с путём '/test'. Ожидается HTTP GET на полный URL. | HttpClientTestingModule, HttpTestingController замокан; сервис ApiService проинициализирован | Вызов service.get('/test') формирует GET-запрос к /api/v1/test | req.request.method === 'GET'; ответ { result: 'success', message: 'OK', data: {} } |
| 2 | `should send GET request with params` | Проверяет, что GET-запрос с параметрами { page: 1, filter: 'mine' } передаёт их как query-параметры. Параметры должны быть корректно установлены в URL. | Параметры { page: 1, filter: 'mine' } передаются в service.get('/test', params) | Запрос на URL, содержащий /api/v1/test; params.get('page') = '1', params.get('filter') = 'mine' | req.request.params.get('page') === '1', req.request.params.get('filter') === 'mine' |
| 3 | `should send POST request` | Проверяет POST-запрос с телом { key: 'value' } на /api/v1/test. | Тело { key: 'value' } передаётся в service.post('/test', body) | HTTP POST на /api/v1/test, тело запроса { key: 'value' } | req.request.method === 'POST', req.request.body === { key: 'value' } |
| 4 | `should send PUT request` | Проверяет PUT-запрос на /api/v1/test/1 с телом { key: 'value' }. | Тело { key: 'value' }, путь '/test/1' передаются в service.put() | HTTP PUT на /api/v1/test/1 | req.request.method === 'PUT' |
| 5 | `should send PATCH request` | Проверяет PATCH-запрос на /api/v1/test/1 с телом { key: 'value' }. | Тело { key: 'value' }, путь '/test/1' передаются в service.patch() | HTTP PATCH на /api/v1/test/1 | req.request.method === 'PATCH' |
| 6 | `should send DELETE request` | Проверяет DELETE-запрос на /api/v1/test/1. | Путь '/test/1' передаётся в service.delete() | HTTP DELETE на /api/v1/test/1 | req.request.method === 'DELETE' |
| 7 | `should send external PUT without base URL` | Проверяет, что putExternal отправляет PUT-запрос напрямую на переданный URL без добавления базового пути /api/v1. Используется для загрузки файлов в S3. | URL 'https://s3.example.com/upload', Blob, заголовки { 'Content-Type': 'application/pdf' } | HTTP PUT на 'https://s3.example.com/upload' | req.request.method === 'PUT', ответ null |

#### `auth-api.service.spec`
*Компонент/Сервис: `AuthApiService` | Тестов: 7*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should send register request` | Проверяет регистрацию пользователя через POST /api/v1/auth/register с email, паролем и подтверждением пароля. В ответе проверяется поле result. | Данные { email, password, password_confirmation } передаются в service.register(); подписка с проверкой res.result | POST запрос на /api/v1/auth/register, тело содержит переданные данные | req.request.method === 'POST', req.request.body === данные; после flush subscription проверяет res.result === 'success' |
| 2 | `should send login request` | Проверяет вход пользователя через POST /api/v1/auth/login с email и паролем. | { email: 'test@test.com', password: 'pass' } передаются в service.login() | POST запрос на /api/v1/auth/login | req.request.method === 'POST' |
| 3 | `should send logout request` | Проверяет выход пользователя через POST /api/v1/auth/logout. | Вызов service.logout() без параметров | POST запрос на /api/v1/auth/logout | req.request.method === 'POST' |
| 4 | `should send me request` | Проверяет получение данных текущего пользователя через GET /api/v1/auth/me. | Вызов service.me() без параметров | GET запрос на /api/v1/auth/me | req.request.method === 'GET' |
| 5 | `should send sessions request` | Проверяет получение списка активных сессий через GET /api/v1/auth/sessions. | Вызов service.sessions() без параметров | GET запрос на /api/v1/auth/sessions | req.request.method === 'GET' |
| 6 | `should send change password request` | Проверяет смену пароля через POST /api/v1/auth/password/change с текущим и новым паролями. | { current_password, password, password_confirmation } передаются в service.changePassword() | POST запрос на /api/v1/auth/password/change | req.request.method === 'POST' |
| 7 | `should send forgot password request` | Проверяет запрос на восстановление пароля через POST /api/v1/auth/password/forgot с email в теле. | email='test@test.com' передаётся в service.forgotPassword() | POST запрос на /api/v1/auth/password/forgot, тело { email: 'test@test.com' } | req.request.body === { email: 'test@test.com' } |

#### `comments-api.service.spec`
*Компонент/Сервис: `CommentsApiService` | Тестов: 11*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should get threads` | Проверяет получение списка тредов комментариев с параметрами targetType, targetId и scope через GET запрос с query-параметрами. | Параметры 'file', 'f1', 'all' передаются в service.getThreads() | GET запрос на /api/v1/comment-threads?targetType=file&targetId=f1&scope=all | req.request.method === 'GET' |
| 2 | `should get thread detail` | Проверяет получение деталей конкретного треда с пагинацией через GET запрос. | threadId='th1', page=1, perPage=30 передаются в service.getThread() | GET запрос на /api/v1/comment-threads/th1?page=1&per_page=30 | req.request.method === 'GET' |
| 3 | `should mark thread as read` | Проверяет отметку треда как прочитанного через POST /api/v1/comment-threads/th1/read. | threadId='th1' передаётся в service.markRead() | POST запрос на /api/v1/comment-threads/th1/read | req.request.method === 'POST' |
| 4 | `should get unread counters` | Проверяет получение счетчиков непрочитанных комментариев для списка тредов через POST с массивом threadIds в теле. | Массив ['th1', 'th2'] передаётся в service.unreadCounters() | POST запрос на /api/v1/comment-threads/unread-counters, тело { threadIds: ['th1', 'th2'] } | req.request.method === 'POST', req.request.body === { threadIds: ['th1', 'th2'] } |
| 5 | `should create comment` | Проверяет создание нового комментария через POST /api/v1/comments с типом цели, ID, областью видимости и текстом. | Объект { targetType, targetId, scope, body } передаётся в service.createComment() | POST запрос на /api/v1/comments, тело содержит все переданные поля | req.request.method === 'POST', req.request.body совпадает с входным объектом |
| 6 | `should update comment` | Проверяет обновление текста комментария через PATCH /api/v1/comments/c1. | commentId='c1', body='Updated body' передаются в service.updateComment() | PATCH запрос на /api/v1/comments/c1, тело { body: 'Updated body' } | req.request.method === 'PATCH', req.request.body === { body: 'Updated body' } |
| 7 | `should delete comment` | Проверяет удаление комментария через DELETE /api/v1/comments/c1. | commentId='c1' передаётся в service.deleteComment() | DELETE запрос на /api/v1/comments/c1 | req.request.method === 'DELETE' |
| 8 | `should get file comment settings` | Проверяет получение настроек комментариев для файла через GET /api/v1/files/f1/comment-settings. | fileId='f1' передаётся в service.getFileCommentSettings() | GET запрос на /api/v1/files/f1/comment-settings | req.request.method === 'GET' |
| 9 | `should update file comment settings` | Проверяет обновление настроек комментариев файла через PATCH /api/v1/files/f1/comment-settings. | fileId='f1', settings { sharedCommentsEnabled: false } передаются в service.updateFileCommentSettings() | PATCH запрос на /api/v1/files/f1/comment-settings, тело { sharedCommentsEnabled: false } | req.request.method === 'PATCH', req.request.body === { sharedCommentsEnabled: false } |
| 10 | `should get shared folder comment settings` | Проверяет получение настроек комментариев общей папки через GET /api/v1/shared-folders/sf1/comment-settings. | folderId='sf1' передаётся в service.getSharedFolderCommentSettings() | GET запрос на /api/v1/shared-folders/sf1/comment-settings | req.request.method === 'GET' |
| 11 | `should update shared folder comment settings` | Проверяет обновление настроек комментариев общей папки через PATCH /api/v1/shared-folders/sf1/comment-settings. | folderId='sf1', mode 'disabled' передаются в service.updateSharedFolderCommentSettings() | PATCH запрос на /api/v1/shared-folders/sf1/comment-settings, тело { sharedCommentsMode: 'disabled' } | req.request.method === 'PATCH', req.request.body === { sharedCommentsMode: 'disabled' } |

#### `domain-api.services.spec`
*Компонент/Сервис: `ContactsApiService` | Тестов: 11*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should list contacts` | Проверяет получение списка контактов через GET /api/v1/contacts. | ContactsApiService проинициализирован, вызов service.list() без параметров | GET запрос на /api/v1/contacts | req.request.method === 'GET' |
| 2 | `should list contacts with search` | Проверяет поиск контактов с параметром search через GET /api/v1/contacts?search=john. | Строка 'john' передаётся в service.list('john') | GET запрос, содержащий /api/v1/contacts, с query-параметром search='john' | req.request.params.get('search') === 'john' |
| 3 | `should create contact` | Проверяет создание контакта через POST /api/v1/contacts с именем и email. | Объект { name: 'John', email: 'john@test.com' } передаётся в service.create() | POST запрос на /api/v1/contacts, тело содержит переданный объект | req.request.method === 'POST', req.request.body === { name: 'John', email: 'john@test.com' } |
| 4 | `should get contact` | Проверяет получение контакта по ID через GET /api/v1/contacts/1. | ID '1' передаётся в service.get('1') | GET запрос на /api/v1/contacts/1 | req.request.method === 'GET' |
| 5 | `should import contacts` | Проверяет импорт контактов через POST /api/v1/contacts/import с массивом контактов. | Массив [{ name: 'John', phone: '+123' }] передаётся в service.import() | POST запрос на /api/v1/contacts/import | req.request.method === 'POST' |
| 6 | `should resolve contacts` | Проверяет разрешение контактов (верификацию) через POST /api/v1/contacts/resolve. | Вызов service.resolve() без параметров | POST запрос на /api/v1/contacts/resolve | req.request.method === 'POST' |
| 7 | `should delete contact` | Проверяет удаление контакта через DELETE /api/v1/contacts/1. | ID '1' передаётся в service.delete('1') | DELETE запрос на /api/v1/contacts/1 | req.request.method === 'DELETE' |
| 8 | `should get contact history` | Проверяет получение истории взаимодействий с контактом через GET /api/v1/contacts/1/history. | ID '1' передаётся в service.history('1') | GET запрос на /api/v1/contacts/1/history | req.request.method === 'GET' |
| 9 | `should list activity` | Проверяет получение лога активности с пагинацией через GET /api/v1/activity?page=1. | ActivityApiService проинициализирован, вызов service.list() | GET запрос на /api/v1/activity?page=1 | req.request.method === 'GET' |
| 10 | `should list folders` | Проверяет получение списка папок организации через GET /api/v1/folders. | OrganizationApiService (из domain-api.services) проинициализирован, вызов service.listFolders() | GET запрос на /api/v1/folders | req.request.method === 'GET' |
| 11 | `should list tags` | Проверяет получение списка тегов через GET /api/v1/tags. | Вызов service.listTags() | GET запрос на /api/v1/tags | req.request.method === 'GET' |

#### `files-api.service.spec`
*Компонент/Сервис: `FilesApiService` | Тестов: 14*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should list files with default params` | Проверяет получение списка файлов с параметрами по умолчанию (filter=mine, page=1) через GET запрос. | Вызов service.list() без аргументов | GET запрос, содержащий /api/v1/files, с params filter='mine', page='1' | req.request.method === 'GET', req.request.params.get('filter') === 'mine', params.get('page') === '1' |
| 2 | `should list favorites` | Проверяет фильтрацию списка файлов по избранному через GET с параметром filter='favorites'. | Параметры 'favorites', 1 передаются в service.list('favorites', 1) | GET запрос с params filter='favorites' | req.request.params.get('filter') === 'favorites' |
| 3 | `should get file by id` | Проверяет получение файла по ID через GET /api/v1/files/file-123. | ID 'file-123' передаётся в service.get('file-123') | GET запрос на /api/v1/files/file-123 | req.request.method === 'GET' |
| 4 | `should delete file` | Проверяет удаление файла через DELETE /api/v1/files/file-123. | ID 'file-123' передаётся в service.delete('file-123') | DELETE запрос на /api/v1/files/file-123 | req.request.method === 'DELETE' |
| 5 | `should init upload` | Проверяет инициализацию загрузки файла через POST /api/v1/files/init-upload с метаданными файла. | Объект { original_name, size, mime_type } передаётся в service.initUpload() | POST запрос на /api/v1/files/init-upload | req.request.method === 'POST' |
| 6 | `should complete upload` | Проверяет завершение загрузки файла через POST /api/v1/files/complete-upload с file_id в теле. | ID 'file-123' передаётся в service.completeUpload('file-123') | POST запрос на /api/v1/files/complete-upload, тело { file_id: 'file-123' } | req.request.body === { file_id: 'file-123' } |
| 7 | `should pin file` | Проверяет закрепление файла через POST /api/v1/files/file-123/pin. | ID 'file-123' передаётся в service.pin('file-123') | POST запрос на /api/v1/files/file-123/pin | req.request.method === 'POST' |
| 8 | `should unpin file` | Проверяет открепление файла через POST /api/v1/files/file-123/unpin. | ID 'file-123' передаётся в service.unpin('file-123') | POST запрос на /api/v1/files/file-123/unpin | req.request.method === 'POST' |
| 9 | `should favorite file` | Проверяет добавление файла в избранное через POST /api/v1/files/file-123/favorite. | ID 'file-123' передаётся в service.favorite('file-123') | POST запрос на /api/v1/files/file-123/favorite | Ответ { result: 'success', message: 'Favorited', data: {} } |
| 10 | `should move file to folder` | Проверяет перемещение файла в папку через POST /api/v1/files/file-123/move-folder с folder_id в теле. | fileId='file-123', folderId='folder-1' передаются в service.moveFolder() | POST запрос на /api/v1/files/file-123/move-folder, тело { folder_id: 'folder-1' } | req.request.body === { folder_id: 'folder-1' } |
| 11 | `should download file` | Проверяет получение ссылки на скачивание файла через GET /api/v1/files/file-123/download. В подписке проверяется URL из ответа. | ID 'file-123' передаётся в service.download('file-123'); подписка с проверкой res.data.url | GET запрос на /api/v1/files/file-123/download | В subscription res.data.url === 'https://s3.example.com/download' |
| 12 | `should share to contact` | Проверяет отправку файла контакту через POST /api/v1/files/file-123/share-to-contact с contact_id. | fileId='file-123', contactId='contact-1' передаются в service.shareToContact() | POST запрос на /api/v1/files/file-123/share-to-contact, тело { contact_id: 'contact-1' } | req.request.body === { contact_id: 'contact-1' } |
| 13 | `should create link` | Проверяет создание публичной ссылки на файл через POST /api/v1/files/file-123/create-link с TTL и флагом allow_save. | fileId='file-123', ttl=24, allowSave=true передаются в service.createLink() | POST запрос, тело { ttl_hours: 24, allow_save: true } | req.request.body === { ttl_hours: 24, allow_save: true } |
| 14 | `should resolve public link` | Проверяет разрешение публичной ссылки по токену через POST /api/v1/links/link-token/resolve. | Токен 'link-token' передаётся в service.resolveLink('link-token') | POST запрос на /api/v1/links/link-token/resolve | req.request.method === 'POST' |

#### `inbox-api.service.spec`
*Компонент/Сервис: `InboxApiService` | Тестов: 7*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should get inbox count` | Проверяет получение количества непрочитанных элементов в инбоксе через GET /api/v1/inbox/count. | Вызов service.getCount() без параметров | GET запрос на /api/v1/inbox/count | req.request.method === 'GET' |
| 2 | `should get inbox files` | Проверяет получение списка файлов в инбоксе через GET /api/v1/inbox/files. | Вызов service.getFiles() без параметров | GET запрос на /api/v1/inbox/files | Ответ { result: 'success', message: 'OK', data: { items: [] } } |
| 3 | `should accept files` | Проверяет принятие файлов из инбокса через POST /api/v1/inbox/files/accept с массивом ID. | Массив ['f1', 'f2'] передаётся в service.acceptFiles(['f1', 'f2']) | POST запрос на /api/v1/inbox/files/accept, тело { ids: ['f1', 'f2'] } | req.request.body === { ids: ['f1', 'f2'] } |
| 4 | `should reject files` | Проверяет отклонение файлов из инбокса через POST /api/v1/inbox/files/reject с массивом ID. | Массив ['f1'] передаётся в service.rejectFiles(['f1']) | POST запрос на /api/v1/inbox/files/reject, тело { ids: ['f1'] } | req.request.body === { ids: ['f1'] } |
| 5 | `should get shared folders` | Проверяет получение списка общих папок в инбоксе через GET /api/v1/inbox/shared-folders. | Вызов service.getSharedFolders() без параметров | GET запрос на /api/v1/inbox/shared-folders | Ответ { result: 'success', message: 'OK', data: { items: [] } } |
| 6 | `should accept shared folders` | Проверяет принятие приглашения в общую папку через POST /api/v1/inbox/shared-folders/accept. | Массив ['sf1'] передаётся в service.acceptSharedFolders(['sf1']) | POST запрос на /api/v1/inbox/shared-folders/accept, тело { ids: ['sf1'] } | req.request.body === { ids: ['sf1'] } |
| 7 | `should reject shared folders` | Проверяет отклонение приглашения в общую папку через POST /api/v1/inbox/shared-folders/reject. | Массив ['sf1'] передаётся в service.rejectSharedFolders(['sf1']) | POST запрос на /api/v1/inbox/shared-folders/reject, тело { ids: ['sf1'] } | req.request.body === { ids: ['sf1'] } |

#### `invitations-api.service.spec`
*Компонент/Сервис: `InvitationsApiService` | Тестов: 5*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should send invitation` | Проверяет отправку приглашения по email через POST /api/v1/invitations. | Объект { email: 'test@test.com' } передаётся в service.send() | POST запрос на /api/v1/invitations, тело { email: 'test@test.com' } | req.request.method === 'POST', req.request.body === { email: 'test@test.com' } |
| 2 | `should get invitation info` | Проверяет получение информации о приглашении по токену через GET /api/v1/invitations/token-123. | Токен 'token-123' передаётся в service.get('token-123') | GET запрос на /api/v1/invitations/token-123 | req.request.method === 'GET' |
| 3 | `should accept invitation` | Проверяет принятие приглашения по токену через POST /api/v1/invitations/token-123/accept. | Токен 'token-123' передаётся в service.accept('token-123') | POST запрос на /api/v1/invitations/token-123/accept | req.request.method === 'POST' |
| 4 | `should reject invitation` | Проверяет отклонение приглашения по токену через POST /api/v1/invitations/token-123/reject. | Токен 'token-123' передаётся в service.reject('token-123') | POST запрос на /api/v1/invitations/token-123/reject | req.request.method === 'POST' |
| 5 | `should cancel invitation` | Проверяет отмену приглашения по ID через POST /api/v1/invitations/i1/cancel. | ID 'i1' передаётся в service.cancel('i1') | POST запрос на /api/v1/invitations/i1/cancel | req.request.method === 'POST' |

#### `organization-api.service.spec`
*Компонент/Сервис: `OrganizationApiService` | Тестов: 6*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should get folder tree` | Проверяет получение дерева папок организации через GET /api/v1/folders/tree. | Вызов service.getFolderTree() без параметров | GET запрос на /api/v1/folders/tree | req.request.method === 'GET' |
| 2 | `should create folder` | Проверяет создание новой папки через POST /api/v1/folders с именем. | Объект { name: 'New Folder' } передаётся в service.createFolder() | POST запрос на /api/v1/folders, тело { name: 'New Folder' } | req.request.method === 'POST', req.request.body === { name: 'New Folder' } |
| 3 | `should delete folder` | Проверяет удаление папки с флагом принудительного удаления через DELETE /api/v1/folders/folder-1?force=1. | folderId='folder-1', force=true передаются в service.deleteFolder('folder-1', true) | DELETE запрос на /api/v1/folders/folder-1?force=1 | req.request.method === 'DELETE' |
| 4 | `should list tags` | Проверяет получение списка всех тегов через GET /api/v1/tags. | Вызов service.getTags() без параметров | GET запрос на /api/v1/tags | req.request.method === 'GET' |
| 5 | `should create tag` | Проверяет создание нового тега через POST /api/v1/tags с именем в теле. | Имя 'important' передаётся в service.createTag('important') | POST запрос на /api/v1/tags, тело { name: 'important' } | req.request.body === { name: 'important' } |
| 6 | `should attach tags to file` | Проверяет прикрепление тегов к файлу через POST /api/v1/files/file-1/attach-tags с массивом ID тегов. | fileId='file-1', массив ['tag-1', 'tag-2'] передаются в service.attachTags() | POST запрос на /api/v1/files/file-1/attach-tags, тело { tag_ids: ['tag-1', 'tag-2'] } | req.request.body === { tag_ids: ['tag-1', 'tag-2'] } |

#### `shared-folders-api.service.spec`
*Компонент/Сервис: `SharedFoldersApiService` | Тестов: 6*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should get shared folders list` | Проверяет получение списка общих папок через GET /api/v1/shared-folders. | Вызов service.list() без параметров | GET запрос на /api/v1/shared-folders | req.request.method === 'GET' |
| 2 | `should create shared folder` | Проверяет создание общей папки через POST /api/v1/shared-folders с именем. | Имя 'Team Folder' передаётся в service.create('Team Folder') | POST запрос на /api/v1/shared-folders, тело { name: 'Team Folder' } | req.request.body === { name: 'Team Folder' } |
| 3 | `should get files in shared folder` | Проверяет получение файлов внутри общей папки с пагинацией через GET /api/v1/shared-folders/sf1/files?page=1&per_page=20. | folderId='sf1', page=1 передаются в service.listFiles('sf1', 1) | GET запрос на /api/v1/shared-folders/sf1/files?page=1&per_page=20 | req.request.method === 'GET' |
| 4 | `should list accesses` | Проверяет получение списка доступов к общей папке через GET /api/v1/shared-folders/sf1/accesses. | folderId='sf1' передаётся в service.listAccesses('sf1') | GET запрос на /api/v1/shared-folders/sf1/accesses | Ответ { result: 'success', message: 'OK', data: { items: [] } } |
| 5 | `should add access` | Проверяет добавление доступа контакту к общей папке через POST /api/v1/shared-folders/sf1/accesses с contact_id и access_type. | folderId='sf1', contactId='contact-1', accessType='edit' передаются в service.addAccess() | POST запрос, тело { contact_id: 'contact-1', access_type: 'edit' } | req.request.body === { contact_id: 'contact-1', access_type: 'edit' } |
| 6 | `should create link` | Проверяет создание публичной ссылки на общую папку через POST /api/v1/shared-folders/sf1/links с настройками доступа. | folderId='sf1', конфиг { access_type, ttl_hours, allow_save } передаются в service.createLink() | POST запрос на /api/v1/shared-folders/sf1/links, тело с конфигом | req.request.body === { access_type: 'view', ttl_hours: 24, allow_save: true } |

#### `support-api.service.spec`
*Компонент/Сервис: `SupportApiService` | Тестов: 5*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should get tickets` | Проверяет получение списка тикетов поддержки с пагинацией через GET /api/v1/support/tickets?page=1. | page=1 передаётся в service.getTickets(1) | GET запрос на /api/v1/support/tickets?page=1 | req.request.method === 'GET' |
| 2 | `should create ticket` | Проверяет создание нового тикета поддержки через POST /api/v1/support/tickets с сообщением и вложениями. | message='Help!', files=[] передаются в service.createTicket('Help!', []) | POST запрос на /api/v1/support/tickets | req.request.method === 'POST' |
| 3 | `should add message to ticket` | Проверяет добавление сообщения в существующий тикет через POST /api/v1/support/tickets/t1/messages. | ticketId='t1', message='More info', files=[] передаются в service.sendMessage() | POST запрос на /api/v1/support/tickets/t1/messages | req.request.method === 'POST' |
| 4 | `should get suggestions` | Проверяет получение списка предложений/pожеланий с пагинацией через GET /api/v1/support/suggestions?page=1. | page=1 передаётся в service.getSuggestions(1) | GET запрос на /api/v1/support/suggestions?page=1 | req.request.method === 'GET' |
| 5 | `should create suggestion` | Проверяет создание нового предложения через POST /api/v1/support/suggestions. | text='Great idea!', files=[] передаются в service.createSuggestion() | POST запрос на /api/v1/support/suggestions | req.request.method === 'POST' |

#### `tariff-api.service.spec`
*Компонент/Сервис: `TariffApiService` | Тестов: 3*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should get tariffs` | Проверяет получение списка тарифных планов через GET /api/v1/tariffs. | Вызов service.getPlans() без параметров | GET запрос на /api/v1/tariffs | req.request.method === 'GET' |
| 2 | `should get usage` | Проверяет получение данных об использовании текущего тарифа через GET /api/v1/tariffs/usage. | Вызов service.getUsage() без параметров | GET запрос на /api/v1/tariffs/usage | Ответ { result: 'success', message: 'OK', data: {} } |
| 3 | `should request plan change` | Проверяет запрос на смену тарифного плана через POST /api/v1/tariffs/request с указанием плана. | plan='silver' передаётся в service.requestPlan('silver') | POST запрос на /api/v1/tariffs/request, тело { plan: 'silver' } | req.request.body === { plan: 'silver' } |

#### `url-files-api.service.spec`
*Компонент/Сервис: `UrlFilesApiService` | Тестов: 2*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should preview URL` | Проверяет получение превью по URL через POST /api/v1/links-preview с URL в теле. | URL 'https://example.com' передаётся в service.preview() | POST запрос на /api/v1/links-preview, тело { url: 'https://example.com' } | req.request.method === 'POST', req.request.body === { url: 'https://example.com' } |
| 2 | `should create URL file` | Проверяет создание файла по URL (закладки) через POST /api/v1/url-files. | URL 'https://example.com' передаётся в service.create() | POST запрос на /api/v1/url-files, тело { url: 'https://example.com' } | req.request.method === 'POST', req.request.body === { url: 'https://example.com' } |

#### `user-settings-api.service.spec`
*Компонент/Сервис: `UserSettingsApiService` | Тестов: 4*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should update settings` | Проверяет обновление настроек пользователя через PATCH /api/v1/user/settings. | Объект { name: 'New Name' } передаётся в service.updateSettings() | PATCH запрос на /api/v1/user/settings, тело { name: 'New Name' } | req.request.method === 'PATCH', req.request.body === { name: 'New Name' } |
| 2 | `should get contact requests` | Проверяет получение запросов на добавление в контакты через GET /api/v1/contact-requests. | Вызов service.getContactRequests() без параметров | GET запрос на /api/v1/contact-requests | req.request.method === 'GET' |
| 3 | `should accept contact request` | Проверяет принятие запроса на добавление в контакты через POST /api/v1/contact-requests/cr1/accept. | ID 'cr1' передаётся в service.acceptContactRequest('cr1') | POST запрос на /api/v1/contact-requests/cr1/accept | req.request.method === 'POST' |
| 4 | `should reject contact request` | Проверяет отклонение запроса на добавление в контакты через POST /api/v1/contact-requests/cr1/reject. | ID 'cr1' передаётся в service.rejectContactRequest('cr1') | POST запрос на /api/v1/contact-requests/cr1/reject | req.request.method === 'POST' |

### `core/auth`
*Всего тестов: 13*

#### `auth-state.service.spec`
*Компонент/Сервис: `AuthStateService` | Тестов: 10*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should be created` | Проверяет, что сервис AuthStateService успешно создаётся через TestBed. | AuthStateService проинициализирован, localStorage и sessionStorage очищены | Проверка существования экземпляра сервиса | Сервис не равен null/undefined |
| 2 | `should start with no user` | Проверяет начальное состояние сервиса: пользователь не аутентифицирован, user и token равны null. | AuthStateService создан без вызова setUser; localStorage/sessionStorage очищены | Чтение сигналов isAuthenticated(), user(), token() | isAuthenticated() === false, user() === null, token() === null |
| 3 | `should set user and token` | Проверяет установку пользователя и токена через setUser с remember=true. Токен должен сохраниться в localStorage. | Пользователь { id, email }, токен 'token-123', remember=true передаются в setUser() | Установка сигналов и запись в localStorage | isAuthenticated() === true, user() === переданному объекту, token() === 'token-123', localStorage.getItem('auth_token') === 'token-123' |
| 4 | `should store token in sessionStorage when remember is false` | Проверяет, что при remember=false токен сохраняется в sessionStorage, а не в localStorage. | Пользователь, токен 'token-456', remember=false передаются в setUser() | Запись токена в sessionStorage | sessionStorage.getItem('auth_token') === 'token-456', localStorage.getItem('auth_token') === null |
| 5 | `should clear user and token` | Проверяет полную очистку данных пользователя и токена через clearUser. После очистки все сигналы сбрасываются. | Сначала setUser с remember=true, затем clearUser() | Сброс сигналов и удаление из storage | isAuthenticated() === false, user() === null, token() === null |
| 6 | `should update user` | Проверяет частичное обновление данных пользователя через updateUser без изменения токена. | setUser с { id, email: 'old@test.com' }, затем updateUser с { id, email: 'new@test.com' } | Обновление сигнала user() | user()?.email === 'new@test.com' |
| 7 | `should restore user` | Проверяет восстановление пользователя при загрузке приложения (например, после обновления страницы). Устанавливает пользователя и флаг аутентификации без токена. | Объект пользователя передаётся в restoreUser() без токена | Установка isAuthenticated=true и user | isAuthenticated() === true, user() === переданному объекту |
| 8 | `should compute isEmailVerified` | Проверяет вычисляемое свойство isEmailVerified. При email_verified=false возвращает false, при true возвращает true. | Последовательно два разных пользователя: unverified (email_verified: false) и verified (email_verified: true) | Проверка сигнала isEmailVerified() после каждого setUser | При неподтверждённом email isEmailVerified() === false; при подтверждённом === true |
| 9 | `should compute isBlocked` | Проверяет вычисляемое свойство isBlocked. Статус 'blocked_unverified_email' считается заблокированным, 'active' — нет. | Два пользователя: blocked (account_status: 'blocked_unverified_email') и active (account_status: 'active') | Проверка сигнала isBlocked() после каждого setUser | Для заблокированного isBlocked() === true, для активного === false |
| 10 | `should compute isSuperUser` | Проверяет вычисляемое свойство isSuperUser на основе флага is_superuser в данных пользователя. | Два пользователя: regular (is_superuser: false) и admin (is_superuser: true) | Проверка сигнала isSuperUser() после каждого setUser | Для обычного isSuperUser() === false, для администратора === true |

#### `auth.initializer.spec`
*Компонент/Сервис: `authInitializer` | Тестов: 3*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should restore user on successful auth/me` | Проверяет, что при успешном ответе от auth/me (result='success') вызывается restoreUser для восстановления сессии. AuthApi.me замокан на возврат успешного ответа с пользователем. | mockAuthApi.me возвращает Observable с { result: 'success', data: { user: { id: 'u-1', email: 'test@test.com' } } }; mockAuthState.provided; runInInjectionContext | Вызов authInitializer, внутри вызов authApi.me() | mockAuthApi.me вызван 1 раз; mockAuthState.restoreUser вызван с { id: 'u-1', email: 'test@test.com' } |
| 2 | `should not restore user on failed auth/me` | Проверяет, что при ошибке HTTP-запроса auth/me (throwError) restoreUser не вызывается. Пользователь остаётся неаутентифицированным. | mockAuthApi.me возвращает throwError с ошибкой 'Unauthenticated' | Вызов authInitializer, перехват ошибки | mockAuthApi.me вызван 1 раз; mockAuthState.restoreUser не вызван |
| 3 | `should not restore user when result is not success` | Проверяет, что при ответе от auth/me с result='error' (не success) restoreUser также не вызывается. Учитывается только успешный статус. | mockAuthApi.me возвращает of({ result: 'error', message: 'Fail' }) без пользователя | Вызов authInitializer | mockAuthState.restoreUser не вызван |

### `core/guards`
*Всего тестов: 8*

#### `admin.guard.spec`
*Компонент/Сервис: `adminGuard` | Тестов: 3*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should redirect to /files when not authenticated` | Проверяет, что неаутентифицированный пользователь перенаправляется на /files и гвард возвращает false. | AuthStateService в начальном состоянии (без пользователя); Router замокан с navigate | Вызов adminGuard() через runInInjectionContext | router.navigate вызван с ['/files']; result === false |
| 2 | `should redirect to /files when authenticated but not superuser` | Проверяет, что обычный аутентифицированный пользователь (is_superuser=false) также перенаправляется на /files. | setUser с { is_superuser: false } и токеном; Router замокан | Вызов adminGuard() | router.navigate вызван с ['/files']; result === false |
| 3 | `should allow access when authenticated and superuser` | Проверяет, что суперпользователь (is_superuser=true) получает доступ (result=true) без перенаправления. | setUser с { is_superuser: true } и токеном | Вызов adminGuard() | result === true (router.navigate не проверяется, т.е. не вызван) |

#### `auth.guard.spec`
*Компонент/Сервис: `authGuard` | Тестов: 3*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should redirect to /login when not authenticated` | Проверяет, что неаутентифицированный пользователь перенаправляется на страницу логина (гвард возвращает UrlTree, не true). | AuthStateService без пользователя; Router замокан с navigate и createUrlTree (возвращает '/login') | Вызов authGuard() через runInInjectionContext | result !== true (возвращается UrlTree для редиректа) |
| 2 | `should redirect to /account-blocked when blocked` | Проверяет, что заблокированный пользователь перенаправляется на страницу account-blocked через createUrlTree. | setUser с { account_status: 'blocked_unverified_email' }; createUrlTree возвращает '/account-blocked' | Вызов authGuard() | createUrlTree вызван с ['/account-blocked']; result !== true |
| 3 | `should allow access when authenticated and not blocked` | Проверяет, что активный аутентифицированный пользователь получает доступ (result=true). | setUser с { account_status: 'active' } | Вызов authGuard() | result === true |

#### `guest.guard.spec`
*Компонент/Сервис: `guestGuard` | Тестов: 2*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should allow access when not authenticated` | Проверяет, что неаутентифицированный пользователь (гость) получает доступ к странице (result=true). | AuthStateService без пользователя; Router замокан | Вызов guestGuard() через runInInjectionContext | result === true |
| 2 | `should redirect to /files when authenticated` | Проверяет, что аутентифицированный пользователь перенаправляется на /files через createUrlTree. | setUser с пользователем и токеном; Router замокан | Вызов guestGuard() | router.createUrlTree вызван с ['/files'] |

### `core/i18n`
*Всего тестов: 1*

#### `translate.initializer.spec`
*Компонент/Сервис: `translateInitializer` | Тестов: 1*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should set language to ru` | Проверяет, что инициализатор перевода устанавливает русский язык ('ru') через TranslateService.use(). TranslateService замокан с заглушками. | TranslateService замокан (mock с use, возвращающим of('ru')); runInInjectionContext | Вызов translateInitializer | translateMock.use вызван с 'ru' |

### `core/interceptors`
*Всего тестов: 4*

#### `auth.interceptor.spec`
*Компонент/Сервис: `authInterceptor` | Тестов: 3*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should add Bearer token when authenticated` | Проверяет, что interceptor добавляет заголовок Authorization: Bearer <token> к каждому HTTP-запросу, если пользователь аутентифицирован. | setUser с токеном 'my-token'; HttpClient делает GET на /api/v1/test | HTTP GET запрос с заголовком Authorization | req.request.headers.get('Authorization') === 'Bearer my-token' |
| 2 | `should clear user and redirect to /login on 401` | Проверяет, что при получении 401 Unauthorized interceptor очищает данные пользователя (clearUser) и перенаправляет на /login. | setUser с токеном; HttpClient делает GET; сервер возвращает 401 | Обработка ошибки 401 в interceptor | isAuthenticated() === false, token() === null, router.navigate вызван с ['/login'] |
| 3 | `should not redirect on 401 when already not authenticated` | Проверяет, что если пользователь уже не аутентифицирован (токена нет), то при 401 редирект на /login не выполняется (чтобы избежать циклических редиректов). | HttpClient делает GET без предварительной установки пользователя; сервер возвращает 401 | Обработка ошибки 401 без аутентификации | router.navigate не вызван |

#### `error.interceptor.spec`
*Компонент/Сервис: `errorInterceptor` | Тестов: 1*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should normalize server error with error body` | Проверяет, что interceptor нормализует ошибку сервера, пробрасывая тело ответа (result, message, data) как ошибку Observable. Запрос на GET /api/v1/test возвращает 422 с деталями ошибки. | HttpClient делает GET /api/v1/test; сервер отвечает 422 с { result: 'error', message: 'Validation failed', data: { code: 'VALIDATION_ERROR', errors: {} } } | Ошибка пробрасывается через reject в Promise | rejects.toEqual({ result: 'error', message: 'Validation failed', data: { code: 'VALIDATION_ERROR', errors: {} } }) |

### `core/layout`
*Всего тестов: 6*

#### `app-layout.component.spec`
*Компонент/Сервис: `AppLayoutComponent` | Тестов: 6*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create` | Проверяет, что компонент AppLayoutComponent успешно создаётся. Все зависимости замоканы: AuthStateService, AuthApiService, Router, UserSettingsApiService, FilesApiService, NotificationService, PushService, PwaInstallService, ThemeService, TranslateService. | Моки для всех зависимостей; компонент создаётся через TestBed.createComponent | Создание компонента | fixture.componentInstance существует (truthy) |
| 2 | `should show plan label` | Проверяет отображение названия тарифного плана. По умолчанию 'Free', при установке plan='gold' отображается 'Gold'. | mockAuthState.plan сигнал; начальное значение null, затем 'gold' | Чтение свойства planLabel() | planLabel() === 'Free' (по умолчанию), затем planLabel() === 'Gold' |
| 3 | `should toggle theme` | Проверяет, что вызов toggleTheme() делегирует вызов ThemeService.toggle(). | mockThemeService.toggle замокан | Вызов component.toggleTheme() | mockThemeService.toggle вызван 1 раз |
| 4 | `should toggle sidebar` | Проверяет открытие и закрытие боковой панели через toggleSidebar() и closeSidebar(). По умолчанию sidebar closed. | Компонент создан; sidebarOpen сигнал читается | Вызов toggleSidebar() (открытие), затем closeSidebar() (закрытие) | Изначально sidebarOpen() === false; после toggle === true; после closeSidebar === false |
| 5 | `should resend verification` | Проверяет повторную отправку письма верификации email через вызов AuthApiService.resendVerification(). | mockAuthApi.resendVerification возвращает of({ result: 'success' }) | Вызов component.resendVerification() | mockAuthApi.resendVerification вызван 1 раз |
| 6 | `should logout` | Проверяет выход из системы через вызов AuthApiService.logout(). | mockAuthApi.logout возвращает of({}) | Вызов component.logout() | mockAuthApi.logout вызван 1 раз |

### `core/notifications`
*Всего тестов: 14*

#### `notification.service.spec`
*Компонент/Сервис: `NotificationService` | Тестов: 10*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create` | Проверяет создание сервиса NotificationService. AuthStateService замокан с сигналами user ({ notifications_enabled: true }) и isAuthenticated (true). Notification API замокан глобально. | AuthStateService.mock с user={ notifications_enabled: true }, isAuthenticated=true; Notification.permission='default' | Создание экземпляра сервиса | Сервис существует (truthy) |
| 2 | `should show banner when permission is default and user wants notifications` | Проверяет, что баннер с запросом разрешения на уведомления отображается (showBanner=true), когда Permission API в состоянии 'default' и у пользователя включены уведомления. | Notification.permission='default', user.notifications_enabled=true | Чтение сигнала showBanner | showBanner() === true |
| 3 | `should not show banner when user has no notifications enabled` | Проверяет, что баннер НЕ отображается, если у пользователя отключены уведомления (notifications_enabled=false). | user.set({ notifications_enabled: false }) | Чтение showBanner после обновления сигнала user | showBanner() === false |
| 4 | `should dismiss banner` | Проверяет, что вызов dismissBanner() скрывает баннер навсегда (устанавливает showBanner в false). | Сервис создан, вызов dismissBanner() | Сброс флага показа баннера | showBanner() === false |
| 5 | `should track notified file ids` | Проверяет механизм отслеживания уже уведомлённых файлов. hasNotifiedFile возвращает false для нового ID, true после markFileNotified. | ID 'file-1' | Проверка hasNotifiedFile, затем markFileNotified, затем повторная проверка | До: false; после: true |
| 6 | `should track notified contact ids` | Проверяет механизм отслеживания уже уведомлённых контактов аналогично файлам. | ID 'contact-1' | Проверка hasNotifiedContact, затем markContactNotified, затем повторная проверка | До: false; после: true |
| 7 | `should add and dismiss in-app notifications` | Проверяет добавление внутриприложного уведомления в очередь и его удаление. show() добавляет, dismiss() удаляет по ID. | title='Title', body='Body', route='/route' | show() -> проверка queue; dismiss() -> проверка queue | Queue.length === 1; queue[0].title === 'Title', queue[0].body === 'Body'; после dismiss queue.length === 0 |
| 8 | `should dismiss all notifications` | Проверяет, что dismissAll() очищает все уведомления из очереди сразу. | Два уведомления добавлены через show() | Вызов dismissAll() | queue().length === 0 |
| 9 | `should not show notification when user has them disabled` | Проверяет, что если у пользователя отключены уведомления, show() не добавляет уведомление в очередь. | user.set({ notifications_enabled: false }); вызов show('Title', 'Body') | Попытка добавить уведомление при отключённых уведомлениях | queue().length === 0 |
| 10 | `should limit queue to 5 items` | Проверяет, что размер очереди уведомлений ограничен 5 элементами — при добавлении 10 уведомлений в очереди остаётся только 5. | Цикл из 10 вызовов show() | Добавление 10 уведомлений | queue().length === 5 |

#### `push.service.spec`
*Компонент/Сервис: `PushService` | Тестов: 4*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create` | Проверяет создание сервиса PushService для работы с push-уведомлениями. | PushService проинициализирован с HttpClient и HttpTestingController | Создание экземпляра | Сервис существует (truthy) |
| 2 | `should report not supported in test environment` | Проверяет, что в тестовом окружении (где нет serviceWorker/navigator.serviceWorker) isSupported возвращает false. | Тестовое окружение без поддержки ServiceWorker | Чтение свойства isSupported | isSupported === false |
| 3 | `should silently skip subscribe when not supported` | Проверяет, что при отсутствии поддержки push-уведомлений вызов subscribe() резолвится в undefined без ошибки. | Окружение без поддержки push | Вызов service.subscribe() | Promise резолвится в undefined |
| 4 | `should silently skip unsubscribe when not supported` | Проверяет, что при отсутствии поддержки push-уведомлений вызов unsubscribe() также резолвится в undefined. | Окружение без поддержки push | Вызов service.unsubscribe() | Promise резолвится в undefined |

### `core/services`
*Всего тестов: 11*

#### `device.service.spec`
*Компонент/Сервис: `DeviceService` | Тестов: 3*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create` | Проверяет создание сервиса DeviceService для идентификации устройства. | DeviceService проинициализирован, localStorage очищен | Создание экземпляра | Сервис существует (truthy) |
| 2 | `should generate and persist device id` | Проверяет, что getDeviceId() генерирует строковый ID устройства при первом вызове и возвращает тот же ID при повторных вызовах (персистентность). | localStorage очищен | Два последовательных вызова getDeviceId() | id1 — строка (truthy); id2 === id1 (тот же ID) |
| 3 | `should detect desktop device type` | Проверяет определение типа устройства на основе userAgent и platform. Для Linux x86_64 определяет Desktop/Linux. | navigator.userAgent = 'Mozilla/5.0 (X11; Linux x86_64)', navigator.platform = 'Linux' | Вызов getDeviceType() | type содержит 'Desktop' и 'Linux' |

#### `pwa-install.service.spec`
*Компонент/Сервис: `PwaInstallService` | Тестов: 3*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create` | Проверяет создание сервиса PwaInstallService для установки PWA. | PwaInstallService проинициализирован, TestBed без провайдеров | Создание экземпляра | Сервис существует (truthy) |
| 2 | `should not show install UI by default` | Проверяет, что по умолчанию showInstallUI() возвращает false (интерфейс установки PWA не показывается без события beforeinstallprompt). | Сервис создан без события beforeinstallprompt | Чтение сигнала showInstallUI | showInstallUI() === false |
| 3 | `should run install without prompt` | Проверяет, что при отсутствии deferredPrompt вызов install() не вызывает ошибку и резолвится в undefined. | deferredPrompt отсутствует (null) | Вызов service.install() | Promise резолвится в undefined |

#### `theme.service.spec`
*Компонент/Сервис: `ThemeService` | Тестов: 3*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should default to light theme` | Проверяет, что при отсутствии сохранённой темы в localStorage сервис использует светлую тему (isDark=false, класс theme-dark не установлен). | localStorage очищен, document.documentElement.classList очищен от theme-dark | Создание сервиса, чтение isDark и classList | isDark() === false; theme-dark отсутствует у html |
| 2 | `should toggle theme` | Проверяет переключение темы: toggle() переключает с тёмной на светную и обратно, сохраняя состояние в localStorage и устанавливая/убирая CSS-класс theme-dark у html. | Сервис создан, затем вызов toggle() дважды | Переключение темы 2 раза | После 1-го toggle: isDark=true, classList.contains('theme-dark')=true, localStorage='dark'; после 2-го: isDark=false, класс убран, localStorage='light' |
| 3 | `should restore dark theme from localStorage` | Проверяет, что если в localStorage сохранено 'dark', то при инициализации сервиса восстанавливается тёмная тема. | localStorage.setItem('app-theme', 'dark') перед созданием сервиса | Создание сервиса | isDark() === true; document.documentElement содержит класс 'theme-dark' |

#### `version-check.service.spec`
*Компонент/Сервис: `VersionCheckService` | Тестов: 2*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create` | Проверяет создание сервиса VersionCheckService для проверки версии приложения. | VersionCheckService проинициализирован | Создание экземпляра | Сервис существует (truthy) |
| 2 | `should init without build hash` | Проверяет, что init() не выбрасывает исключение, когда __BUILD_HASH__ не определён (undefined) — ситуация локальной разработки. | (window as any).__BUILD_HASH__ = undefined | Вызов service.init() | Ошибка не выбрасывается |

### `features/activity`
*Всего тестов: 5*

#### `activity.component.spec`
*Компонент/Сервис: `ActivityComponent` | Тестов: 5*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create` | Проверяет, что компонент Activity создаётся без ошибок | Мок ActivityApiService.list возвращает Observable с пустым списком элементов и пагинацией | Создание компонента через TestBed.createComponent | Компонент существует (fixture.componentInstance должен быть truthy) |
| 2 | `should load activity on init` | Проверяет, что при инициализации компонента вызывается загрузка списка активностей | Мок ActivityApiService.list возвращает Observable с пустыми данными | Вызов fixture.detectChanges() — запуск ngOnInit | mockActivityApi.list вызван ровно один раз с параметром 1 (первая страница) |
| 3 | `should set totalPages from pagination` | Проверяет, что компонент правильно вычисляет общее количество страниц на основе данных пагинации с сервера | ActivityApiService.list возвращает 1 элемент и пагинацию (page=1, per_page=10, total=25) | Создание компонента и detectChanges | totalPages() === 3; logs().length === 1 |
| 4 | `should navigate to a page` | Проверяет, что при вызове goToPage обновляется номер текущей страницы и перезагружаются данные | Пустые данные от API, вызов goToPage(3) | fixture.componentInstance.goToPage(3) | page() === 3; mockActivityApi.list вызван с параметром 3 |
| 5 | `should return icon for known actions` | Проверяет, что функция actionIcon возвращает корректные эмодзи-иконки для разных типов действий | Строки 'uploaded', 'downloaded', 'deleted', 'unknown_action' | Вызов icon('uploaded'), icon('downloaded'), icon('deleted'), icon('unknown_action') | 'uploaded' -> '☁️', 'downloaded' -> '⬇️', 'deleted' -> '🗑️', 'unknown_action' -> '📋' |

### `features/admin`
*Всего тестов: 28*

#### `admin.component.spec`
*Компонент/Сервис: `AdminComponent` | Тестов: 28*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create` | Проверяет, что компонент Admin создаётся без ошибок | Стандартная конфигурация TestBed с моками AdminApiService и SupportApiService | Создание компонента через TestBed.createComponent | fixture.componentInstance должен быть truthy |
| 2 | `should load stats on creation` | Проверяет, что при создании компонента автоматически загружается статистика | AdminApiService.getStats мокнут и возвращает { total_users: 10, active_today: 5, storage_used_gb: 20 } | Создание компонента | mockAdminApi.getStats был вызван |
| 3 | `should load users on creation` | Проверяет, что при создании компонента автоматически загружается список пользователей | AdminApiService.getUsers мокнут и возвращает пустой список | Создание компонента | mockAdminApi.getUsers был вызван |
| 4 | `should set active tab` | Проверяет, что вызов setTab меняет активную вкладку | Вызов setTab('users') | fixture.componentInstance.setTab('users') | activeTab() === 'users' |
| 5 | `should load support tickets on support tab` | Проверяет, что при переключении на вкладку поддержки загружаются тикеты | Вызов setTab('support') | fixture.componentInstance.setTab('support') | mockSupportApi.adminGetTickets был вызван |
| 6 | `should load suggestions on suggestions tab` | Проверяет, что при переключении на вкладку предложений загружаются предложения | Вызов setTab('suggestions') | fixture.componentInstance.setTab('suggestions') | mockSupportApi.adminGetSuggestions был вызван |
| 7 | `should save plan` | Проверяет, что функция savePlan отправляет запрос на обновление тарифного плана пользователя | editingPlan установлен в { 'user-1': 'gold' }, вызов savePlan('user-1') | fixture.componentInstance.savePlan('user-1') | mockAdminApi.updatePlan вызван с ('user-1', 'gold') |
| 8 | `should toggle block` | Проверяет, что функция toggleBlock отправляет запрос на блокировку/разблокировку пользователя | Вызов toggleBlock('user-1') | fixture.componentInstance.toggleBlock('user-1') | mockAdminApi.blockUser вызван с 'user-1' |
| 9 | `should generate reset link` | Проверяет, что generateResetLink отправляет запрос на генерацию ссылки сброса пароля | Вызов generateResetLink('user-1') | fixture.componentInstance.generateResetLink('user-1') | mockAdminApi.generateResetLink вызван с 'user-1' |
| 10 | `should reset sessions after confirm` | Проверяет, что после подтверждения сброса сессий отправляется соответствующий запрос | Вызов askResetSessions('user-1'), затем confirmResetSessions('user-1') | confirmReset() возвращает 'user-1'; confirmResetSessions('user-1') | mockAdminApi.resetSessions вызван с 'user-1' |
| 11 | `should open and close ticket` | Проверяет открытие тикета и его закрытие | Вызов openTicket('t-1'), затем closeTicket() | openTicket('t-1'), closeTicket() | mockSupportApi.adminGetTicket вызван с 't-1'; после closeTicket activeTicket() === null |
| 12 | `should take ticket` | Проверяет, что администратор может взять тикет в работу | Вызов takeTicket('t-1') | fixture.componentInstance.takeTicket('t-1') | mockSupportApi.adminTakeTicket вызван с 't-1' |
| 13 | `should set ticket awaiting confirmation` | Проверяет, что администратор может перевести тикет в статус ожидания подтверждения | Вызов awaitConfirmation('t-1') | fixture.componentInstance.awaitConfirmation('t-1') | mockSupportApi.adminAwaitConfirmation вызван с 't-1' |
| 14 | `should send admin message` | Проверяет отправку сообщения администратором в тикете | activeTicket = { id: 't-1', messages: [] }, adminMessageForm = { body: 'Hello' }, вызов sendAdminMessage() | fixture.componentInstance.sendAdminMessage() | mockSupportApi.adminSendMessage вызван с ('t-1', 'Hello', []) |
| 15 | `should open and close suggestion` | Проверяет открытие и закрытие предложения | Вызов openSuggestion('s-1'), затем closeSuggestion() | openSuggestion('s-1'), closeSuggestion() | mockSupportApi.adminGetSuggestion вызван с 's-1'; activeSuggestion() === null |
| 16 | `should toggle suggestion status` | Проверяет переключение статуса предложения | toggleSuggestionStatus('s-1', 'new'), затем toggleSuggestionStatus('s-2', 'accepted') | fixture.componentInstance.toggleSuggestionStatus('s-1', 'new'); toggleSuggestionStatus('s-2', 'accepted') | Первый -> adminUpdateSuggestionStatus('s-1', 'accepted'); второй -> adminUpdateSuggestionStatus('s-2', 'new') |
| 17 | `should add suggestion comment` | Проверяет добавление комментария к предложению | activeSuggestion = { id: 's-1' }, commentForm = { body: 'Great idea!' }, вызов addSuggestionComment('s-1') | fixture.componentInstance.addSuggestionComment('s-1') | mockSupportApi.adminAddSuggestionComment вызван с ('s-1', 'Great idea!') |
| 18 | `should open notify dialog for user` | Проверяет открытие диалога уведомления для пользователя | Вызов openNotifyDialog({ id: 'u-1', email: 'u@test.com' }) | fixture.componentInstance.openNotifyDialog({ id: 'u-1', email: 'u@test.com' }) | notifyTarget() === { userId: 'u-1', email: 'u@test.com' } |
| 19 | `should open broadcast dialog` | Проверяет открытие диалога широковещательного уведомления | Вызов openBroadcastDialog() | fixture.componentInstance.openBroadcastDialog() | notifyTarget() === 'all' |
| 20 | `should send notify to user` | Проверяет отправку уведомления пользователю | notifyTarget = { userId: 'u-1', email: 'u@test.com' }, notifyTitle = 'Title', notifyBody = 'Body', вызов sendNotify() | fixture.componentInstance.sendNotify() | mockAdminApi.notifyUser вызван с ('u-1', 'Title', 'Body') |
| 21 | `should send broadcast` | Проверяет отправку широковещательного уведомления | notifyTarget = 'all', notifyTitle = 'Broadcast', notifyBody = 'Hello all', вызов sendNotify() | fixture.componentInstance.sendNotify() | mockAdminApi.notifyAll вызван с ('Broadcast', 'Hello all') |
| 22 | `should format date` | Проверяет форматирование ISO-даты | Строка даты '2024-01-15T10:30:00Z' | fixture.componentInstance.formatDate('2024-01-15T10:30:00Z') | Результат содержит подстроку '15' |
| 23 | `should return plan label` | Проверяет читаемое название тарифного плана | 'gold' и null | fixture.componentInstance.planLabel('gold'), затем planLabel(null) | 'gold' -> 'Gold'; null -> '—' |
| 24 | `should return status label` | Проверяет локализованную метку статуса | 'active' и 'unknown' | fixture.componentInstance.statusLabel('active'), затем statusLabel('unknown') | 'active' -> содержит 'Активен'; 'unknown' -> возвращается как есть |
| 25 | `should handle setSupportStatusFilter` | Проверяет установку фильтра статуса поддержки | Вызов setSupportStatusFilter('in_progress') | fixture.componentInstance.setSupportStatusFilter('in_progress') | supportStatusFilter() === 'in_progress'; adminGetTickets вызван с (1, 'in_progress') |
| 26 | `should handle setSuggestionsFilter` | Проверяет установку фильтра статуса предложений | Вызов setSuggestionsFilter('accepted') | fixture.componentInstance.setSuggestionsFilter('accepted') | suggestionsStatusFilter() === 'accepted'; adminGetSuggestions вызван с (1, 'accepted') |
| 27 | `should download attachment` | Проверяет скачивание вложения | Вызов downloadAttachment('t-1', 'a-1', 'doc.pdf') | fixture.componentInstance.downloadAttachment('t-1', 'a-1', 'doc.pdf') | mockSupportApi.adminGetAttachmentUrl вызван с ('t-1', 'a-1') |
| 28 | `should track by id` | Проверяет trackById для ngFor | Вызов trackById(0, { id: 'abc' }) и trackById(1, { id: 42 }) | fixture.componentInstance.trackById(0, { id: 'abc' }); trackById(1, { id: 42 }) | Первый возвращает 'abc'; второй возвращает 42 |

### `features/auth`
*Всего тестов: 51*

#### `account-blocked.component.spec`
*Компонент/Сервис: `AccountBlockedComponent` | Тестов: 4*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create` | Проверяет, что компонент AccountBlocked создаётся без ошибок | Стандартная конфигурация TestBed с моками AuthApiService, AuthStateService, Router | Создание компонента | Компонент существует |
| 2 | `should resend verification on success` | Проверяет успешную повторную отправку письма верификации | mockAuthApi.resendVerification возвращает { result: 'success', message: 'Email sent', data: {} } | Вызов resend() | resendVerification вызван; successMsg() === 'Email sent'; resending() === false |
| 3 | `should set error on resend failure` | Проверяет обработку ошибки при повторной отправке верификации | mockAuthApi.resendVerification выбрасывает ошибку с message: 'Rate limited' | Вызов resend() | errorMsg() === 'Rate limited'; resending() === false |
| 4 | `should logout` | Проверяет выход из системы | mockAuthApi.logout возвращает пустой Observable | Вызов logout() | mockAuthApi.logout вызван; mockAuthState.clearUser вызван; mockRouter.navigate вызван с ['/login'] |

#### `forgot-password.component.spec`
*Компонент/Сервис: `ForgotPasswordComponent` | Тестов: 13*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create` | Проверяет создание компонента | Стандартная конфигурация TestBed с моком AuthApiService | Создание компонента | Компонент существует |
| 2 | `should start on email step` | Проверяет начальный шаг процесса восстановления пароля | Созданный компонент | Чтение значения step() | step() === 'email' |
| 3 | `should validate email form` | Проверяет валидацию поля email | email пустой; затем 'test@test.com' | email?.setValue(''), проверка valid; setValue('test@test.com'), проверка valid | Пустой — valid === false; корректный — valid === true |
| 4 | `should send email and advance to code step on success` | Проверяет отправку email для восстановления и переход к шагу ввода кода | mockAuthApi.forgotPassword возвращает пустой Observable; форма email заполнена 'test@test.com' | submitEmail() | forgotPassword вызван с 'test@test.com'; step() === 'code' |
| 5 | `should advance to code step even on error` | Проверяет переход к шагу кода даже при ошибке API (защита от перечисления email) | mockAuthApi.forgotPassword выбрасывает ошибку; форма email заполнена | submitEmail() | step() === 'code' (переход происходит независимо от ответа сервера) |
| 6 | `should not submit email form when invalid` | Проверяет, что при невалидной форме email API не вызывается | Пустая форма email | submitEmail() | forgotPassword НЕ вызван |
| 7 | `should validate code as 6 digits` | Проверяет, что поле кода требует ровно 6 цифр | '12345' (5 цифр), затем '123456' (6 цифр) | code?.setValue('12345'), проверка valid; setValue('123456'), проверка valid | '12345' — valid === false; '123456' — valid === true |
| 8 | `should verify code and advance to password step` | Проверяет успешную верификацию кода и переход к шагу ввода пароля | mockAuthApi.verifyResetToken возвращает { data: { token: 'reset-token-123' } }; step = 'code'; submittedEmail = 'test@test.com'; codeForm = { code: '123456' } | submitCode() | verifyResetToken вызван с ('123456', 'test@test.com'); step() === 'password'; resetToken === 'reset-token-123' |
| 9 | `should show error on invalid code` | Проверяет отображение ошибки при неверном коде | mockAuthApi.verifyResetToken выбрасывает ошибку; step = 'code'; codeForm = { code: '000000' } | submitCode() | error() === 'auth.forgot.code_invalid'; step() остаётся 'code' |
| 10 | `should validate password confirmation match` | Проверяет совпадение пароля и подтверждения | passwordForm = { password: 'newpass123', password_confirmation: 'different' } | Установка значений формы | form.valid === false; form.errors?.['mismatch'] === true |
| 11 | `should reset password and show done step` | Проверяет успешный сброс пароля | mockAuthApi.resetPassword возвращает пустой Observable; step = 'password'; resetToken = 'tok-1'; passwordForm валидна | submitPassword() | resetPassword вызван с ('tok-1', 'newpass123', 'newpass123'); step() === 'done' |
| 12 | `should show error on reset failure` | Проверяет отображение ошибки при неудачном сбросе пароля | mockAuthApi.resetPassword выбрасывает ошибку с message: 'Token expired'; форма валидна | submitPassword() | error() === 'Token expired' |
| 13 | `should not submit password form when invalid` | Проверяет, что при невалидной форме сброса API не вызывается | step = 'password', форма не заполнена | submitPassword() | resetPassword НЕ вызван |

#### `login.component.spec`
*Компонент/Сервис: `LoginComponent` | Тестов: 10*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create` | Проверяет создание компонента Login | Стандартная конфигурация TestBed | Создание компонента | Компонент существует |
| 2 | `should have form with email, password and remember controls` | Проверяет, что форма содержит все необходимые поля | Созданный компонент | Проверка наличия контролов | form.contains('email') === true; form.contains('password') === true; form.contains('remember') === true |
| 3 | `should validate email as required` | Проверяет обязательность поля email | Поле email установлено в пустую строку | email?.setValue('') | email.valid === false; email.errors?.['required'] === true |
| 4 | `should validate email format` | Проверяет корректность формата email | 'invalid' | email?.setValue('invalid') | email.valid === false; email.errors?.['email'] === true |
| 5 | `should validate password min length` | Проверяет минимальную длину пароля | 'short' | password?.setValue('short') | password.valid === false; password.errors?.['minlength'] truthy |
| 6 | `should call authApi.login on valid submit` | Проверяет успешный вход | mockAuthApi.login возвращает { result: 'success', data: { user: { id: '1', account_status: 'active' }, token: 'token-123' } }; форма валидна | submit() | login вызван; setUser вызван; navigateByUrl('/files') |
| 7 | `should navigate to /account-blocked when user is blocked` | Проверяет перенаправление на страницу блокировки при blocked_unverified_email | mockAuthApi.login возвращает пользователя с account_status: 'blocked_unverified_email' | submit() | navigate с ['/account-blocked'] |
| 8 | `should show server error on ACCOUNT_BLOCKED api error` | Проверяет перенаправление при ошибке ACCOUNT_BLOCKED | mockAuthApi.login выбрасывает ошибку с data: { code: 'ACCOUNT_BLOCKED' } | submit() | navigate с ['/account-blocked'] |
| 9 | `should show server error on login failure` | Проверяет отображение ошибки при неверных учётных данных | mockAuthApi.login выбрасывает ошибку с message: 'Invalid credentials' | submit() | serverError() === 'Invalid credentials' |
| 10 | `should not submit when form is invalid` | Проверяет, что при невалидной форме вход не выполняется | Пустая форма | submit() | login НЕ вызван |

#### `pin-setup.component.spec`
*Компонент/Сервис: `PinSetupComponent` | Тестов: 6*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create` | Проверяет создание компонента PinSetup | Стандартная конфигурация TestBed с моком Router | Создание компонента | Компонент существует |
| 2 | `should validate pin as 4-6 digits` | Проверяет валидацию PIN: только 4-6 цифр | '123' (3 цифры), '123456' (6 цифр), '' (пусто) | pin?.setValue('123'), setValue('123456'), setValue('') | '123' — errors.pattern truthy; '123456' — valid === true; '' — errors.required |
| 3 | `should validate pin confirmation match` | Проверяет совпадение PIN и подтверждения | Форма { pin: '1234', pin_confirm: '5678' } | Установка значений формы | form.errors?.['pinMismatch'] === true |
| 4 | `should store pin locally and navigate on submit` | Проверяет сохранение PIN в localStorage и навигацию | Форма { pin: '1234', pin_confirm: '1234' } | submit() | localStorage.getItem('fs_device_pin') === btoa('1234'); navigate(['/files']) |
| 5 | `should skip and navigate` | Проверяет пропуск настройки PIN | Нет | skip() | navigate(['/files']) |
| 6 | `should not submit invalid form` | Проверяет, что при невалидной форме навигация не происходит | Пустая форма | submit() | navigate НЕ вызван |

#### `register.component.spec`
*Компонент/Сервис: `RegisterComponent` | Тестов: 9*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create` | Проверяет создание компонента Register | Стандартная конфигурация TestBed | Создание компонента | Компонент существует |
| 2 | `should have password confirmation mismatch validator` | Проверяет совпадение пароля и подтверждения | Форма { email: 'test@test.com', password: 'pass1234', password_confirmation: 'different', privacyAccepted: true } | Установка значений | form.errors?.['passwordMismatch'] === true |
| 3 | `should validate privacyAccepted as required true` | Проверяет обязательность согласия с приватностью | Контрол privacyAccepted | markAsTouched(), проверка; setValue(true), проверка | Без отметки — privacyError() === true; с отметкой — false |
| 4 | `should patch email from input` | Проверяет подстановку email из @Input | Установка input email = 'invited@test.com' | detectChanges() | form.get('email')?.value === 'invited@test.com' |
| 5 | `should register and navigate to /files` | Проверяет успешную регистрацию | mockAuthApi.register возвращает { data: { user: { id: '1' }, token: 'tok' } }; форма валидна | submit() | register вызван; setUser; navigate(['/files']) |
| 6 | `should accept invite after registration` | Проверяет принятие приглашения после регистрации | mockAuthApi.register возвращает пользователя; mockInvApi.accept возвращает пустой Observable; invite = 'invite-token' | submit() | register вызван; mockInvApi.accept вызван с 'invite-token'; navigate(['/files']) |
| 7 | `should set server error on registration failure` | Проверяет отображение ошибки при неудачной регистрации | mockAuthApi.register выбрасывает ошибку с message: 'Email taken' | submit() | serverError() === 'Email taken' |
| 8 | `should set field errors on validation error` | Проверяет установку ошибок на поля при ошибке валидации с сервера | mockAuthApi.register выбрасывает ошибку с data: { code: 'VALIDATION_ERROR', errors: { email: ['Email already in use'] } } | submit() | serverError() === null |
| 9 | `should not submit when form is invalid` | Проверяет, что при невалидной форме регистрация не выполняется | Пустая форма | submit() | register НЕ вызван |

#### `reset-password.component.spec`
*Компонент/Сервис: `ResetPasswordComponent` | Тестов: 9*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create` | Проверяет создание компонента с токеном в URL | Параметр URL token = 'url-token'; verifyResetToken возвращает { data: { token: 'real-token' } } | Создание компонента | Компонент существует |
| 2 | `should go to error state when no token in url` | Проверяет состояние ошибки при отсутствии токена | Параметр URL token = '' | detectChanges() | state() === 'error'; error() === 'auth.reset.no_token' |
| 3 | `should verify token and go to password state` | Проверяет успешную верификацию токена | Параметр URL token = 'url-token'; verifyResetToken возвращает { data: { token: 'real-token' } } | detectChanges() | verifyResetToken вызван с 'url-token'; state() === 'password' |
| 4 | `should go to error state when token verification fails` | Проверяет состояние ошибки при неудачной верификации | url-token = 'bad-token'; verifyResetToken выбрасывает ошибку | detectChanges() | state() === 'error'; error() === 'auth.reset.token_invalid' |
| 5 | `should validate password min length` | Проверяет минимальную длину пароля | Пароль = 'short' | pwd?.setValue('short') | pwd.errors?.['minlength'] truthy |
| 6 | `should validate password confirmation match` | Проверяет совпадение пароля | Форма { password: 'newpass123', password_confirmation: 'different' } | Установка значений | form.errors?.['mismatch'] === true |
| 7 | `should reset password and go to done state` | Проверяет успешный сброс пароля | Токен верифицирован; resetPassword возвращает пустой Observable; форма валидна | submit() | resetPassword вызван; state() === 'done' |
| 8 | `should show error on reset failure` | Проверяет отображение ошибки при неудачном сбросе | resetPassword выбрасывает ошибку с message: 'Token expired'; форма валидна | submit() | error() === 'Token expired' |
| 9 | `should not submit password form when invalid` | Проверяет, что при невалидной форме сброса API не вызывается | Форма не заполнена | submit() | resetPassword НЕ вызван |

### `features/contacts`
*Всего тестов: 8*

#### `contacts.component.spec`
*Компонент/Сервис: `ContactsComponent` | Тестов: 8*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create` | Проверяет, что компонент создаётся без ошибок. Создаётся экземпляр компонента через TestBed. | Мок ContactsApiService с методом list, возвращающим пустой список; провайдер translate | Экземпляр компонента создан | fixture.componentInstance существует и является truthy |
| 2 | `should load contacts on init` | Проверяет, что при инициализации компонента происходит загрузка списка контактов через API. | Мок ContactsApiService.list возвращает пустой список; компонент создаётся, detectChanges триггерит ngOnInit | Вызов mockContactsApi.list с undefined | mockContactsApi.list вызван ровно один раз с аргументом undefined |
| 3 | `should validate add form` | Проверяет валидацию формы добавления контакта: обязательное поле name, валидация email, форма валидна при корректных данных. | Мок list возвращает пустой массив; форма addForm компонента | Проверка ошибок формы через form.get().errors | name обязателен (required), email с 'bad' даёт ошибку email, форма valid = true при name:'Test' + email:'test@test.com' |
| 4 | `should detect duplicate email before adding` | Проверяет, что при попытке добавить контакт с email, уже существующим в списке, добавление не происходит и выводится ошибка дубликата. | Мок list возвращает контакт {id:'1',name:'Existing',email:'dup@test.com'}; форма заполняется дублирующим email; вызывается addContact() | mockContactsApi.create НЕ вызывается; addError() возвращает ключ 'contacts.duplicate_error' | create не вызван; addError() === 'contacts.duplicate_error' |
| 5 | `should add contact` | Проверяет успешное добавление нового контакта через API, когда дубликата нет. | Мок list возвращает пустой массив; мок create возвращает {invitation_sent: false}; форма заполняется name:'New', email:'new@test.com'; вызывается addContact() | mockContactsApi.create вызван с {name:'New', email:'new@test.com'} | create.toHaveBeenCalledWith({name:'New', email:'new@test.com'}) |
| 6 | `should resolve contacts` | Проверяет вызов метода resolve для разрешения неподтверждённых контактов. | Мок list возвращает пустой массив; мок resolve возвращает {newly_resolved: 2}; вызывается resolveContacts() | mockContactsApi.resolve вызван без аргументов | resolve.toHaveBeenCalled() |
| 7 | `should delete contact` | Проверяет удаление контакта после подтверждения пользователем (confirm = true). | Контакт {id:'c1',name:'Test'}; мок list возвращает [contact]; мок delete возвращает {}; confirm возвращает true; вызывается deleteContact(contact) | mockContactsApi.delete вызван с 'c1'; список contacts становится пустым | delete.toHaveBeenCalledWith('c1'); contacts().length === 0 |
| 8 | `should not delete contact when confirm is false` | Проверяет, что при отказе пользователя в диалоге подтверждения удаление не выполняется. | Контакт {id:'c1',name:'Test'}; мок list возвращает пустой массив; confirm возвращает false; вызывается deleteContact(contact) | mockContactsApi.delete НЕ вызван | delete.not.toHaveBeenCalled() |

### `features/files`
*Всего тестов: 93*

#### `add-to-shared-folder-dialog.component.spec`
*Компонент/Сервис: `AddToSharedFolderDialogComponent` | Тестов: 5*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create and load folders` | Проверяет, что диалог создаётся и при инициализации загружает список общих папок для указанного файла. | Мок SharedFoldersApiService.getFileSharedFolders возвращает {folder_ids:['sf-1'], folders:[{id:'sf-1',is_in:true},{id:'sf-2',is_in:false}]}; input fileId='file-1' | getFileSharedFolders вызван с 'file-1'; компонент создан | Компонент truthy; getFileSharedFolders.toHaveBeenCalledWith('file-1') |
| 2 | `should have pre-checked folder ids` | Проверяет, что папки, в которых файл уже находится (is_in: true), предварительно отмечены в checkedIds. | Мок как выше; fileId='file-1'; компонент создан, папки загружены | Проверка checkedIds | checkedIds().has('sf-1') === true (предотмечена); has('sf-2') === false (не отмечена) |
| 3 | `should toggle folder selection` | Проверяет переключение выбора папки: после вызова toggleFolder состояние checkedIds меняется. | Мок как выше; событие Event с target.checked = true; вызов toggleFolder('sf-2', event) | set-состояние checkedIds | checkedIds().has('sf-2') === true |
| 4 | `should build tree from folders` | Проверяет построение дерева папок из плоского списка. | Мок с двумя папками; fileId='file-1' | tree() — вычисляемое дерево | tree().length === 2 |
| 5 | `should save selection` | Проверяет сохранение выбора папок: вызов API updateFileSharedFolders с корректными параметрами. | Мок updateFileSharedFolders возвращает success; checkedIds содержит 'sf-1'; вызван save() | updateFileSharedFolders('file-1', ['sf-1']) | updateFileSharedFolders.toHaveBeenCalledWith('file-1', ['sf-1']) |

#### `add-version-dialog.component.spec`
*Компонент/Сервис: `AddVersionDialogComponent` | Тестов: 8*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create` | Проверяет создание компонента диалога добавления версии файла. | Мок FilesApiService с initVersionUpload/completeVersionUpload; inputs: fileId='file-1', mimeType='text/plain' | Экземпляр компонента | fixture.componentInstance truthy |
| 2 | `should start in idle phase` | Проверяет начальное состояние фазы загрузки — 'idle'. | Компонент создан с fileId='file-1', mimeType='text/plain' | phase() сигнал | phase() === 'idle' |
| 3 | `should return accept attribute based on mime type` | Проверяет, что acceptAttr() возвращает правильный MIME-фильтр для разных типов: image/*, video/*, audio/*, или пустую строку для неизвестного. | Компонент с mimeType последовательно 'image/png', 'video/mp4', 'audio/mp3', 'application/pdf' | acceptAttr() для каждого типа | 'image/png' → 'image/*'; 'video/mp4' → 'video/*'; 'audio/mp3' → 'audio/*'; 'application/pdf' → '' |
| 4 | `should close on overlay click when not uploading` | Проверяет, что клик по оверлею закрывает диалог, если не идёт загрузка. | Компонент создан, фаза 'idle'; подписчик на closed; вызов onOverlayClick() | Событие closed | closed эмиттер сработал (toHaveBeenCalled) |
| 5 | `should not close on overlay click when uploading` | Проверяет, что клик по оверлею НЕ закрывает диалог во время загрузки. | Компонент создан; phase принудительно установлена в 'uploading'; подписчик на closed; вызов onOverlayClick() | Событие closed | closed НЕ сработал (not.toHaveBeenCalled) |
| 6 | `should not close on close button when uploading` | Проверяет, что кнопка закрытия НЕ работает во время загрузки. | Компонент создан; phase = 'uploading'; подписчик на closed; вызов onClose() | Событие closed | closed НЕ сработал |
| 7 | `should handle drag over and leave` | Проверяет установку флага isDragOver при событии dragover. | Компонент создан; вызов onDragOver(new DragEvent('dragover')) | isDragOver() сигнал | isDragOver() === true |
| 8 | `should set error phase on failed init` | Проверяет, что при неуспешной инициализации загрузки (ответ с result:'error') фаза переключается в 'error'. | Мок initVersionUpload возвращает {result:'error',message:'Failed',data:{code:'ERROR'}}; file размером 4 байта; вызов приватного startUpload(file) | phase() сигнал | phase() === 'error' |

#### `create-link-dialog.component.spec`
*Компонент/Сервис: `CreateLinkDialogComponent` | Тестов: 8*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create` | Проверяет создание компонента диалога создания ссылки. | Мок FilesApiService.createLink; input fileId='f1' | Экземпляр компонента | fixture.componentInstance truthy |
| 2 | `should validate ttl_hours as required and min 1` | Проверяет валидацию поля ttl_hours: значение 0 — ошибка min, null — ошибка required, 1 — валидно. | Форма; ttl.setValue(0), null, 1 | Проверки errors и valid | 0 → errors.min truthy; 1 → valid true; null → errors.required true |
| 3 | `should create link and set createdLink` | Проверяет успешное создание ссылки: API вызывается, createdLink устанавливается, submitting сбрасывается. | Мок createLink возвращает {data:{link:{id:'l1',url:'https://example.com/l1'}}}; input fileId='f1'; форма по умолчанию (ttl_hours=12); вызов submit() | createLink('f1', 12, false); createdLink().url; submitting() | createLink.toHaveBeenCalledWith('f1',12,false); createdLink().url === 'https://example.com/l1'; submitting() === false |
| 4 | `should set error on create failure` | Проверяет, что при ошибке создания ссылки устанавливается сообщение об ошибке. | Мок createLink выбрасывает throwError с {message:'File not found'}; input fileId='f1'; вызов submit() | error() сигнал | error() === 'File not found' |
| 5 | `should not submit when form is invalid` | Проверяет, что при невалидной форме (ttl_hours=null) submit не вызывает API. | ttl_hours=null; вызов submit() | mockFilesApi.createLink | createLink.not.toHaveBeenCalled() |
| 6 | `should copy link via clipboard API when available` | Проверяет копирование URL ссылки в буфер обмена через Clipboard API и установку флага copied. | Мок navigator.clipboard.writeText; createdLink установлен с url='https://example.com/l1'; вызов copyLink() | writeText вызван с URL; tick() для flush микрозадач; copied() | writeText.toHaveBeenCalledWith('https://example.com/l1'); copied() === true |
| 7 | `should format null expiry as never` | Проверяет форматирование срока истечения: null → строка с 'never' (бессрочно). | Вызов formatExpiry(null) | Отформатированная строка | result содержит 'never' |
| 8 | `should format valid expiry as date string` | Проверяет форматирование даты истечения: строка даты → отформатированная строка, содержащая год. | Вызов formatExpiry('2026-01-15T10:00:00Z') | Отформатированная строка | result содержит '2026' |

#### `share-contact-dialog.component.spec`
*Компонент/Сервис: `ShareContactDialogComponent` | Тестов: 4*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create and load contacts` | Проверяет создание диалога и загрузку списка контактов при инициализации. | Мок FilesApiService.shareToContact; мок ContactsApiService.list возвращает пустой список; input fileId='file-1'; fixture.detectChanges() | mockContactsApi.list вызван с undefined; компонент существует | Компонент truthy; list.toHaveBeenCalledWith(undefined) |
| 2 | `should select a contact` | Проверяет выбор контакта: установка selectedId при вызове select(). | Контакт {id:'c1',name:'John',...}; вызов select(contact) | selectedId() сигнал | selectedId() === 'c1' |
| 3 | `should submit and share file` | Проверяет отправку: API shareToContact вызывается с fileId и выбранным contactId. | Мок shareToContact возвращает success; selectedId='c1'; вызов submit() | shareToContact('file-1', 'c1') | shareToContact.toHaveBeenCalledWith('file-1', 'c1') |
| 4 | `should not submit without selection` | Проверяет, что при отсутствии выбранного контакта submit не вызывает API. | Компонент создан; selectedId не установлен; вызов submit() | mockFilesApi.shareToContact | shareToContact.not.toHaveBeenCalled() |

#### `file-detail.component.spec`
*Компонент/Сервис: `FileDetailComponent` | Тестов: 27*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create` | Проверяет создание компонента деталей файла. | Моки: FilesApiService.get, OrganizationApiService, SharedFoldersApiService, CommentsApiService, AuthStateService, Router, ActivatedRoute; input id='f-1' | Экземпляр компонента | fixture.componentInstance truthy |
| 2 | `should load file on init` | Проверяет, что при инициализации компонента вызывается API загрузки файла. | Мок get возвращает файл; input id='f-1'; detectChanges() | mockFilesApi.get('f-1') | get.toHaveBeenCalledWith('f-1') |
| 3 | `should show loading while fetching file` | Проверяет начальное состояние loading() — false после загрузки, true в процессе. | Мок get возвращает файл; input id='f-1'; loading() проверяется до и после detectChanges | loading() сигнал | loading() === false (после загрузки) |
| 4 | `should compute display title` | Проверяет вычисление отображаемого имени файла (displayTitle) из original_name. | file установлен с original_name='doc.txt' | displayTitle() | displayTitle() === 'doc.txt' |
| 5 | `should compute display title from selected version` | Проверяет, что при выборе версии отображается имя выбранной версии, а не основного файла. | file с версией {original_name:'v2.txt'}; selectedVersionId='v-2' | displayTitle() | displayTitle() === 'v2.txt' |
| 6 | `should compute display size` | Проверяет вычисление отображаемого размера файла. | file установлен с size=2048 | displaySize() | displaySize() === 2048 |
| 7 | `should download file` | Проверяет скачивание файла: вызов API download и открытие URL в новом окне. | Мок download возвращает {url:'https://...'}; spy на window.open; вызов download() | mockFilesApi.download('f-1') | download.toHaveBeenCalledWith('f-1') |
| 8 | `should toggle favorite` | Проверяет добавление файла в избранное, когда is_favorite=false. | file установлен с is_favorite=false; вызов toggleFavorite() | mockFilesApi.favorite('f-1') | favorite.toHaveBeenCalledWith('f-1') |
| 9 | `should unfavorite` | Проверяет удаление файла из избранного, когда is_favorite=true. | file установлен с is_favorite=true; вызов toggleFavorite() | mockFilesApi.unfavorite('f-1') | unfavorite.toHaveBeenCalledWith('f-1') |
| 10 | `should save description` | Проверяет сохранение описания файла через API updateDescription. | descriptionDraft='new description'; вызов saveDescription() | mockFilesApi.updateDescription('f-1', 'new description') | updateDescription.toHaveBeenCalledWith('f-1', 'new description') |
| 11 | `should delete file` | Проверяет удаление файла после подтверждения пользователем и переход в /folders. | window.confirm возвращает true; вызов deleteFile() | mockFilesApi.delete('f-1'); router.navigate(['/folders']) | delete.toHaveBeenCalledWith('f-1'); navigate.toHaveBeenCalledWith(['/folders']) |
| 12 | `should add tag` | Проверяет добавление тега к файлу через API attachTags. | Вызов addTag({id:'t-1',name:'important'}) | mockOrgApi.attachTags('f-1', ['t-1']) | attachTags.toHaveBeenCalledWith('f-1', ['t-1']) |
| 13 | `should remove tag` | Проверяет удаление тега из файла через API detachTags. | file с тегом {id:'t-1',name:'important'}; вызов removeTag({id:'t-1',name:'important'}) | mockOrgApi.detachTags('f-1', ['t-1']) | detachTags.toHaveBeenCalledWith('f-1', ['t-1']) |
| 14 | `should create and add tag` | Проверяет создание нового тега через API createTag при условии, что тег не найден. | tagSearchQuery='newtag'; вызов createAndAddTag() | mockOrgApi.createTag('newtag') | createTag.toHaveBeenCalledWith('newtag') |
| 15 | `should save folder selection` | Проверяет перемещение файла в выбранную папку через API moveFolder. | pendingFolderId='folder-2'; вызов saveFolderSelection() | mockFilesApi.moveFolder('f-1', 'folder-2') | moveFolder.toHaveBeenCalledWith('f-1', 'folder-2') |
| 16 | `should open and close dialogs` | Проверяет закрытие диалога шэринга после события onShared. | showShareDialog=true; вызов onShared() | showShareDialog сигнал | showShareDialog() === false |
| 17 | `should disable link` | Проверяет деактивацию ссылки через API disableLink. | links = [{id:'l-1',status:'active'}]; вызов disableLink(link) | mockFilesApi.disableLink('l-1') | disableLink.toHaveBeenCalledWith('l-1') |
| 18 | `should save version` | Проверяет обновление метаданных версии (label и comment) через API updateVersion. | versionLabelDraft='2.0'; versionCommentDraft='Big update'; вызов saveVersion({id:'v-1'}) | mockFilesApi.updateVersion('f-1', 'v-1', {version_label:'2.0', comment:'Big update'}) | updateVersion.toHaveBeenCalledWith('f-1', 'v-1', {version_label:'2.0', comment:'Big update'}) |
| 19 | `should toggle version active` | Проверяет переключение активности версии через API updateVersion с {is_active: true}. | Версия {id:'v-1', is_active:false}; вызов toggleVersionActive(version) | mockFilesApi.updateVersion('f-1', 'v-1', {is_active:true}) | updateVersion.toHaveBeenCalledWith('f-1', 'v-1', {is_active:true}) |
| 20 | `should save display name` | Проверяет сохранение отображаемого имени файла через API updateDisplayName. | displayNameDraft='Display Name'; вызов saveDisplayName() | mockFilesApi.updateDisplayName('f-1', 'Display Name') | updateDisplayName.toHaveBeenCalledWith('f-1', 'Display Name') |
| 21 | `should select version` | Проверяет выбор конкретной версии файла через установку selectedVersionId. | Вызов selectVersion('v-2') | selectedVersionId() сигнал | selectedVersionId() === 'v-2' |
| 22 | `should format size` | Проверяет хелпер formatSize: 500 → '500 B', 2048 → строка с 'KB'. | Вызов formatSize(500), formatSize(2048) | Отформатированные строки | 500 → '500 B'; 2048 → содержит 'KB' |
| 23 | `should return mime icon` | Проверяет хелпер mimeIcon: для image возвращает эмодзи с картинкой, для video — с видео. | mimeIcon('image/png'), mimeIcon('video/mp4') | Строки с эмодзи | 'image/png' → содержит '🖼'; 'video/mp4' → содержит '🎬' |
| 24 | `should check canViewInBrowser` | Проверяет, что флаг canViewInBrowser истинен при наличии view_url и подходящего mime_type. | file с mime_type='image/png' и view_url='https://...' | canViewInBrowser() | canViewInBrowser() === true |
| 25 | `should return false for canViewInBrowser without view_url` | Проверяет, что canViewInBrowser ложен при отсутствии view_url, даже при подходящем mime_type. | file с mime_type='image/png' и view_url=null | canViewInBrowser() | canViewInBrowser() === false |
| 26 | `should add to my files` | Проверяет добавление файла из общей папки в личные файлы через API addFileToMyFiles. | file с shared_folder_only=true; вызов addToMyFiles() | mockSfApi.addFileToMyFiles('f-1') | addFileToMyFiles.toHaveBeenCalledWith('f-1') |
| 27 | `should set feedback message and clear after timeout` | Проверяет установку сообщения обратной связи и его автоматическую очистку через 3 секунды. | fakeTimers; вызов showFeedback('Saved!') | feedback() сигнал; advanceTimersByTime(3000) | feedback() === 'Saved!' сразу; feedback() === null через 3с |

#### `file-list.component.spec`
*Компонент/Сервис: `FileListComponent` | Тестов: 23*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create` | Проверяет создание компонента списка файлов. | Мок FilesApiService.list (пустой ответ); FileUploadService; UrlFilesApiService; Router; ActivatedRoute | Экземпляр компонента | fixture.componentInstance truthy |
| 2 | `should load recent files on init` | Проверяет, что при инициализации компонент загружает последние файлы через API list с параметрами сортировки. | Мок list возвращает пустой массив; fixture.detectChanges() | mockFilesApi.list('all', 1, undefined, {sort_by:'date', sort_order:'desc', per_page:10}) | list.toHaveBeenCalledWith('all', 1, undefined, {sort_by:'date', sort_order:'desc', per_page:10}) |
| 3 | `should show loading state for recent files` | Проверяет отображение индикатора загрузки "Загрузка..." в шаблоне при загрузке файлов. | recentLoading=true; detectChanges() | nativeElement.textContent | Текст содержит 'Загрузка...' |
| 4 | `should show empty state when no recent files` | Проверяет отображение сообщения "Нет файлов", если список последних файлов пуст. | Мок list возвращает пустой массив; detectChanges() | nativeElement.textContent | Текст содержит 'Нет файлов' |
| 5 | `should display recent files list` | Проверяет отображение списка последних файлов с их именами. | Мок list возвращает два файла: test.pdf и photo.jpg; detectChanges() | nativeElement.textContent | Текст содержит 'test.pdf' и 'photo.jpg' |
| 6 | `should format size in bytes` | Проверяет хелпер formatSize с разными объёмами: B, KB, MB, GB. | 500, 2048, 1048576, 1073741824 | Отформатированные строки | '500 B', '2.0 KB', '1.0 MB', '1.0 GB' |
| 7 | `should validate link url as required` | Проверяет валидацию поля URL: пустое значение — ошибка required. | url.setValue('') | url.valid, url.errors | valid === false; errors.required === true |
| 8 | `should validate link url pattern` | Проверяет валидацию поля URL: невалидный URL — ошибка pattern. | url.setValue('not-a-url') | url.valid, url.errors | valid === false; errors.pattern truthy |
| 9 | `should accept valid http url` | Проверяет, что валидный https URL проходит валидацию формы. | url.setValue('https://example.com') | url.valid | valid === true |
| 10 | `should set link preview on successful preview` | Проверяет успешное получение превью ссылки: API preview вызывается, previewing сбрасывается. | Мок preview возвращает {preview:{title:'Example',...}}; linkForm={url:'https://example.com'}; вызов previewLink() | mockUrlFilesApi.preview('https://example.com'); linkPreview().title; previewing() | preview.toHaveBeenCalledWith('https://example.com'); linkPreview().title === 'Example'; previewing() === false |
| 11 | `should set link error on failed preview` | Проверяет установку ошибки при неудачном получении превью ссылки. | Мок preview выбрасывает throwError; вызов previewLink() | linkError(); previewing() | linkError() === 'Не удалось получить превью'; previewing() === false |
| 12 | `should save link` | Проверяет сохранение URL-файла через API create, установку newlyAddedFile и сброс формы. | Мок create возвращает {file:{id:'new-1',...}}; linkForm={url:'https://example.com'}; вызов saveLink() | mockUrlFilesApi.create('https://example.com'); newlyAddedFile(); форма очищается | create.toHaveBeenCalledWith('https://example.com'); newlyAddedFile() truthy; form.url.value === null |
| 13 | `should not save link when form is invalid` | Проверяет, что при невалидной форме API не вызывается. | linkForm с пустым url; вызов saveLink() | mockUrlFilesApi.create | create.not.toHaveBeenCalled() |
| 14 | `should set link error on save failure` | Проверяет установку ошибки при неудачном сохранении ссылки. | Мок create выбрасывает throwError с {message:'Link save failed'}; вызов saveLink() | linkError() | linkError() === 'Link save failed' |
| 15 | `should dismiss newly added file` | Проверяет сброс newlyAddedFile при вызове dismissNewlyAdded. | newlyAddedFile = {id:'1'}; вызов dismissNewlyAdded() | newlyAddedFile() | newlyAddedFile() === null |
| 16 | `should save description for newly added file` | Проверяет сохранение описания для нового URL-файла. | newlyAddedFile={id:'f1'}; newFileDescription='New desc'; вызов saveDescription() | mockFilesApi.updateDescription('f1', 'New desc') | updateDescription.toHaveBeenCalledWith('f1', 'New desc') |
| 17 | `should not save description when no file` | Проверяет, что при отсутствии newlyAddedFile описание не сохраняется. | newlyAddedFile=null; вызов saveDescription() | mockFilesApi.updateDescription | updateDescription.not.toHaveBeenCalled() |
| 18 | `should call uploadService.upload on file selected` | Проверяет вызов сервиса загрузки при выборе файла через input. | File объект; событие с target.files=[file]; вызов onFileSelected(event) | mockUploadService.upload(file) | upload.toHaveBeenCalledWith(file) |
| 19 | `should handle drag and drop` | Проверяет обработку drag-and-drop: установка isDragOver, вызов загрузки, сброс флага. | DragEvent с файлом; вызов onDragOver, затем onDrop | isDragOver() → true; mockUploadService.upload(file); isDragOver() → false | isDragOver() true после dragover; upload вызван; isDragOver() false после drop |
| 20 | `should cancel upload` | Проверяет отмену загрузки через uploadService.cancel. | uploadState = {phase:'uploading', fileId:'f1'}; вызов cancelUpload() | mockUploadService.cancel('f1') | cancel.toHaveBeenCalledWith('f1') |
| 21 | `should reset upload` | Проверяет сброс состояния загрузки через uploadService.reset. | Вызов resetUpload() | mockUploadService.reset() | reset.toHaveBeenCalled() |
| 22 | `should show upload progress card when uploading` | Проверяет отображение прогресса загрузки (45%) в шаблоне. | uploadState = {phase:'uploading', progress:45}; detectChanges() | nativeElement.textContent | Текст содержит '45%' |
| 23 | `should show upload error card` | Проверяет отображение сообщения об ошибке загрузки в шаблоне. | uploadState = {phase:'error', error:'Upload failed'}; detectChanges() | nativeElement.textContent | Текст содержит 'Upload failed' |

#### `public-link.component.spec`
*Компонент/Сервис: `PublicLinkComponent` | Тестов: 11*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create and resolve link` | Проверяет создание компонента публичной ссылки и успешное разрешение ссылки при инициализации. | Мок FilesApiService.resolveLink возвращает {file:{original_name:'doc.pdf',...}, link:{expires_at:null,allow_save:true}}; input token='pub-tok'; detectChanges() | mockFilesApi.resolveLink('pub-tok'); status(); fileInfo() | resolveLink.toHaveBeenCalledWith('pub-tok'); status() === 'ready'; fileInfo().original_name === 'doc.pdf' |
| 2 | `should go to invalid state on resolve failure` | Проверяет, что при ошибке разрешения ссылки статус переключается в 'invalid'. | resolveLink выбрасывает throwError; token='bad-tok'; detectChanges() | status() | status() === 'invalid' |
| 3 | `should detect video files` | Проверяет определение видеофайлов по mime_type: isVideo=true, isAudio=false. | file с mime_type='video/mp4'; token='tok'; detectChanges() | isVideo(); isAudio() | isVideo() === true; isAudio() === false |
| 4 | `should detect audio files` | Проверяет определение аудиофайлов по mime_type: isVideo=false, isAudio=true. | file с mime_type='audio/mpeg'; token='tok'; detectChanges() | isVideo(); isAudio() | isVideo() === false; isAudio() === true |
| 5 | `should format file sizes` | Проверяет хелпер formatSize для отображения размера в B и KB. | Вызов formatSize(500), formatSize(2048) | Отформатированные строки | '500 B', '2.0 KB' |
| 6 | `should download via link` | Проверяет скачивание файла по публичной ссылке: вызов API downloadViaLink, статус 'downloaded'. | resolveLink успешен; downloadViaLink возвращает {url:'https://cdn...'}; вызов download() | mockFilesApi.downloadViaLink('tok'); status() | downloadViaLink.toHaveBeenCalledWith('tok'); status() === 'downloaded' |
| 7 | `should go to invalid on download failure` | Проверяет, что при ошибке скачивания статус становится 'invalid'. | resolveLink успешен; downloadViaLink выбрасывает throwError; вызов download() | status() | status() === 'invalid' |
| 8 | `should save file to account` | Проверяет сохранение файла в аккаунт через API saveViaLink и установку флага saved. | resolveLink успешен; saveViaLink возвращает {}; вызов saveToAccount() | mockFilesApi.saveViaLink('tok'); saved() | saveViaLink.toHaveBeenCalledWith('tok'); saved() === true |
| 9 | `should set saved even when already saved` | Проверяет, что если файл уже сохранён (код ALREADY_SAVED), saved=true, saveError=null. | saveViaLink выбрасывает throwError с {data:{code:'ALREADY_SAVED'}}; вызов saveToAccount() | saved(); saveError() | saved() === true; saveError() === null |
| 10 | `should show error on save failure` | Проверяет установку ошибки при неудачном сохранении файла в аккаунт. | saveViaLink выбрасывает throwError с {message:'Link expired'}; вызов saveToAccount() | saved(); saveError() | saved() === false; saveError() === 'Link expired' |
| 11 | `should return correct icon for file type` | Проверяет хелпер fileIcon: для неизвестного — 📎, для image — 🖼️, для pdf — 📄. | fileInfo последовательно с mime_type null, 'image/png', 'application/pdf' | fileIcon() | '📎', '🖼️', '📄' |

#### `file-upload.service.spec`
*Компонент/Сервис: `FileUploadService` | Тестов: 6*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create` | Проверяет создание сервиса FileUploadService. | TestBed с провайдерами HttpClient, FilesApiService, VideoThumbnailService, AuthStateService (plan='free') | Экземпляр сервиса | service truthy |
| 2 | `should start in idle state` | Проверяет начальное состояние сервиса — фаза 'idle'. | Сервис создан | service.state() | state().phase === 'idle' |
| 3 | `should reject file exceeding plan limit` | Проверяет, что файл размером более 50MB (лимит бесплатного плана) отклоняется с ошибкой FILE_SIZE_LIMIT_EXCEEDED. | Файл размером 60MB; вызов service.upload(file).subscribe({error}) | Состояние сервиса; ошибка | error.message === 'FILE_SIZE_LIMIT_EXCEEDED'; state().phase === 'error' |
| 4 | `should go through upload lifecycle` | Проверяет полный цикл загрузки: init → upload → complete, с проверкой HTTP-запросов и состояния. | Файл 4 байта; подписка на upload; HTTP-мок | Init-запрос POST /api/v1/files/init-upload с size=4; PUT на S3; POST /api/v1/files/complete-upload с file_id='file-1' | Фазы: uploading (после init), done (после complete); fileId='file-1'; HTTP-методы и тела запросов корректны |
| 5 | `should reset state` | Проверяет сброс состояния сервиса в исходное (idle, progress=0, fileId=null, error=null). | Вызов service.reset() | service.state() | state().phase === 'idle'; .progress === 0; .fileId === null; .error === null |
| 6 | `should cancel upload` | Проверяет отмену загрузки: POST /api/v1/files/file-1/cancel-upload, фаза → idle. | Вызов service.cancel('file-1') | HTTP POST /api/v1/files/file-1/cancel-upload; состояние сервиса | request.method === 'POST'; state().phase === 'idle' |

#### `video-thumbnail.service.spec`
*Компонент/Сервис: `VideoThumbnailService` | Тестов: 1*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create` | Проверяет создание сервиса VideoThumbnailService. | Сервис создаётся через TestBed.inject | Экземпляр сервиса | service truthy |

### `features/folders`
*Всего тестов: 32*

#### `folders-tree.component.spec`
*Компонент/Сервис: `FoldersTreeComponent` | Тестов: 32*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create` | Проверяет создание компонента дерева папок. | Множество моков API: OrganizationApiService, SharedFoldersApiService, FilesApiService, CommentsApiService, TariffApiService, FileUploadService, VideoThumbnailService, UrlFilesApiService, AuthStateService, Router, ActivatedRoute | Экземпляр компонента | fixture.componentInstance truthy |
| 2 | `should initialize with local tab` | Проверяет, что по умолчанию активна вкладка 'local'. | Компонент создан | activeTab() | activeTab() === 'local' |
| 3 | `should load folder tree on init` | Проверяет, что при инициализации вызывается API getFolderTree для загрузки дерева папок. | fixture.detectChanges() | mockOrgApi.getFolderTree() | getFolderTree.toHaveBeenCalled() |
| 4 | `should load tags on init` | Проверяет, что при инициализации вызывается API getTags для загрузки тегов. | fixture.detectChanges() | mockOrgApi.getTags() | getTags.toHaveBeenCalled() |
| 5 | `should load usage on init` | Проверяет, что при инициализации вызывается API getUsage для информации о хранилище. | fixture.detectChanges() | mockTariffApi.getUsage() | getUsage.toHaveBeenCalled() |
| 6 | `should switch tab` | Проверяет переключение между вкладками (local/shared) через setTab. | Вызов setTab('shared') | activeTab() | activeTab() === 'shared' |
| 7 | `should navigate into local folder` | Проверяет навигацию в локальную папку: устанавливается currentLocalFolderId, обновляются breadcrumbs. | Папка {id:'folder-1',name:'Test',children:[]}; вызов navigateIntoLocalFolder | currentLocalFolderId(); breadcrumbs() | currentLocalFolderId() === 'folder-1'; breadcrumbs().length === 2 |
| 8 | `should navigate into shared folder` | Проверяет навигацию в общую папку: устанавливается currentSharedFolderId, загружаются подпапки. | Папка {id:'sf-1',name:'Shared',is_owner:true,parent_id:null}; вызов navigateIntoSharedFolder | currentSharedFolderId(); mockSfApi.getSubfolders | currentSharedFolderId() === 'sf-1'; getSubfolders.toHaveBeenCalledWith('sf-1') |
| 9 | `should toggle file selection` | Проверяет переключение выбора файла: добавление и удаление из selectedFileIds. | Вызов toggleFileSelection('f-1') дважды | selectedFileIds() | Первый вызов → has('f-1') === true; второй → has('f-1') === false |
| 10 | `should toggle all files` | Проверяет выделение/снятие выделения всех файлов. | files = [{id:'f-1'},{id:'f-2'}]; вызов toggleAllFiles() дважды | selectedFileIds() | Первый → size === 2; второй → size === 0 |
| 11 | `should open and close menu` | Проверяет открытие и закрытие контекстного меню. | MouseEvent; вызов toggleMenu('m-1', event), затем closeMenu() | openMenuId() | После toggleMenu → 'm-1'; после closeMenu → null |
| 12 | `should start create folder` | Проверяет установку флага creating и вызов stopPropagation при начале создания папки. | MouseEvent; spy on stopPropagation; вызов startCreate(event) | creating(); event.stopPropagation | creating() === true; stopPropagation.toHaveBeenCalled() |
| 13 | `should start and cancel rename` | Проверяет начало и отмену переименования: устанавливается renamingId и renameNameValue, затем сброс. | Вызов startRename('f-1','local','Old Name'), затем cancelRename() | renamingId(); renameNameValue | После start → renamingId='f-1', renameNameValue='Old Name'; после cancel → renamingId=null |
| 14 | `should confirm and cancel delete` | Проверяет установку deleteTarget при подтверждении удаления и сброс при отмене. | Вызов confirmDeleteLocalFolder, затем cancelDelete() | deleteTarget() | После confirm → deleteTarget truthy; после cancel → deleteTarget null |
| 15 | `should set filters` | Проверяет установку активного фильтра (например, 'favorites'). | Вызов setFilter('favorites') | activeFilter() | activeFilter() === 'favorites' |
| 16 | `should set type group` | Проверяет переключение фильтра по типу файла: повторный вызов с тем же значением сбрасывает фильтр. | Вызов setTypeGroup('image') дважды | activeTypeGroup() | Первый → 'image'; второй → '' (сброс) |
| 17 | `should paginate` | Проверяет переход на указанную страницу пагинации. | page=1, totalPages=3; вызов goToPage(2) | page() | page() === 2 |
| 18 | `should create local folder` | Проверяет создание локальной папки через API createFolder. | activeTab='local'; createNameValue='New Folder'; вызов saveCreate() | mockOrgApi.createFolder | createFolder.toHaveBeenCalled() |
| 19 | `should open access dialog` | Проверяет открытие и закрытие диалога управления доступом к общей папке. | Вызов openAccessDialog({id:'sf-1',name:'Shared'}), затем closeAccessDialog() | sfAccessFolderId() | После open → 'sf-1'; после close → null |
| 20 | `should compute shared folder ownership` | Проверяет вычисление isSharedFolderOwner при совпадении currentSharedFolderId и is_owner=true. | sharedFolders=[{id:'sf-1',is_owner:true}]; currentSharedFolderId='sf-1' | isSharedFolderOwner() | isSharedFolderOwner() === true |
| 21 | `should open and close add modal` | Проверяет открытие и закрытие модального окна добавления. | Вызов openAddModal(), затем closeAddModal() | addModalOpen() | После open → true; после close → false |
| 22 | `should confirm and execute leave` | Проверяет выход из общей папки: подтверждение leaveTarget, выполнение executeLeave с вызовом API. | Вызов confirmLeaveSharedFolder, затем executeLeave() | leaveTarget() truthy; mockSfApi.leaveFolder('sf-1') | leaveFolder.toHaveBeenCalledWith('sf-1') |
| 23 | `should download file` | Проверяет скачивание файла через API download. | Файл {id:'f-1',original_name:'doc.txt',content_kind:'file',mime_type:'text/plain'}; вызов downloadFile(file) | mockFilesApi.download('f-1') | download.toHaveBeenCalledWith('f-1') |
| 24 | `should open URL file in new window` | Проверяет открытие URL-файла в новом окне через window.open. | Файл {id:'f-1',content_kind:'url_file',link_url:'https://example.com'}; spy на window.open; вызов downloadFile | window.open('https://example.com', '_blank', 'noopener') | window.open.toHaveBeenCalledWith('https://example.com', '_blank', 'noopener') |
| 25 | `should format size` | Проверяет хелпер formatSize: 0 → '—', 1024 → содержит 'КБ'. | formatSize(0), formatSize(1024) | Строки | '—', содержит 'КБ' |
| 26 | `should return file icon type` | Проверяет хелпер fileIconType: url_file → 'link', image → 'image', video → 'video'. | Файлы с content_kind='url_file'; mime_type='image/png'; mime_type='video/mp4' | fileIconType() | 'link', 'image', 'video' |
| 27 | `should get file display name` | Проверяет хелпер fileDisplayName: для url_file — link_title, для файла — display_name или original_name. | url_file с link_title; файл с display_name; файл без display_name | fileDisplayName() | 'My Link', 'Display', 'doc.pdf' |
| 28 | `should preview link` | Проверяет получение превью ссылки через API preview. | linkForm={url:'https://example.com'}; вызов previewLink() | mockUrlFilesApi.preview('https://example.com') | preview.toHaveBeenCalledWith('https://example.com') |
| 29 | `should save link for local tab` | Проверяет сохранение URL-файла в локальной вкладке через API create. | linkForm={url:'https://example.com'}; вызов saveLink() (activeTab='local') | mockUrlFilesApi.create('https://example.com') | create.toHaveBeenCalledWith('https://example.com') |
| 30 | `should save link for shared tab` | Проверяет сохранение URL-файла в общей папке через API addUrlFile. | activeTab='shared'; currentSharedFolderId='sf-1'; linkForm={url:'https://example.com'}; вызов saveLink() | mockSfApi.addUrlFile('sf-1', 'https://example.com', null) | addUrlFile.toHaveBeenCalledWith('sf-1', 'https://example.com', null) |
| 31 | `should favorite file` | Проверяет добавление файла в избранное через API favorite. | Файл {id:'f-1'}; вызов favoriteFile(file) | mockFilesApi.favorite('f-1') | favorite.toHaveBeenCalledWith('f-1') |
| 32 | `should toggle all files when all selected` | Проверяет, что allFilesSelected возвращает true при выборе всех файлов и toggleAllFiles снимает выделение. | files=[{id:'f-1'},{id:'f-2'}]; selectedFileIds=new Set(['f-1','f-2']); вызов toggleAllFiles() | allFilesSelected(); selectedFileIds() после toggle | allFilesSelected() === true; после toggle — size === 0 |

### `features/inbox`
*Всего тестов: 10*

#### `inbox.component.spec`
*Компонент/Сервис: `InboxComponent` | Тестов: 10*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create and load data` | Проверяет создание компонента входящих и загрузку файлов и общих папок при инициализации. | Мок InboxApiService с getFiles/getSharedFolders (пустые ответы); fixture.detectChanges() | getFiles вызван 1 раз; getSharedFolders вызван 1 раз | Компонент truthy; getFiles.toHaveBeenCalledTimes(1); getSharedFolders.toHaveBeenCalledTimes(1) |
| 2 | `should toggle file selection` | Проверяет переключение выбора файла: добавление и удаление из selectedFileIds. | Вызов toggleFileSelection('f1') дважды | selectedFileIds() | Первый → has('f1') === true; второй → has('f1') === false |
| 3 | `should toggle all files selection` | Проверяет выделение/снятие выделения всех файлов через toggleAllFiles. | files = [{id:'f1'},{id:'f2'}]; вызов toggleAllFiles() дважды | selectedFileIds() | Первый → size === 2; второй → size === 0 |
| 4 | `should toggle folder selection` | Проверяет переключение выбора общей папки: добавление в selectedFolderIds. | Вызов toggleFolderSelection('sf1') | selectedFolderIds() | selectedFolderIds().has('sf1') === true |
| 5 | `should toggle all folders selection` | Проверяет выделение всех общих папок через toggleAllFolders. | folders = [{id:'sf1'},{id:'sf2'}]; вызов toggleAllFolders() | selectedFolderIds() | selectedFolderIds().size === 2 |
| 6 | `should accept selected files` | Проверяет принятие выбранных файлов через API acceptFiles. | selectedFileIds = new Set(['f1']); вызов acceptFiles() | mockInboxApi.acceptFiles(['f1']) | acceptFiles.toHaveBeenCalledWith(['f1']) |
| 7 | `should reject selected files` | Проверяет отклонение выбранных файлов через API rejectFiles. | selectedFileIds = new Set(['f1']); вызов rejectFiles() | mockInboxApi.rejectFiles(['f1']) | rejectFiles.toHaveBeenCalledWith(['f1']) |
| 8 | `should accept selected folders` | Проверяет принятие выбранных общих папок через API acceptSharedFolders. | selectedFolderIds = new Set(['sf1']); вызов acceptFolders() | mockInboxApi.acceptSharedFolders(['sf1']) | acceptSharedFolders.toHaveBeenCalledWith(['sf1']) |
| 9 | `should reject selected folders` | Проверяет отклонение выбранных общих папок через API rejectSharedFolders. | selectedFolderIds = new Set(['sf1']); вызов rejectFolders() | mockInboxApi.rejectSharedFolders(['sf1']) | rejectSharedFolders.toHaveBeenCalledWith(['sf1']) |
| 10 | `should clear selections` | Проверяет сброс выбранных файлов и папок через clearFileSelection и clearFolderSelection. | selectedFileIds = Set(['f1']); selectedFolderIds = Set(['sf1']); вызов clearFileSelection() и clearFolderSelection() | selectedFileIds().size; selectedFolderIds().size | Оба размера === 0 |

### `features/invitations`
*Всего тестов: 10*

#### `invite-accept.component.spec`
*Компонент/Сервис: `InviteAcceptComponent` | Тестов: 10*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create` | Проверяет базовое создание компонента с действительным токеном и статусом приглашения "pending", когда пользователь не аутентифицирован | mockInvApi.get возвращает invitation.status='pending', user_exists=false; mockAuthState.isAuthenticated=false; параметр маршрута 'tok' | fixture.componentInstance проверен на truthy | Компонент успешно создаётся |
| 2 | `should go to not_found when invitation not found` | Проверяет, что при ошибке запроса приглашения (приглашение не найдено) компонент переходит в состояние not_found | mockInvApi.get выбрасывает ошибку; параметр маршрута 'bad-tok' | Вызов fixture.detectChanges(); проверка state() === 'not_found' | Состояние компонента 'not_found' |
| 3 | `should go to expired when invitation expired` | Проверяет, что при статусе приглашения "expired" компонент отображает соответствующее состояние | mockInvApi.get возвращает invitation.status='expired', user_exists=false; параметр 'tok' | Вызов fixture.detectChanges(); проверка state() === 'expired' | Состояние компонента 'expired' |
| 4 | `should go to accepted when already accepted` | Проверяет, что при статусе приглашения "accepted" компонент отображает состояние accepted | mockInvApi.get возвращает invitation.status='accepted', user_exists=false; параметр 'tok' | Вызов fixture.detectChanges(); проверка state() === 'accepted' | Состояние компонента 'accepted' |
| 5 | `should go to error for unknown status` | Проверяет, что при неизвестном статусе приглашения (cancelled) компонент переходит в состояние ошибки | mockInvApi.get возвращает invitation.status='cancelled', user_exists=false; параметр 'tok' | Вызов fixture.detectChanges(); проверка state() === 'error' | Состояние компонента 'error' |
| 6 | `should go to need_login when not authenticated and user exists` | Проверяет, что если приглашение в статусе pending, пользователь существует в системе, но не аутентифицирован — показывается экран need_login | mockInvApi.get возвращает user_exists=true, статус pending; mockAuthState.isAuthenticated=false; параметр 'tok' | Вызов fixture.detectChanges(); проверка state() === 'need_login' | Состояние компонента 'need_login' |
| 7 | `should go to need_register when not authenticated and user does not exist` | Проверяет, что если пользователь не существует и не аутентифицирован — показывается экран регистрации | mockInvApi.get возвращает user_exists=false, статус pending; mockAuthState.isAuthenticated=false; параметр 'tok' | Вызов fixture.detectChanges(); проверка state() === 'need_register' | Состояние компонента 'need_register' |
| 8 | `should go to ready when authenticated` | Проверяет, что если пользователь аутентифицирован и приглашение в статусе pending — компонент готов к принятию | mockInvApi.get возвращает user_exists=true, статус pending; mockAuthState.isAuthenticated=true; параметр 'tok' | Вызов fixture.detectChanges(); проверка state() === 'ready' | Состояние компонента 'ready' |
| 9 | `should accept invitation` | Проверяет успешное принятие приглашения: вызов accept() отправляет запрос к API и переводит состояние в done | mockInvApi.accept возвращает успешный ответ; все моки как для ready-состояния | fixture.componentInstance.accept(); проверка mockInvApi.accept('tok') и state() === 'done' | API вызван с токеном 'tok', состояние стало 'done' |
| 10 | `should show error on accept failure` | Проверяет обработку ошибки при принятии приглашения: отображается сообщение об ошибке, состояние возвращается в ready | mockInvApi.accept выбрасывает ошибку с message 'Already accepted'; все моки как для ready | fixture.componentInstance.accept(); проверка state() === 'ready', errorMsg() === 'Already accepted' | Состояние осталось 'ready', отображается сообщение 'Already accepted' |

### `features/legal`
*Всего тестов: 2*

#### `privacy.component.spec`
*Компонент/Сервис: `PrivacyComponent` | Тестов: 2*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create` | Проверяет базовое создание компонента с политикой конфиденциальности | Router и ActivatedRoute заглушены; queryParamMap.get возвращает null | fixture.componentInstance проверен на truthy | Компонент успешно создаётся |
| 2 | `should render policy link back to home` | Проверяет, что компонент рендерит хотя бы одну ссылку для навигации | Те же моки; fixture.detectChanges() для шаблона | Поиск всех <a> элементов; проверка links.length > 0 | В шаблоне есть хотя бы одна ссылка |

### `features/settings`
*Всего тестов: 14*

#### `security.component.spec`
*Компонент/Сервис: `SecurityComponent` | Тестов: 14*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create` | Проверяет базовое создание компонента с пустыми списками сессий и запросов контактов | mockAuthApi.sessions возвращает пустой массив; mockSettingsApi.getContactRequests возвращает пустой массив; mockAuthState возвращает пользователя с настройками | fixture.componentInstance проверен на truthy | Компонент создаётся |
| 2 | `should load sessions on init` | Проверяет, что при инициализации компонент загружает список сессий через API | mockAuthApi.sessions возвращает пустой массив; mockSettingsApi.getContactRequests пустой | fixture.detectChanges(); expect(mockAuthApi.sessions).toHaveBeenCalled() | API sessions вызван при инициализации |
| 3 | `should delete session` | Проверяет удаление сессии: вызов deleteSession отправляет запрос и удаляет сессию из списка | mockAuthApi.sessions возвращает сессию {id:'s1', device_name:'Chrome'}; deleteSession успешен | deleteSession(sessions()[0]); проверка deleteSession('s1') и sessions().length === 0 | API deleteSession вызван с 's1', сессия удалена из локального списка |
| 4 | `should logout all sessions` | Проверяет выход из всех сессий: подтверждение, вызов API, очистка пользователя и редирект на /login | mockAuthApi.logoutAll успешен; confirm возвращает true | logoutAll(); проверка mockAuthApi.logoutAll(), clearUser(), router.navigate(['/login']) | API logoutAll вызван, пользователь очищен, выполнен редирект на /login |
| 5 | `should validate password form` | Проверяет валидацию формы смены пароля: несовпадающие пароли вызывают ошибку mismatch | pwdForm заполнен значениями с разными паролями (password и password_confirmation не совпадают) | expect(form.errors['mismatch']).toBe(true) | При несовпадающих паролях форма содержит ошибку 'mismatch' |
| 6 | `should change password` | Проверяет успешную смену пароля: отправка данных на API и установка флага успеха | mockAuthApi.changePassword успешен; форма заполнена корректными данными | changePassword(); проверка mockAuthApi.changePassword с объектом {current_password, password, password_confirmation}; pwdSuccess() === true | API вызван с правильным телом запроса, флаг успеха установлен в true |
| 7 | `should show error on password change failure` | Проверяет отображение ошибки при неудачной смене пароля (неверный текущий пароль) | mockAuthApi.changePassword выбрасывает ошибку с message 'Wrong current password' | changePassword(); проверка pwdError() === 'Wrong current password' | В компоненте отображается сообщение 'Wrong current password' |
| 8 | `should validate email form` | Проверяет валидацию поля email в форме смены email: невалидный email даёт ошибку, валидный — проходит | emailForm.get('email') устанавливается в 'invalid' затем в 'new@test.com' | Проверка errors['email'] для невалидного и valid для валидного email | Невалидный email вызывает ошибку, валидный проходит |
| 9 | `should change email` | Проверяет смену email: отправка запроса на API и обновление данных пользователя в AuthState | mockAuthApi.changeEmail возвращает {user: {id:'1', email:'new@test.com'}} | changeEmail(); проверка changeEmail({email:'new@test.com'}) и updateUser с новыми данными | API вызван с новым email, AuthState обновлён |
| 10 | `should resend verification email` | Проверяет повторную отправку письма верификации: вызов API и установка флага успеха | mockAuthApi.resendVerification успешен | resendVerification(); проверка resendVerification() и resentOk() === true | API вызван, флаг resentOk установлен в true |
| 11 | `should toggle settings and save` | Проверяет переключение тумблеров настроек уведомлений и сохранение через API | mockSettingsApi.updateSettings возвращает обновлённые настройки пользователя | toggleNotifyNewFiles(false) и toggleAllowContacts(false); проверка notifyNewFiles() === false, allowContactsWithout() === false, updateSettings вызван | Локальные сигналы обновлены, API updateSettings вызван |
| 12 | `should load contact requests on init` | Проверяет загрузку запросов контактов при инициализации компонента | mockSettingsApi.getContactRequests возвращает массив с одним запросом {id:'cr1'} | fixture.detectChanges(); проверка contactRequests().length === 1 | Запросы контактов загружены в компонент |
| 13 | `should accept contact request` | Проверяет принятие запроса контакта: вызов API и удаление из локального списка | mockSettingsApi.acceptContactRequest успешен; список запросов содержит один элемент | acceptContactRequest('cr1'); проверка acceptContactRequest('cr1') и contactRequests().length === 0 | API вызван с ID запроса, запрос удалён из списка |
| 14 | `should reject contact request` | Проверяет отклонение запроса контакта: вызов API и удаление из списка | mockSettingsApi.rejectContactRequest успешен; список запросов содержит один элемент | rejectContactRequest('cr1'); проверка rejectContactRequest('cr1') и contactRequests().length === 0 | API вызван с ID запроса, запрос удалён из списка |

### `features/share-target`
*Всего тестов: 11*

#### `share-target.component.spec`
*Компонент/Сервис: `ShareTargetComponent` | Тестов: 11*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create` | Проверяет базовое создание компонента целевого share-экрана | AuthState.isAuthenticated=false, user=null; все сервисы замоканы | fixture.componentInstance проверен на truthy | Компонент создаётся |
| 2 | `should show need-auth when not authenticated` | Проверяет, что неаутентифицированный пользователь видит экран 'need-auth' | mockAuthState.isAuthenticated=false | fixture.detectChanges(); проверка phase() === 'need-auth' | Фаза 'need-auth' |
| 3 | `should navigate to login` | Проверяет переход на страницу логина с returnUrl на share-target | mockRouter.navigate замокан | goLogin(); expect(mockRouter.navigate).toHaveBeenCalledWith(['/login'], {queryParams: {returnUrl: '/share-target'}}) | Редирект на /login с параметром returnUrl |
| 4 | `should cancel and go to files` | Проверяет отмену и переход на страницу файлов | mockRouter.navigate замокан | cancel(); expect(mockRouter.navigate).toHaveBeenCalledWith(['/files']) | Редирект на /files |
| 5 | `should go to files` | Проверяет вызов навигации на страницу файлов через goToFiles | mockRouter.navigate замокан | goToFiles(); expect(mockRouter.navigate).toHaveBeenCalledWith(['/files']) | Редирект на /files |
| 6 | `should format size` | Проверяет метод formatSize для форматирования размера файла: байты, килобайты, мегабайты | formatSize(500), formatSize(2048), formatSize(1048576) | Проверка возвращаемых строк на русском: '500 Б', contains 'КБ', contains 'МБ' | Корректное форматирование размера |
| 7 | `should validate URLs` | Проверяет метод isValidUrl для валидации URL: корректный URL проходит, обычный текст — нет | 'https://example.com' и 'not a url' | isValidUrl('https://example.com') === true; isValidUrl('not a url') === false | Валидация URL работает корректно |
| 8 | `should extract URL from text` | Проверяет извлечение URL из текста: найдена ссылка и отделён текст описания | Строка 'Check this https://example.com/page' | extractUrlFromText(...) возвращает {url: 'https://example.com/page', description: 'Check this'} | URL и описание корректно разделены |
| 9 | `should extract URL from text with trailing punctuation` | Проверяет извлечение URL из текста с пунктуацией в конце: точка отсекается от URL | Строка 'See https://example.com/page.' | result.url === 'https://example.com/page' (без точки) | URL извлекается без завершающей пунктуации |
| 10 | `should return empty URL when no URL in text` | Проверяет обработку текста без URL: возвращается пустой URL и весь текст как описание | Строка 'Just text' | result.url === '', result.description === 'Just text' | Пустой URL, текст целиком в description |
| 11 | `should detect Delifile links` | Проверяет определение, является ли ссылка внутренней ссылкой Delifile | sharedUrl.set('https://delifile.ru/link/abc123') и 'https://example.com' | isDeliFileLink() === true для delifile.ru, false для example.com | Ссылки на delifile.ru распознаются, внешние — нет |

### `features/shared-folders`
*Всего тестов: 41*

#### `shared-folder-access-dialog.component.spec`
*Компонент/Сервис: `SharedFolderAccessDialogComponent` | Тестов: 4*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create and load data` | Проверяет создание диалога управления доступом к общей папке и загрузку списков доступов и ссылок | SharedFoldersApiService.listAccesses и listLinks возвращают пустые массивы; input folderId='folder-1' | Проверка fixture.componentInstance, listAccesses('folder-1'), listLinks('folder-1') | Компонент создан, API вызваны с folder-1 |
| 2 | `should remove access` | Проверяет удаление доступа к общей папке для конкретного пользователя | mockSfApi.removeAccess успешен; folderId='folder-1' | removeAccess('access-1'); проверка removeAccess('folder-1', 'access-1') | API вызван с ID папки и ID доступа |
| 3 | `should disable link` | Проверяет отключение публичной ссылки на общую папку | mockSfApi.disableLink успешен; folderId='folder-1' | disableLink('link-1'); проверка disableLink('folder-1', 'link-1') | API вызван с ID папки и ID ссылки |
| 4 | `should copy link` | Проверяет копирование URL ссылки в буфер обмена | navigator.clipboard.writeText замокан; URL 'https://link.url' | copyLink('https://link.url', 'link-1'); проверка writeText('https://link.url') | URL скопирован в буфер обмена |

#### `shared-folder-add-contact-dialog.component.spec`
*Компонент/Сервис: `SharedFolderAddContactDialogComponent` | Тестов: 4*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create and load contacts` | Проверяет создание диалога добавления контакта к общей папке и загрузку списка контактов | mockContactsApi.list возвращает пустой массив; input folderId='folder-1' | Проверка fixture.componentInstance; list вызван с undefined | Компонент создан, контакты загружены |
| 2 | `should select a contact` | Проверяет, что при выборе контакта его ID сохраняется в selectedId | Контакт {id:'c1', name:'John', email:'john@test.com', is_registered:true} | select(contact); проверка selectedId() === 'c1' | ID выбранного контакта установлен |
| 3 | `should submit and add access` | Проверяет отправку формы: добавление доступа к папке для выбранного контакта с правами view | mockSfApi.addAccess успешен; selectedId='c1'; folderId='folder-1' | submit(); проверка addAccess('folder-1', 'c1', 'view') | API вызван с ID папки, ID контакта и уровнем доступа 'view' |
| 4 | `should not submit without selection` | Проверяет, что отправка формы не происходит при отсутствии выбранного контакта | selectedId не установлен; folderId='folder-1' | submit(); проверка что addAccess НЕ вызван | API addAccess не вызван без выбора контакта |

#### `shared-folder-create-link-dialog.component.spec`
*Компонент/Сервис: `SharedFolderCreateLinkDialogComponent` | Тестов: 5*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create` | Проверяет базовое создание диалога создания ссылки на общую папку | input folderId='folder-1' | fixture.componentInstance проверен на truthy | Компонент создаётся |
| 2 | `should have default form values` | Проверяет значения формы по умолчанию: 12 часов TTL, запрещено сохранение, тип доступа view | input folderId='folder-1' | Проверка form.value.ttl_hours === 12, form.value.allow_save === false, accessType() === 'view' | Значения по умолчанию корректны |
| 3 | `should submit and create link` | Проверяет создание ссылки с кастомными параметрами: отправка формы на API и отображение созданной ссылки | mockSfApi.createLink возвращает ссылку с URL; form: ttl_hours=24, allow_save=true; accessType='edit' | submit(); проверка createLink('folder-1', {access_type:'edit', ttl_hours:24, allow_save:true}); createdLink().url === 'https://example.com/link' | API вызван с корректными параметрами, ссылка отображена |
| 4 | `should not submit when already submitting` | Проверяет, что повторная отправка формы блокируется при активном submitting | submitting установлен в true | submit(); проверка что createLink НЕ вызван | API не вызван при повторной отправке |
| 5 | `should copy link to clipboard` | Проверяет копирование созданной ссылки в буфер обмена | createdLink установлен со значением url='https://copied.link'; navigator.clipboard.writeText замокан | copyLink(); проверка writeText('https://copied.link') | URL скопирован в буфер обмена |

#### `public-shared-link.component.spec`
*Компонент/Сервис: `PublicSharedLinkComponent` | Тестов: 6*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create` | Проверяет создание компонента публичной общей ссылки с успешным разрешением токена | mockSfApi.resolveSharedLink возвращает folder и link; publicFiles возвращает пустой список; input token='token-123' | fixture.detectChanges(); проверка fixture.componentInstance | Компонент создаётся |
| 2 | `should start in resolving state before api responds` | Проверяет начальное состояние resolving=true до ответа API | input token='token-123' | Проверка resolving() === true до detectChanges | Компонент начинает с состояния resolving |
| 3 | `should resolve link successfully` | Проверяет успешное разрешение токена: вызов API resolveSharedLink и обновление состояния | resolveSharedLink возвращает {folder:{id:'folder-1', name:'Test'}, link:{access_type:'view'}}; publicFiles пуст | fixture.detectChanges(); проверка resolveSharedLink('token-123'), folder() truthy, linkAccessType() === 'view' | API вызван с токеном, папка и тип доступа загружены |
| 4 | `should set invalid on error` | Проверяет обработку ошибки при разрешении токена: установка состояния invalid=true | resolveSharedLink выбрасывает ошибку | fixture.detectChanges(); проверка invalid() === true | Состояние invalid установлено в true |
| 5 | `should format size` | Проверяет метод formatSize для отображения размера (B, KB, MB) на английском | formatSize(500), formatSize(2048), formatSize(1048576) | Проверка '500 B', contains 'KB', contains 'MB' | Размер отформатирован корректно |
| 6 | `should return mime icon` | Проверяет метод mimeIcon для возврата emoji иконки по MIME-типу | 'image/png', 'video/mp4', null | Проверка содержит 🖼, 🎬, 📎 соответственно | Возвращаются корректные emoji-иконки |

#### `shared-folders.component.spec`
*Компонент/Сервис: `SharedFoldersComponent` | Тестов: 22*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create` | Проверяет базовое создание компонента списка общих папок | Все сервисы замоканы; AuthState.plan='free' | fixture.componentInstance проверен на truthy | Компонент создаётся |
| 2 | `should load folders on init` | Проверяет загрузку списка общих папок при инициализации компонента | mockSfApi.list возвращает пустой массив | fixture.detectChanges(); проверка mockSfApi.list.toHaveBeenCalled() | API list вызван при инициализации |
| 3 | `should select folder` | Проверяет выбор папки: загрузка файлов и подпапок выбранной папки | selectFolder с объектом папки {id:'sf-1', name:'Test', is_owner:true, my_access_type:'edit'} | Проверка selectedFolder() truthy, listFiles('sf-1', 1), getSubfolders('sf-1') | Папка выбрана, файлы и подпапки загружены |
| 4 | `should navigate to subfolder` | Проверяет навигацию в подпапку: обновление selectedFolder и добавление в breadcrumb | breadcrumb содержит корневую папку; navigateToSubfolder с подпапкой | Проверка selectedFolder().id === 'sub-1', breadcrumb().length === 2 | Выбрана подпапка, breadcrumb обновлён |
| 5 | `should navigate breadcrumb` | Проверяет навигацию по хлебным крошкам: возврат к родительской папке | breadcrumb содержит root и sub; selectedFolder=sub | navigateBreadcrumb(0); проверка selectedFolder().id === 'root', breadcrumb().length === 1 | Возврат к корневой папке, breadcrumb обрезан |
| 6 | `should create subfolder` | Проверяет создание подпапки в выбранной папке | selectedFolder={id:'sf-1'}; newSubfolderName='New Sub' | createSubfolder(); проверка createSubfolder('sf-1', 'New Sub') | API createSubfolder вызван с ID папки и именем |
| 7 | `should handle folder select` | Проверяет обработку выбора папки через выпадающий список (select element) | folders содержит одну папку; event с target.value='sf-1' | onFolderSelect(event); проверка selectedFolder() truthy | Папка выбрана через событие select |
| 8 | `should load files on page change` | Проверяет пагинацию: переход на следующую и предыдущую страницы | page=1, totalPages=3, selectedFolder={id:'sf-1'} | nextPage() -> page === 2; prevPage() -> page === 1 | Счётчик страниц корректно увеличивается и уменьшается |
| 9 | `should toggle upload` | Проверяет открытие/закрытие формы загрузки (uploadExpanded) | Начальное uploadExpanded=false | toggleUpload() -> uploadExpanded() === true | Форма загрузки переключается |
| 10 | `should handle drag events` | Проверяет обработку событий drag-over и drag-leave для визуальной индикации | onDragOver с preventDefault; onDragLeave | isDragOver() === true после dragOver; isDragOver() === false после dragLeave | Состояние isDragOver корректно меняется |
| 11 | `should open and close access dialog` | Проверяет открытие и закрытие диалога управления доступом | Начальное accessDialogOpen=false | openAccessDialog() -> true; closeAccessDialog() -> false | Диалог доступа корректно открывается и закрывается |
| 12 | `should open and close leave dialog` | Проверяет открытие и закрытие диалога выхода из папки | Начальное leaveDialogOpen=false | openLeaveDialog() -> true; closeLeaveDialog() -> false | Диалог выхода корректно открывается и закрывается |
| 13 | `should confirm leave` | Проверяет подтверждение выхода из общей папки: вызов API leaveFolder | selectedFolder={id:'sf-1'}; mockSfApi.leaveFolder успешен | confirmLeave(); проверка leaveFolder('sf-1') | API leaveFolder вызван с ID папки |
| 14 | `should preview link` | Проверяет предпросмотр URL-ссылки: вызов API UrlFilesApi.preview | linkForm.url='https://example.com' | previewLink(); проверка preview('https://example.com') | API preview вызван с URL |
| 15 | `should save link` | Проверяет сохранение URL-файла в общую папку | selectedFolder={id:'sf-1'}; linkForm.url='https://example.com' | saveLink(); проверка addUrlFile('sf-1', 'https://example.com', null) | API addUrlFile вызван с ID папки и URL |
| 16 | `should download file` | Проверяет скачивание файла: вызов API download и открытие URL в новом окне | mockFilesApi.download возвращает url; window.open замокан | downloadFile('file-1'); проверка download('file-1') | API download вызван с ID файла |
| 17 | `should compute canEdit` | Проверяет вычисление права на редактирование: владелец или доступ edit | selectedFolder=null затем {is_owner:true, my_access_type:'edit'} | canEdit() === false для null; canEdit() === true для владельца | canEdit возвращает true для владельца/редактора |
| 18 | `should open create subfolder form` | Проверяет открытие формы создания подпапки | Начальное showCreateSubfolder=false | openCreateSubfolderForm() -> showCreateSubfolder() === true | Форма создания подпапки открыта |
| 19 | `should reset upload state` | Проверяет сброс состояния загрузки: фаза и прогресс обнуляются | uploadPhase='done', uploadProgress=100 | resetUpload() -> uploadPhase() === 'idle', uploadProgress() === 0 | Состояние загрузки сброшено к начальному |
| 20 | `should check view in browser` | Проверяет метод canViewInBrowser: файлы с view_url и content_kind='file' можно просмотреть, url_file — нет | Объект файла {content_kind:'file', mime_type:'image/png', view_url:'...'} и url_file | canViewInBrowser === true для file; false для url_file | Просмотр в браузере доступен для обычных файлов, не для ссылок |
| 21 | `should return file detail link` | Проверяет формирование ссылки на детальную страницу файла | fileId='file-1' | fileDetailLink('file-1') => ['/files', 'file-1'] | Возвращён массив маршрута ['/files', 'file-1'] |
| 22 | `should return file detail query params` | Проверяет формирование query параметров для детальной страницы файла из общей папки | selectedFolder={id:'sf-1'} | fileDetailQueryParams() => {from:'shared-folder', folder_id:'sf-1'} | Параметры {from:'shared-folder', folder_id:'sf-1'} |

### `features/support`
*Всего тестов: 12*

#### `support.component.spec`
*Компонент/Сервис: `SupportComponent` | Тестов: 12*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create and load tickets` | Проверяет создание компонента поддержки и загрузку списка тикетов при инициализации | mockApi.getTickets возвращает пустой список; ActivatedRoute заглушен | Проверка fixture.componentInstance; getTickets(1) вызван | Компонент создан, API getTickets вызван с первой страницей |
| 2 | `should start on tickets tab` | Проверяет, что по умолчанию активен таб 'tickets' | Те же моки | Проверка activeTab() === 'tickets' | Таб по умолчанию — тикеты |
| 3 | `should switch to suggestions tab` | Проверяет переключение на таб предложений: смена активного таба и загрузка предложений | mockApi.getSuggestions возвращает пустой список | setTab('suggestions'); проверка activeTab() === 'suggestions', getSuggestions вызван | Активный таб изменён, предложения загружены |
| 4 | `should open a ticket` | Проверяет открытие тикета: загрузка его данных и отображение | mockApi.getTicket возвращает тикет {id:'ticket-1', messages:[], status:'new'} | openTicket('ticket-1'); проверка getTicket('ticket-1'), activeTicket() truthy | API getTicket вызван, тикет загружен |
| 5 | `should open create ticket form` | Проверяет открытие формы создания нового тикета | Начальное showCreateTicket=false | openCreateTicket(); проверка showCreateTicket() === true | Форма создания тикета открыта |
| 6 | `should cancel create ticket` | Проверяет отмену создания тикета: закрытие формы | openCreateTicket затем cancelCreateTicket | showCreateTicket() === false | Форма создания тикета закрыта |
| 7 | `should submit a ticket` | Проверяет отправку нового тикета с текстом и вызов API | mockApi.createTicket возвращает {ticket:{id:'ticket-1'}}; форма заполнена body='Test message body for ticket' | submitTicket(); проверка createTicket('Test message body for ticket', []) | API createTicket вызван с текстом и пустым массивом файлов |
| 8 | `should not submit invalid ticket` | Проверяет, что пустая форма не отправляется | Форма не заполнена | submitTicket(); проверка что createTicket НЕ вызван | API не вызван без заполнения формы |
| 9 | `should submit a suggestion` | Проверяет отправку предложения с текстом и вызов API | mockApi.createSuggestion успешен; форма предложения заполнена | submitSuggestion(); проверка createSuggestion('Test suggestion body text', []) | API createSuggestion вызван с текстом |
| 10 | `should send message` | Проверяет отправку сообщения в открытом тикете: вызов API sendMessage | mockApi.getTicket возвращает тикет; mockApi.sendMessage возвращает сообщение; форма сообщения заполнена | sendMessage(); проверка sendMessage('ticket-1', 'Reply message', []) | API sendMessage вызван с ID тикета, текстом и пустым массивом |
| 11 | `should confirm ticket` | Проверяет подтверждение решения тикета пользователем | mockApi.getTicket возвращает тикет со статусом 'awaiting_confirmation'; mockApi.confirmTicket успешен | confirmTicket(); проверка confirmTicket('ticket-1') | API confirmTicket вызван с ID тикета |
| 12 | `should apply status label` | Проверяет метод statusLabel для получения русскоязычного отображения статуса тикета | statusLabel('new'), statusLabel('completed') | 'Новое', 'Выполнено' | Статусы корректно переводятся на русский |

### `features/tags`
*Всего тестов: 12*

#### `tags-list.component.spec`
*Компонент/Сервис: `TagsListComponent` | Тестов: 12*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create` | Проверяет базовое создание компонента управления тегами | mockOrgApi.getTags возвращает пустой массив | fixture.componentInstance проверен на truthy | Компонент создаётся |
| 2 | `should load tags on init` | Проверяет загрузку списка тегов при инициализации | mockOrgApi.getTags возвращает пустой массив | fixture.detectChanges(); проверка getTags.toHaveBeenCalled() | API getTags вызван |
| 3 | `should filter tags by search query` | Проверяет фильтрацию тегов по тексту поиска: фильтр применяется локально по name | getTags возвращает теги [{name:'Work'}, {name:'Personal'}] | filtered().length === 2; searchQuery.set('work'); filtered().length === 1; filtered()[0].name === 'Work' | Фильтрация работает регистронезависимо |
| 4 | `should validate add form` | Проверяет валидацию формы добавления тега: обязательное поле name | Пустая форма затем заполненная | errors['required'] === true для пустого; valid === true для заполненного | Поле name обязательно для заполнения |
| 5 | `should add tag` | Проверяет добавление нового тега: вызов API и обновление локального списка | mockOrgApi.createTag возвращает {tag:{id:'t1', name:'New Tag'}}; форма заполнена | addTag(); проверка createTag('New Tag'), tags().length === 1, tags()[0].name === 'New Tag' | API createTag вызван, тег добавлен в список |
| 6 | `should show error on add failure` | Проверяет отображение ошибки при неудачном добавлении тега (дубликат) | mockOrgApi.createTag выбрасывает ошибку с message 'Duplicate name' | addTag(); проверка addError() === 'Duplicate name' | Отображается сообщение об ошибке |
| 7 | `should start and cancel edit` | Проверяет начало и отмену редактирования тега: заполнение editingId и editName, затем сброс | Тег {id:'t1', name:'Old'} | startEdit(tag) -> editingId='t1', editName='Old'; cancelEdit() -> editingId=null | Редактирование корректно начинается и отменяется |
| 8 | `should save edit` | Проверяет сохранение изменений тега: вызов API updateTag и обновление списка | getTags возвращает [{id:'t1', name:'Old'}]; updateTag возвращает обновлённый тег | saveEdit(tag); проверка updateTag('t1', 'Renamed'), tags()[0].name === 'Renamed', editingId() === null | API updateTag вызван, имя обновлено, режим редактирования закрыт |
| 9 | `should cancel edit when name unchanged` | Проверяет, что если имя не изменилось, API не вызывается и редактирование отменяется | Тег {id:'t1', name:'Same'}; editName='Same' (не менялся) | saveEdit(tag); проверка updateTag НЕ вызван, editingId === null | API не вызван при отсутствии изменений |
| 10 | `should cancel edit when name is empty after trim` | Проверяет, что отправка формы с пустым (только пробелы) именем не вызывает API | Тег {id:'t1', name:'Tag'}; editName='   ' | saveEdit(tag); проверка updateTag НЕ вызван | API не вызван с пустым именем |
| 11 | `should confirm and delete tag` | Проверяет подтверждение и удаление тега: вызов API, удаление из списка, сброс deleteTarget | getTags возвращает [{id:'t1', name:'ToDelete'}]; deleteTag успешен | confirmDelete(tag) -> deleteTarget === tag; deleteTag() -> deleteTag('t1'), tags().length === 0, deleteTarget === null | API deleteTag вызван, тег удалён из списка, цель удаления сброшена |
| 12 | `should cancel delete` | Проверяет отмену удаления тега: сброс deleteTarget в null | confirmDelete вызван с тегом | cancelDelete() -> deleteTarget() === null | Подтверждение удаления отменено |

### `features/tariffs`
*Всего тестов: 3*

#### `tariffs.component.spec`
*Компонент/Сервис: `TariffsComponent` | Тестов: 3*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create and load usage` | Проверяет создание компонента тарифов и загрузку информации об использовании | mockTariffApi.getUsage возвращает данные: storage_used_bytes=1MB, device_count=2 и т.д. | Проверка fixture.componentInstance; getUsage.toHaveBeenCalledTimes(1) | Компонент создан, API getUsage вызван один раз |
| 2 | `should compute storage percent` | Проверяет вычисление процента использования хранилища (начальное значение 0 до загрузки) | getUsage возвращает данные (вызывается в конструкторе) | Проверка storagePercent() === 0 | Процент хранилища 0% (сигнал вычисляется) |
| 3 | `should format bytes` | Проверяет метод formatBytes: форматирование байтов в МБ и ГБ | formatBytes(0), formatBytes(1048576), formatBytes(1073741824) | '0 МБ', contains 'МБ', contains 'ГБ' | Размер корректно форматируется в русских единицах |

### `features/markdown-editor`
*Всего тестов: 92*

#### `documents-api.service.spec`
*Компонент/Сервис: `DocumentsApiService` | Тестов: 9*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create a document` | Проверяет создание Markdown-документа через POST /api/v1/documents с fileName. | fileName='test.md' передаётся в service.create() | POST запрос на /api/v1/documents, тело { fileName: 'test.md' } | req.request.method === 'POST', req.request.body === { fileName: 'test.md' } |
| 2 | `should get a document` | Проверяет получение документа по ID через GET /api/v1/documents/doc-1. | ID 'doc-1' передаётся в service.get('doc-1') | GET запрос на /api/v1/documents/doc-1 | req.request.method === 'GET' |
| 3 | `should save a document` | Проверяет сохранение документа через PUT /api/v1/documents/doc-1 с content и etag. | id='doc-1', content='# Hello', etag='abc' передаются в service.save() | PUT запрос на /api/v1/documents/doc-1, тело { content: '# Hello', etag: 'abc' } | req.request.method === 'PUT', req.request.body === { content: '# Hello', etag: 'abc' } |
| 4 | `should acquire a lock` | Проверяет захват блокировки через POST /api/v1/documents/doc-1/lock. | ID 'doc-1' передаётся в service.acquireLock('doc-1') | POST запрос на /api/v1/documents/doc-1/lock | req.request.method === 'POST' |
| 5 | `should send heartbeat` | Проверяет продление блокировки через POST /api/v1/documents/doc-1/lock/heartbeat. | ID 'doc-1' передаётся в service.heartbeat('doc-1') | POST запрос на /api/v1/documents/doc-1/lock/heartbeat | req.request.method === 'POST' |
| 6 | `should takeover lock` | Проверяет перехват блокировки через POST /api/v1/documents/doc-1/lock/takeover. | ID 'doc-1' передаётся в service.takeover('doc-1') | POST запрос на /api/v1/documents/doc-1/lock/takeover | req.request.method === 'POST' |
| 7 | `should release lock` | Проверяет снятие блокировки через DELETE /api/v1/documents/doc-1/lock. | ID 'doc-1' передаётся в service.releaseLock('doc-1') | DELETE запрос на /api/v1/documents/doc-1/lock | req.request.method === 'DELETE' |
| 8 | `should get images` | Проверяет получение изображений через GET /api/v1/assets/images с параметрами. | Параметры { search, cursor, per_page } передаются в service.getImages() | GET запрос на /api/v1/assets/images с query params | req.request.method === 'GET' |
| 9 | `should update access` | Проверяет обновление can_edit через PATCH /api/v1/files/f1/accesses/a1 с телом { can_edit: true }. | fileId='f1', accessId='a1', canEdit=true передаются в service.updateAccess() | PATCH запрос на /api/v1/files/f1/accesses/a1, тело { can_edit: true } | req.request.method === 'PATCH', req.request.body === { can_edit: true } |

#### `document-lock.service.spec`
*Компонент/Сервис: `DocumentLockService` | Тестов: 12*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should start in idle state` | Проверяет начальное состояние — lockState === 'idle'. | DocumentLockService проинициализирован | Чтение сигнала lockState() | lockState() === 'idle' |
| 2 | `should acquire lock and hold it` | Проверяет успешный захват блокировки: acquire → lockState='held', запущен heartbeat. | mockDocumentsApi.acquireLock возвращает 201; mockDocumentsApi.heartbeat возвращает 200 | acquire('doc-1'); verify acquireLock; затем check lockState | lockState() === 'held'; acquireLock вызван с 'doc-1' |
| 3 | `should fail to acquire and go readonly` | Проверяет отказ при захвате: acquire → lockState='readonly'. | mockDocumentsApi.acquireLock возвращает 423 | acquire('doc-1') | lockState() === 'readonly' |
| 4 | `should release lock and go idle` | Проверяет освобождение блокировки: release → lockState='idle'. | acquire успешен, затем release | release('doc-1') | lockState() === 'idle'; releaseLock вызван с 'doc-1' |
| 5 | `should reset state` | Проверяет полный сброс состояния: reset → lockState='idle', takenOverBy=null. | acquire успешен, затем reset | reset() | lockState() === 'idle'; takenOverBy() === null |
| 6 | `should reacquire after release` | Проверяет повторный захват после освобождения: acquire → release → acquire → held. | acquire успешен, release успешен, acquire успешен | acquire('doc-1') после release | lockState() === 'held' |
| 7 | `should handle LOCK_EXPIRED in heartbeat` | Проверяет heartbeat с ошибкой LOCK_EXPIRED → lockState='lost_expired'. | acquire успешен; heartbeat возвращает 423 LOCK_EXPIRED | Ожидание heartbeat 60s | lockState() === 'lost_expired' |
| 8 | `should handle LOCK_TAKEN_OVER in heartbeat` | Проверяет heartbeat с ошибкой LOCK_TAKEN_OVER → lockState='lost_takeover', takenOverBy='John'. | acquire успешен; heartbeat возвращает 423 LOCK_TAKEN_OVER с lockedBy={name:'John'} | Ожидание heartbeat 60s | lockState() === 'lost_takeover'; takenOverBy() === 'John' |
| 9 | `should takeover lock` | Проверяет перехват блокировки: takeover → lockState='held', heartbeat перезапущен. | mockDocumentsApi.takeover возвращает успех; ранее был потерян | takeover('doc-1') | lockState() === 'held'; takeover вызван с 'doc-1' |
| 10 | `should reacquire after lost` | Проверяет восстановление после LOCK_EXPIRED: reacquire → lock reset → acquire → held. | heartbeat вернул LOCK_EXPIRED; acquire успешен при повторной попытке | reacquire('doc-1') | lockState() === 'held' |
| 11 | `should not start heartbeat if acquire fails` | Проверяет, что heartbeat НЕ запускается при неудачном acquire (lockState='readonly'). | acquire возвращает ошибку | acquire('doc-1') | heartbeat НЕ вызван |
| 12 | `should dispose heartbeat on release and destroy` | Проверяет, что heartbeat таймер уничтожается при release и при destroy. | acquire успешен, затем release | release('doc-1'); проверка интервала | Интервал heartbeat остановлен |

#### `markdown-editor.component.spec`
*Компонент/Сервис: `MarkdownEditorComponent` | Тестов: 27*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create` | Проверяет базовое создание компонента. | id=input('doc-1'), mock API возвращает Document | fixture.detectChanges() | Компонент создан |
| 2 | `should create editor with document when lock is held` | Проверяет инициализацию Tiptap-редактора после успешного acquire. | get('doc-1') → Document с content='# Hello'; acquire успешен | fixture.detectChanges() | editor инициализирован, contains content |
| 3 | `should show READ ONLY banner when lock is not held` | Проверяет вывод банера read-only при lockState='readonly'. | acquire → readonly | fixture.detectChanges() | Баннер «Режим только для чтения» виден |
| 4 | `should show lock taken over banner` | Проверяет баннер при LOCK_TAKEN_OVER | heartbeat → LOCK_TAKEN_OVER | fixture.detectChanges() | Баннер «Забран пользователем» виден |
| 5 | `should show lock expired banner` | Проверяет баннер при LOCK_EXPIRED | heartbeat → LOCK_EXPIRED | fixture.detectChanges() | Баннер «Сессия истекла» + кнопка «Продолжить» |
| 6 | `should show locked by other banner with takeover button` | Проверяет баннер «Документ редактирует [имя]» с кнопкой «Забрать» при canTakeOver=true. | get → Document с lock={isLocked:true, lockedBy:{name:'John'}, canTakeOver:true} | fixture.detectChanges() | Баннер виден, кнопка «Забрать документ» видна |
| 7 | `should not show takeover button when cannot takeover` | Проверяет отсутствие кнопки «Забрать» при canTakeOver=false. | get → Document с lock={isLocked:true, canTakeOver:false} | fixture.detectChanges() | Кнопка «Забрать» отсутствует |
| 8 | `should call takeover on button click` | Проверяет вызов takeover при клике на кнопку. | toggleLockTakeover вызывается | Клик на «Забрать» | lockService.takeover вызван 1 раз |
| 9 | `should call reacquire on Continue editing` | Проверяет восстановление при клике «Продолжить редактирование». | reacquire вызывается | Клик на «Продолжить» | lockService.reacquire вызван 1 раз |
| 10 | `should render toolbar with basic formatting buttons` | Проверяет отображение панели инструментов (Bold, Italic, H1, H2, Undo, Redo). | acquire успешен; editor инициализирован | fixture.detectChanges() | Кнопки Bold, Italic, H1, Undo, Redo видны |
| 11 | `should show image insert button when canInsertImages` | Проверяет кнопку вставки изображения при canInsertImages=true. | capabilities.canInsertImages=true | fixture.detectChanges() | Кнопка 🖼 видна |
| 12 | `should hide image insert button when cannot insert images` | Проверяет скрытие кнопки вставки изображения при canInsertImages=false. | capabilities.canInsertImages=false | fixture.detectChanges() | Кнопка 🖼 отсутствует |
| 13 | `should open image picker on image button click` | Проверяет открытие ImagePicker при клике на 🖼. | canInsertImages=true | Клик на 🖼 | showImagePickerSignal === true |
| 14 | `should insert image on picker select` | Проверяет вставку изображения после выбора из ImagePicker. | ImageAsset со stableUrl, fileName, width | selectedImage.emit(asset) | editor.chain().focus().setImage вызван |
| 15 | `should close image picker on cancel` | Проверяет закрытие ImagePicker при отмене. | showImagePicker=true | cancelImagePicker() | showImagePickerSignal === false |
| 16 | `should save document via API` | Проверяет ручное сохранение: save → PUT /documents/{id} с content и etag. | acquire успешен; editor content='# Updated'; etag='abc' | save() | documentsApi.save вызван с id, content, etag |
| 17 | `should update etag after successful save` | Проверяет обновление etag из ответа после сохранения. | save возвращает { etag: 'new-etag', updatedAt: '2026-01-01', updatedBy: {id:1, name:'U'} } | save() → flush | doc.update etag='new-etag' |
| 18 | `should reset saveStatus on editor change` | Проверяет, что при изменении текста статус становится 'unsaved' и запускается autosave. | editor update | onUpdate callback | saveStatus() === 'unsaved' |
| 19 | `should schedule autosave with 3s debounce` | Проверяет таймер автозахранения 3s. | После изменения текста | scheduleAutoSave; setTimeout 3000ms | save вызван через 3s |
| 20 | `should cancel previous autosave timer on new edit` | Проверяет сброс таймера при новом изменении. | Два изменения подряд | Первый таймер сброшен | save вызван 1 раз через 3s |
| 21 | `should show saving status` | Проверяет индикатор сохранения. | save() в процессе | saveStatus() === 'saving' | Индикатор активности виден |
| 22 | `should block autosave after 409 conflict` | Проверяет блокировку автосохранения при 409 CONFLICT. | save возвращает 409 error | После ошибки 409 | saveStatus() === 'conflict'; autosave не запускается |
| 23 | `should show conflict error banner` | Проверяет баннер конфликта. | saveStatus='conflict' | conflictError=true | Баннер «Конфликт версий» виден |
| 24 | `should show 413 quota exceeded error` | Проверяет ошибку превышения квоты. | save возвращает 413 | После ошибки 413 | saveStatus() === 'quota_exceeded' |
| 25 | `should go back using router` | Проверяет навигацию назад. | Компонент создан | goBack() | location.back() вызван |
| 26 | `should call lockService.release on destroy` | Проверяет освобождение блокировки при уничтожении компонента. | acquire успешен | ngOnDestroy() | lockService.release вызван; editor уничтожен |
| 27 | `should dispose editor on destroy` | Проверяет уничтожение Tiptap-редактора при ngOnDestroy. | editor инициализирован | ngOnDestroy() | editor.destroy() вызван |

#### `markdown-editor-panel.component.spec`
*Компонент/Сервис: `MarkdownEditorPanelComponent` | Тестов: 29*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create` | Проверяет базовое создание панели. | fileId=input('doc-1'), expanded=false | fixture.detectChanges() | Компонент создан |
| 2 | `should be collapsed when expanded=false` | Проверяет свёрнутое состояние по умолчанию. | expanded=false | fixture.detectChanges() | collapsed() === true |
| 3 | `should be expanded when expanded=true` | Проверяет развёрнутое состояние. | expanded=true | fixture.detectChanges() | collapsed() === false |
| 4 | `should show empty state when no document loaded` | Проверяет отображение пустого состояния. | get возвращает undefined | fixture.detectChanges() | Баннер «Нет документа» виден |
| 5 | `should load document and create editor` | Проверяет загрузку документа и создание редактора. | get('doc-1') → Document; acquire успешен | fixture.detectChanges() | editor инициализирован |
| 6 | `should hide editor when collapsed` | Проверяет скрытие редактора при сворачивании. | expanded=true, acquire успешен | collapsed.set(true) | body content скрыт |
| 7 | `should expand on header click` | Проверяет разворачивание по клику на заголовок. | collapsed=true | Клик на заголовок | collapsed() === false |
| 8 | `should show READ ONLY banner` | Проверяет read-only баннер. | acquire → readonly | fixture.detectChanges() | Баннер read-only виден |
| 9 | `should show taken over banner` | Проверяет баннер LOCK_TAKEN_OVER. | heartbeat → LOCK_TAKEN_OVER | fixture.detectChanges() | Баннер «Забран» виден |
| 10 | `should show expired banner` | Проверяет баннер LOCK_EXPIRED. | heartbeat → LOCK_EXPIRED | fixture.detectChanges() | Баннер «Сессия истекла» |
| 11 | `should expand on create` | Проверяет, что при создании документа панель автоматически разворачивается. | expanded=false | createDocument и успех | collapsed() === false |
| 12 | `should show create document form when no document` | Проверяет форму создания нового документа. | get возвращает undefined | fixture.detectChanges() | Поле ввода имени + кнопка «Создать» видимы |
| 13 | `should create document with .md extension` | Проверяет, что при создании без .md расширение добавляется. | fileName='MyDoc' | createDocument() | documentsApi.create('MyDoc.md') |
| 14 | `should not create document with empty name` | Проверяет валидацию — пустое имя не отправляет запрос. | fileName='' | createDocument() | documentsApi.create НЕ вызван |
| 15 | `should show save button when unsaved` | Проверяет кнопку «Сохранить» при статусе unsaved. | saveStatus='unsaved' | fixture.detectChanges() | Кнопка «Сохранить» видна |
| 16 | `should show saving indicator` | Проверяет индикатор сохранения. | saveStatus='saving' | fixture.detectChanges() | «Сохранение...» видно |
| 17 | `should save document` | Проверяет сохранение документа. | acquire успешен; content и etag | saveDocument() | documentsApi.save вызван |
| 18 | `should save on Ctrl+S` | Проверяет сохранение по Ctrl+S. | acquire успешен | keydown Ctrl+S | save вызван |
| 19 | `should not save when read only` | Проверяет, что в read-only сохранение не вызывается. | lockState='readonly' | saveDocument() | documentsApi.save НЕ вызван |
| 20 | `should schedule autosave 3s after edit` | Проверяет автосохранение 3s. | После изменения текста | scheduleAutoSave | save вызван через 3s |
| 21 | `should cancel autosave timer on destroy` | Проверяет отмену таймера при ngOnDestroy. | После изменения текста | ngOnDestroy() | Таймер очищен |
| 22 | `should emit closed event on minimize` | Проверяет эмит события закрытия. | Компонент создан | minimize() | closed.emit() вызван |
| 23 | `should emit expandToggle event` | Проверяет эмит события expandToggle. | Компонент создан | onExpandClick() | expandToggle.emit() вызван |
| 24 | `should open image picker` | Проверяет открытие ImagePicker. | canInsertImages=true | insertImage() | showImagePickerSignal=true |
| 25 | `should insert image from picker` | Проверяет вставку изображения. | ImageAsset выбран | selectedImage.emit(asset) | setImage вызван в редакторе |
| 26 | `should close image picker on cancel` | Проверяет закрытие picker при отмене. | showImagePicker=true | cancelImagePicker() | showImagePickerSignal=false |
| 27 | `should reacquire lock` | Проверяет кнопку «Продолжить редактирование». | lost_expired | reacquire() | lockService.reacquire вызван |
| 28 | `should release lock on destroy` | Проверяет освобождение блокировки при уничтожении. | acquire успешен | ngOnDestroy() | lockService.release вызван |
| 29 | `should reset lock state on destroy` | Проверяет сброс состояния блокировки. | acquire успешен | ngOnDestroy() | lockService.reset вызван |

#### `image-picker.component.spec`
*Компонент/Сервис: `ImagePickerComponent` | Тестов: 15*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create` | Проверяет базовое создание. | Мок getImages возвращает список изображений | fixture.detectChanges() | Компонент создан |
| 2 | `should load images on init` | Проверяет загрузку изображений при инициализации. | 3 ImageAsset | fixture.detectChanges() | getImages вызван 1 раз; items.length === 3 |
| 3 | `should render images in grid` | Проверяет отображение сетки изображений. | 3 ImageAsset; mockPreviewUrls | fixture.detectChanges() | 3 элемента img в сетке |
| 4 | `should display image name` | Проверяет отображение имени изображения. | ImageAsset { fileName: 'photo.png' } | fixture.detectChanges() | 'photo.png' виден |
| 5 | `should select image on click` | Проверяет выбор изображения по клику. | ImageAsset { id: 'img-1' } | Клик на элемент | selectedImage()?.id === 'img-1'; элемент подсвечен |
| 6 | `should deselect on click same image` | Проверяет снятие выбора повторным кликом. | selectedImage='img-1' | Клик на 'img-1' | selectedImage() === null |
| 7 | `should confirm selection` | Проверяет подтверждение выбранного изображения. | selectedImage='img-1' | confirm() | selected.emit с ImageAsset |
| 8 | `should not confirm without selection` | Проверяет, что без выбора confirm не эмитит. | selectedImage=null | confirm() | selected.emit НЕ вызван |
| 9 | `should cancel on close button` | Проверяет отмену по кнопке закрытия. | Компонент открыт | Клик на ✕ | cancelled.emit() |
| 10 | `should cancel on Cancel button` | Проверяет отмену по кнопке «Отмена». | Компонент открыт | Клик на «Отмена» | cancelled.emit() |
| 11 | `should cancel on overlay click` | Проверяет отмену по клику вне панели. | Компонент открыт | Клик на overlay | cancelled.emit() |
| 12 | `should search with debounce 400ms` | Проверяет поиск с дебаунсом 400ms. | searchQuery='cat' | setTimeout 400ms | getImages вызван с search='cat' |
| 13 | `should load more on pagination` | Проверяет пагинацию. | nextCursor='cursor-abc'; клик «Загрузить ещё» | loadMore() | getImages вызван с cursor='cursor-abc'; элементы добавлены |
| 14 | `should not show load more when no cursor` | Проверяет скрытие кнопки пагинации. | nextCursor=null | fixture.detectChanges() | Кнопка «Загрузить ещё» отсутствует |
| 15 | `should have disabled insert button when no selection` | Проверяет, что кнопка «Вставить» неактивна без выбора. | selectedImage=null | fixture.detectChanges() | Кнопка «Вставить» disabled |

### `shared/components`
*Всего тестов: 23*

#### `cookie-consent.component.spec`
*Компонент/Сервис: `CookieConsentComponent` | Тестов: 3*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create and be visible when no consent stored` | Проверяет, что при отсутствии согласия в localStorage баннер куки отображается | localStorage.clear(); Router и ActivatedRoute заглушены | Проверка fixture.componentInstance; visible() === true | Баннер видим |
| 2 | `should be hidden when consent already stored` | Проверяет, что при наличии согласия в localStorage баннер куки скрыт | localStorage.setItem('cookie_consent', '1') перед созданием компонента | visible() === false | Баннер скрыт |
| 3 | `should hide on accept and store consent` | Проверяет, что при принятии куки баннер скрывается и согласие сохраняется в localStorage | localStorage пуст | accept(); проверка visible() === false; localStorage.getItem('cookie_consent') === '1' | После принятия баннер скрыт, согласие сохранено |

#### `file-type-icon.component.spec`
*Компонент/Сервис: `FileTypeIconComponent` | Тестов: 6*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create` | Проверяет базовое создание компонента иконки типа файла | Нет входных параметров | fixture.componentInstance проверен на truthy | Компонент создаётся |
| 2 | `should render image icon for image mime` | Проверяет отображение иконки для mime-типа image/png: рендеринг SVG с шириной 20 | input mime='image/png' | Поиск svg-элемента; проверка svg truthy и width=20 | SVG-иконка отрендерена с корректным размером |
| 3 | `should render link icon for url_file kind` | Проверяет отображение иконки для типа url_file (kind='url_file') | input kind='url_file' | Проверка iconType() === 'link' | Тип иконки 'link' |
| 4 | `should render pdf icon for pdf mime` | Проверяет отображение иконки для PDF-файлов (application/pdf) | input mime='application/pdf' | Проверка iconType() === 'pdf' | Тип иконки 'pdf' |
| 5 | `should render default file icon for unknown mime` | Проверяет отображение иконки по умолчанию для неизвестного mime-типа | input mime='application/octet-stream' | Проверка iconType() === 'file' | Тип иконки 'file' |
| 6 | `should respect size input` | Проверяет, что параметр size корректно меняет размеры SVG (width и height) | input size=32 | Проверка width='32', height='32' | Размеры иконки соответствуют переданному параметру |

#### `footer.component.spec`
*Компонент/Сервис: `FooterComponent` | Тестов: 2*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create` | Проверяет базовое создание компонента подвала | Router и ActivatedRoute заглушены | fixture.componentInstance проверен на truthy | Компонент создаётся |
| 2 | `should render copyright and privacy link` | Проверяет отображение копирайта и ссылки на политику конфиденциальности | Те же моки; fixture.detectChanges() | Проверка textContent содержит '@DeliFile.RU' и ссылка содержит 'Политика конфиденциальности' | Копирайт и ссылка на политику отрендерены |

#### `notification-banner.component.spec`
*Компонент/Сервис: `NotificationBannerComponent` | Тестов: 2*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create` | Проверяет базовое создание компонента баннера уведомлений | NotificationService.queue имитирует 2 уведомления; AuthState.user={} | fixture.componentInstance проверен на truthy | Компонент создаётся |
| 2 | `should dismiss and navigate on open` | Проверяет, что при открытии уведомления происходит его скрытие и навигация по указанному маршруту | open('n1', '/files') | Проверка dismiss('n1') и navigateByUrl('/files') | Уведомление скрыто, выполнен переход по маршруту |

#### `thread-comments.component.spec`
*Компонент/Сервис: `ThreadCommentsComponent` | Тестов: 10*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `should create` | Проверяет базовое создание компонента комментариев с входными параметрами targetType='file' и targetId='file-1' | mockCommentsApi.getThreads возвращает политику и пустые треды; AuthState.user={id:'user-1'} | fixture.componentInstance проверен на truthy | Компонент создаётся |
| 2 | `should load threads on init` | Проверяет загрузку тредов комментариев при инициализации с типом file | targetType='file', targetId='file-1' | fixture.detectChanges(); проверка getThreads('file', 'file-1', 'all', null) | API getThreads вызван с типом, ID, режимом 'all' и null |
| 3 | `should set active tab to private for local_folder` | Проверяет, что для локальной папки (local_folder) активным табом устанавливается 'private' | targetType='local_folder', targetId='folder-1' | fixture.detectChanges(); проверка activeTab() === 'private' | Для local_folder активен таб private |
| 4 | `should load shared thread on selectTab` | Проверяет загрузку выбранного треда и пометку сообщений как прочитанных | getThreads возвращает shared thread; getThread возвращает тред | selectTab('shared'); проверка getThread('thread-1') и markRead('thread-1') | API getThread и markRead вызваны для треда |
| 5 | `should start and cancel reply` | Проверяет начало и отмену ответа на комментарий | Комментарий {id:'c-1', body:'test'} | startReply(comment) -> replyingTo() === comment; cancelReply() -> replyingTo() === null | Ответ корректно начинается и отменяется |
| 6 | `should start and cancel edit` | Проверяет начало и отмену редактирования комментария | Комментарий {id:'c-1', body:'test'} | startEdit(comment) -> editingComment() === comment, editBody() === 'test'; cancelEdit() -> editingComment() === null | Редактирование корректно начинается и отменяется |
| 7 | `should submit a new comment` | Проверяет отправку нового комментария: вызов API createComment и очистку поля ввода | mockCommentsApi.createComment успешен; composerBody='Hello' | submitComment(); проверка createComment вызван; composerBody() === '' | API вызван, поле ввода очищено |
| 8 | `should submit edit` | Проверяет сохранение отредактированного комментария: вызов API updateComment | editingComment={id:'c-1', body:'test'}, editBody='Updated' | submitEdit(); проверка updateComment('c-1', 'Updated') | API updateComment вызван с ID и новым текстом |
| 9 | `should delete comment` | Проверяет удаление комментария: вызов API deleteComment | mockCommentsApi.deleteComment успешен; комментарий {id:'c-1'} | deleteComment({id:'c-1'}); проверка deleteComment('c-1') | API deleteComment вызван с ID комментария |
| 10 | `should get active thread and summary` | Проверяет метод getActiveThread: возвращает тред в зависимости от активного таба | sharedThread={id:'thread-1'}; activeTab='shared' | getActiveThread().id === 'thread-1' | Возвращён корректный активный тред |

---
## Backend (Laravel)

### `Feature/Activity`
*Всего тестов: 5*

#### `ActivityTest`
*Класс: `Tests\Feature\Activity\ActivityTest` | Тестов: 5*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_user_can_list_activity` | Проверяет, что аутентифицированный пользователь может получить список своей активности | Пользователь (User::factory()->create()), 3 записи ActivityLog | GET-запрос /api/v1/activity от имени пользователя | assertOk() (200), assertJsonPath('result', 'success'), assertJsonStructure(['data' => ['items', 'pagination']]) |
| 2 | `test_activity_is_paginated` | Проверяет пагинацию списка активности — страница возвращает ровно 2 элемента при per_page=2 | Пользователь, 5 записей ActivityLog | GET-запрос /api/v1/activity?page=1&per_page=2 от имени пользователя | assertOk() (200), assertCount(2, items) |
| 3 | `test_activity_returns_correct_structure` | Проверяет, что каждый элемент списка активности содержит обязательные поля id, action, created_at | Пользователь, 1 запись ActivityLog | GET-запрос /api/v1/activity от имени пользователя | assertOk() (200), assertArrayHasKey('id'), assertArrayHasKey('action'), assertArrayHasKey('created_at') |
| 4 | `test_activity_only_shows_accessible_files` | Проверяет изоляцию данных — пользователь видит только свою активность | Пользователь_1 с 3 активностями, Пользователь_2 с 2 активностями | GET-запрос /api/v1/activity от имени первого пользователя | assertOk() (200), assertCount(3, items) (чужие активности не включены) |
| 5 | `test_unauthenticated_user_cannot_access_activity` | Проверяет, что неаутентифицированный пользователь не может получить список активности | Нет пользователя | GET-запрос /api/v1/activity без аутентификации | assertUnauthorized() (401) |

### `Feature/Admin`
*Всего тестов: 40*

#### `AdminTest`
*Класс: `Tests\Feature\Admin\AdminTest` | Тестов: 14*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_non_superuser_cannot_access_admin` | Проверяет, что обычный пользователь не может получить доступ к админ-статистике | Пользователь с is_superuser=false | GET-запрос /api/v1/admin/stats от имени пользователя | assertStatus(403), assertJsonPath('data.code', 'FORBIDDEN') |
| 2 | `test_superuser_can_view_stats` | Проверяет, что суперпользователь может получить статистику системы | Суперпользователь (is_superuser=true) | GET-запрос /api/v1/admin/stats от имени суперпользователя | assertOk() (200), assertJsonPath('result', 'success'), assertJsonStructure(['data' => ['total_users', 'total_files', 'total_size', 'pinned_files', 'pinned_size']]) |
| 3 | `test_superuser_can_list_users` | Проверяет, что суперпользователь может получить список всех пользователей | Суперпользователь | GET-запрос /api/v1/admin/users | assertOk() (200), assertJsonStructure(['data' => ['items' => [['id', 'email', 'name', 'account_status', 'plan']]]]) |
| 4 | `test_superuser_can_update_user_plan` | Проверяет, что суперпользователь может изменить тарифный план пользователя | Суперпользователь, целевой пользователь | PATCH-запрос /api/v1/admin/users/{id}/plan с JSON {"plan": "silver"} | assertOk() (200); assertEquals('silver', $target->plan?->value) |
| 5 | `test_update_plan_fails_with_invalid_plan` | Проверяет, что несуществующий тарифный план вызывает ошибку валидации | Суперпользователь, целевой пользователь | PATCH-запрос /api/v1/admin/users/{id}/plan с JSON {"plan": "platinum"} | assertStatus(422) |
| 6 | `test_superuser_can_toggle_user_block` | Проверяет, что суперпользователь может заблокировать пользователя | Суперпользователь, целевой пользователь с account_status='active' | POST-запрос /api/v1/admin/users/{id}/block | assertOk() (200); assertEquals('blocked_unverified_email', $target->account_status) |
| 7 | `test_superuser_can_generate_reset_link` | Проверяет, что суперпользователь может сгенерировать ссылку сброса пароля | Суперпользователь, целевой пользователь | POST-запрос /api/v1/admin/users/{id}/reset-link | assertOk() (200), assertJsonStructure(['data' => ['url']]), assertStringContainsString('/reset-password?token=', url) |
| 8 | `test_superuser_can_reset_user_sessions` | Проверяет, что суперпользователь может сбросить сессии пользователя | Суперпользователь, целевой пользователь | POST-запрос /api/v1/admin/users/{id}/reset-sessions | assertOk() (200) |
| 9 | `test_nonexistent_user_returns_404` | Проверяет, что блокировка несуществующего пользователя возвращает 404 | Суперпользователь | POST-запрос /api/v1/admin/users/nonexistent/block | assertStatus(404) |
| 10 | `test_superuser_can_notify_user` | Проверяет, что суперпользователь может отправить уведомление пользователю | Суперпользователь, целевой пользователь | POST-запрос /api/v1/admin/users/{id}/notify с JSON {"title": "Test", "body": "Test body"} | assertOk() (200) |
| 11 | `test_notify_requires_title_and_body` | Проверяет, что уведомление без title/body вызывает ошибку валидации | Суперпользователь, целевой пользователь | POST-запрос /api/v1/admin/users/{id}/notify с пустым JSON {} | assertStatus(422) |
| 12 | `test_notify_all_sends_to_users` | Проверяет массовое уведомление всем пользователям | Суперпользователь, 3 пользователя | POST-запрос /api/v1/admin/notify-all с JSON {"title": "Broadcast", "body": "To all users"} | assertOk() (200) |
| 13 | `test_unauthenticated_user_cannot_access_admin` | Проверяет, что неаутентифицированный пользователь не может получить доступ к админ-панели | Нет пользователя | GET-запрос /api/v1/admin/stats | assertUnauthorized() (401) |
| 14 | `test_superuser_block_skip_if_not_found` | Проверяет, что сброс сессий несуществующего пользователя возвращает 404 | Суперпользователь | POST-запрос /api/v1/admin/users/nonexistent-id/reset-sessions | assertStatus(404) |

#### `SuggestionAdminTest`
*Класс: `Tests\Feature\Admin\SuggestionAdminTest` | Тестов: 11*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_non_superuser_cannot_access_admin_suggestions` | Проверяет, что обычный пользователь не может получить доступ к админ-разделу предложений | Пользователь с is_superuser=false | GET-запрос /api/v1/admin/suggestions | assertStatus(403), assertJsonPath('data.code', 'FORBIDDEN') |
| 2 | `test_admin_can_list_suggestions` | Проверяет, что суперпользователь может получить список предложений | Admin (суперпользователь), SuggestionTicket с body='Great idea', status='new' | GET-запрос /api/v1/admin/suggestions | assertOk() (200), assertJsonPath('result', 'success') |
| 3 | `test_admin_can_list_suggestions_with_status_filter` | Проверяет фильтрацию предложений по статусу | SuggestionTicket 'Idea 1' status='new', 'Idea 2' status='accepted' | GET-запрос /api/v1/admin/suggestions?status=accepted | assertOk() (200), assertGreaterThanOrEqual(1, количество items) |
| 4 | `test_admin_can_view_suggestion_detail` | Проверяет детальный просмотр предложения | SuggestionTicket с body='My idea', status='new' | GET-запрос /api/v1/admin/suggestions/{id} | assertOk() (200), assertJsonStructure(['data' => ['suggestion' => ['id', 'body', 'status', 'user', 'admin_comments']]]) |
| 5 | `test_admin_view_nonexistent_suggestion_returns_404` | Проверяет, что запрос несуществующего предложения возвращает 404 | Нет предложения с таким ID | GET-запрос /api/v1/admin/suggestions/nonexistent | assertStatus(404) |
| 6 | `test_admin_can_update_suggestion_status` | Проверяет изменение статуса предложения | SuggestionTicket status='new' | PATCH-запрос /api/v1/admin/suggestions/{id}/status с JSON {"status": "accepted"} | assertOk() (200), assertJsonPath('data.status', 'accepted') |
| 7 | `test_update_status_requires_valid_status` | Проверяет валидацию статуса | SuggestionTicket status='new' | PATCH-запрос /api/v1/admin/suggestions/{id}/status с JSON {"status": "invalid_status"} | assertStatus(422) |
| 8 | `test_admin_can_add_comment_to_suggestion` | Проверяет добавление комментария к предложению | SuggestionTicket body='Idea', status='new' | POST-запрос /api/v1/admin/suggestions/{id}/comments с JSON {"body": "We like this idea"} | assertOk() (200), assertDatabaseHas('suggestion_admin_comments', ['body' => 'We like this idea']) |
| 9 | `test_add_comment_requires_body` | Проверяет валидацию — комментарий без body вызывает ошибку 422 | SuggestionTicket body='Idea' | POST-запрос /api/v1/admin/suggestions/{id}/comments с пустым JSON {} | assertStatus(422) |
| 10 | `test_add_comment_to_nonexistent_suggestion_returns_404` | Проверяет, что комментарий к несуществующему предложению возвращает 404 | Нет предложения | POST-запрос /api/v1/admin/suggestions/nonexistent/comments с JSON {"body": "Comment"} | assertStatus(404) |
| 11 | `test_unauthenticated_cannot_access_admin_suggestions` | Проверяет, что неаутентифицированный пользователь не может получить доступ к админ-разделу | Нет пользователя | GET-запрос /api/v1/admin/suggestions | assertUnauthorized() (401) |

#### `SupportAdminTest`
*Класс: `Tests\Feature\Admin\SupportAdminTest` | Тестов: 15*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_non_superuser_cannot_access_admin_support` | Проверяет, что обычный пользователь не может получить доступ к админ-разделу тикетов | Пользователь с is_superuser=false | GET-запрос /api/v1/admin/support/tickets | assertStatus(403), assertJsonPath('data.code', 'FORBIDDEN') |
| 2 | `test_admin_can_list_tickets` | Проверяет, что суперпользователь может получить список тикетов поддержки | Admin и user; SupportTicket со status='new' | GET-запрос /api/v1/admin/support/tickets | assertOk() (200), assertJsonPath('result', 'success') |
| 3 | `test_admin_can_filter_tickets_by_status` | Проверяет фильтрацию тикетов по статусу | 2 SupportTicket — status='new' и status='in_progress' | GET-запрос /api/v1/admin/support/tickets?status=new | assertOk() (200), assertCount(1, items) |
| 4 | `test_admin_can_view_ticket_detail` | Проверяет детальный просмотр тикета | SupportTicket со status='new' | GET-запрос /api/v1/admin/support/tickets/{id} | assertOk() (200), assertJsonStructure(['data' => ['ticket' => ['id', 'status', 'user', 'messages']]]) |
| 5 | `test_admin_view_nonexistent_ticket_returns_404` | Проверяет запрос несуществующего тикета | Нет тикета | GET-запрос /api/v1/admin/support/tickets/nonexistent | assertStatus(404) |
| 6 | `test_admin_can_take_ticket_in_work` | Проверяет, что суперпользователь может взять тикет в работу | SupportTicket со status='new' | POST-запрос /api/v1/admin/support/tickets/{id}/take | assertOk() (200), assertJsonPath('data.status', 'in_progress') |
| 7 | `test_cannot_take_already_taken_ticket` | Проверяет, что нельзя взять в работу тикет в статусе 'in_progress' | SupportTicket со status='in_progress' | POST-запрос /api/v1/admin/support/tickets/{id}/take | assertStatus(422) |
| 8 | `test_admin_can_await_confirmation` | Проверяет перевод тикета в статус 'awaiting_confirmation' | SupportTicket со status='in_progress' | POST-запрос /api/v1/admin/support/tickets/{id}/await-confirmation | assertOk() (200), assertJsonPath('data.status', 'awaiting_confirmation') |
| 9 | `test_await_confirmation_requires_in_progress_status` | Проверяет, что нельзя перевести тикет не в статусе 'in_progress' | SupportTicket со status='new' | POST-запрос /api/v1/admin/support/tickets/{id}/await-confirmation | assertStatus(422) |
| 10 | `test_admin_can_add_message_to_ticket` | Проверяет добавление административного сообщения в тикет | SupportTicket со status='in_progress' | POST-запрос /api/v1/admin/support/tickets/{id}/messages с JSON {"body": "We have fixed the issue"} | assertOk() (200), assertDatabaseHas('support_messages', ['body' => 'We have fixed the issue']) |
| 11 | `test_add_message_requires_body` | Проверяет валидацию — сообщение без body вызывает ошибку 422 | SupportTicket со status='in_progress' | POST-запрос /api/v1/admin/support/tickets/{id}/messages с пустым JSON {} | assertStatus(422) |
| 12 | `test_cannot_add_message_to_completed_ticket` | Проверяет, что нельзя добавить сообщение в завершённый тикет | SupportTicket со status='completed' | POST-запрос /api/v1/admin/support/tickets/{id}/messages с JSON {"body": "Message"} | assertStatus(422) |
| 13 | `test_admin_can_mark_ticket_read` | Проверяет отметку тикета как прочитанного | SupportTicket со status='in_progress' | POST-запрос /api/v1/admin/support/tickets/{id}/mark-read | assertOk() (200) |
| 14 | `test_admin_mark_read_nonexistent_ticket_returns_404` | Проверяет, что отметка несуществующего тикета возвращает 404 | Нет тикета | POST-запрос /api/v1/admin/support/tickets/nonexistent/mark-read | assertStatus(404) |
| 15 | `test_unauthenticated_cannot_access_admin_support` | Проверяет, что неаутентифицированный пользователь не может получить доступ | Нет пользователя | GET-запрос /api/v1/admin/support/tickets | assertUnauthorized() (401) |

### `Feature/Auth`
*Всего тестов: 31*

#### `EmailVerificationTest`
*Класс: `Tests\Feature\Auth\EmailVerificationTest` | Тестов: 5*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_user_can_resend_verification` | Проверяет повторную отправку письма верификации | Неподтверждённый пользователь (User::factory()->unverified()) | POST-запрос /api/v1/auth/email/resend-verification | assertOk() (200), assertJson(['result' => 'success']) |
| 2 | `test_verified_user_cannot_resend_verification` | Проверяет, что подтверждённый пользователь не может повторно запросить верификацию | Подтверждённый пользователь | POST-запрос /api/v1/auth/email/resend-verification | assertStatus(422), assertJsonPath('data.code', 'EMAIL_ALREADY_VERIFIED') |
| 3 | `test_email_verify_redirects_to_spa` | Проверяет редирект на SPA при верификации email | Неподтверждённый пользователь с email_verification_token='test-token-123' | GET-запрос /api/v1/auth/email/verify/test-token-123 | assertStatus(302) — редирект на фронтенд |
| 4 | `test_user_can_change_email` | Проверяет смену email пользователем | Пользователь | POST-запрос /api/v1/auth/email/change с JSON {"email": "newemail@example.com"} | assertOk() (200); assertEquals('newemail@example.com', email); assertNull(email_verified_at) |
| 5 | `test_change_email_to_duplicate_fails` | Проверяет, что смена email на занятый вызывает ошибку | Существующий пользователь с email='existing@example.com' | POST-запрос /api/v1/auth/email/change с JSON {"email": "existing@example.com"} | assertStatus(422) |

#### `LoginTest`
*Класс: `Tests\Feature\Auth\LoginTest` | Тестов: 5*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_user_can_login` | Проверяет успешный вход пользователя | Пользователь с email='test@example.com', password=bcrypt('password123') | POST-запрос /api/v1/auth/login с JSON {"email": "test@example.com", "password": "password123"} | assertOk() (200), assertJsonStructure(['result', 'message', 'data' => ['token', 'user']]) |
| 2 | `test_login_with_wrong_password_fails` | Проверяет, что неверный пароль возвращает ошибку INVALID_CREDENTIALS | Пользователь с email='test@example.com', password=bcrypt('password123') | POST-запрос /api/v1/auth/login с JSON {"email": "test@example.com", "password": "wrongpassword"} | assertStatus(401), assertJsonPath('data.code', 'INVALID_CREDENTIALS') |
| 3 | `test_login_with_nonexistent_email_fails` | Проверяет, что вход с несуществующим email возвращает 401 | Нет пользователя с таким email | POST-запрос /api/v1/auth/login с JSON {"email": "nonexistent@example.com", "password": "password123"} | assertStatus(401) |
| 4 | `test_login_requires_email_and_password` | Проверяет валидацию — пустые поля вызывают ошибку | Пустой JSON {} | POST-запрос /api/v1/auth/login | assertStatus(422) |
| 5 | `test_blocked_user_can_login_with_limited_access` | Проверяет, что заблокированный пользователь может войти с ограниченным доступом | Заблокированный пользователь (User::factory()->blocked()) | POST-запрос /api/v1/auth/login с корректными данными | assertOk() (200), assertJson(['result' => 'success']) |

#### `PasswordChangeTest`
*Класс: `Tests\Feature\Auth\PasswordChangeTest` | Тестов: 3*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_user_can_change_password` | Проверяет успешное изменение пароля | Пользователь с текущим паролем bcrypt('oldpassword') | POST-запрос /api/v1/auth/password/change с JSON {"current_password": "oldpassword", "password": "newpassword123", "password_confirmation": "newpassword123"} | assertOk() (200), assertJson(['result' => 'success']) |
| 2 | `test_change_password_with_wrong_current_fails` | Проверяет, что неверный текущий пароль вызывает ошибку | Пользователь с паролем bcrypt('oldpassword') | POST-запрос /api/v1/auth/password/change с JSON {"current_password": "wrongpassword"} | assertStatus(422), assertJsonPath('data.code', 'WRONG_PASSWORD') |
| 3 | `test_change_password_requires_authentication` | Проверяет, что неаутентифицированный пользователь не может изменить пароль | Нет пользователя | POST-запрос /api/v1/auth/password/change | assertUnauthorized() (401) |

#### `PasswordResetTest`
*Класс: `Tests\Feature\Auth\PasswordResetTest` | Тестов: 6*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_forgot_password_returns_success` | Проверяет успешный запрос восстановления пароля | Пользователь с email='test@example.com' | POST-запрос /api/v1/auth/password/forgot с JSON {"email": "test@example.com"} | assertOk() (200), assertJson(['result' => 'success']) |
| 2 | `test_forgot_password_for_nonexistent_email_still_returns_success` | Проверяет безопасность — несуществующий email также возвращает успех | Нет пользователя с таким email | POST-запрос /api/v1/auth/password/forgot с JSON {"email": "nonexistent@example.com"} | assertOk() (200), assertJson(['result' => 'success']) |
| 3 | `test_verify_reset_token_with_valid_token` | Проверяет успешную верификацию токена сброса пароля | Пользователь; PasswordResetCode с token='valid-token', code='123456', expires_at=+1 час | POST-запрос /api/v1/auth/password/verify-reset-token с JSON {"token": "valid-token", "email": "test@example.com"} | assertOk() (200), assertJson(['result' => 'success']) |
| 4 | `test_verify_invalid_reset_token_fails` | Проверяет, что невалидный токен возвращает ошибку | Нет PasswordResetCode | POST-запрос /api/v1/auth/password/verify-reset-token с JSON {"token": "invalid-token"} | assertStatus(422), assertJsonPath('data.code', 'INVALID_RESET_TOKEN') |
| 5 | `test_reset_password_with_valid_token` | Проверяет успешный сброс пароля | Пользователь; PasswordResetCode с token='valid-reset-token', code='123456', expires_at=+1 час | POST-запрос /api/v1/auth/password/reset с JSON {"token": "valid-reset-token", "password": "newpassword123", "password_confirmation": "newpassword123"} | assertOk() (200), assertJson(['result' => 'success']) |
| 6 | `test_reset_password_with_invalid_token_fails` | Проверяет, что сброс с невалидным токеном возвращает ошибку | Нет PasswordResetCode | POST-запрос /api/v1/auth/password/reset с JSON {"token": "invalid-token"} | assertStatus(422), assertJsonPath('data.code', 'INVALID_RESET_TOKEN') |

#### `RegistrationTest`
*Класс: `Tests\Feature\Auth\RegistrationTest` | Тестов: 5*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_user_can_register` | Проверяет успешную регистрацию нового пользователя | email='test@example.com', password='password123', password_confirmation='password123' | POST-запрос /api/v1/auth/register | assertStatus(201), assertJsonStructure(['result', 'message', 'data' => ['token', 'user']]); assertDatabaseHas('users', ['email' => 'test@example.com']) |
| 2 | `test_registration_with_duplicate_email_fails` | Проверяет, что регистрация с существующим email вызывает ошибку | Предварительно создан пользователь с email='test@example.com' | POST-запрос /api/v1/auth/register с тем же email | assertStatus(422), assertJson(['result' => 'error', 'data' => ['code' => 'VALIDATION_ERROR']]) |
| 3 | `test_registration_requires_password_confirmation` | Проверяет, что отсутствие password_confirmation вызывает ошибку | email='test@example.com', password='password123' (без password_confirmation) | POST-запрос /api/v1/auth/register | assertStatus(422) |
| 4 | `test_registration_requires_min_password_length` | Проверяет минимальную длину пароля | email='test@example.com', password='short', password_confirmation='short' | POST-запрос /api/v1/auth/register | assertStatus(422) |
| 5 | `test_registration_creates_pending_verification` | Проверяет, что после регистрации пользователь в статусе pending_email_verification | email='test@example.com', password='password123', password_confirmation='password123' | POST-запрос /api/v1/auth/register | assertStatus(201); assertEquals('pending_email_verification', account_status); assertNotNull(email_verification_deadline_at) |

#### `SessionTest`
*Класс: `Tests\Feature\Auth\SessionTest` | Тестов: 7*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_authenticated_user_can_get_their_profile` | Проверяет, что пользователь может получить свой профиль | Пользователь (User::factory()->create()) | GET-запрос /api/v1/auth/me | assertOk() (200), assertJsonPath('data.user.email', $user->email) |
| 2 | `test_unauthenticated_user_cannot_get_profile` | Проверяет, что неаутентифицированный пользователь не может получить профиль | Нет пользователя | GET-запрос /api/v1/auth/me | assertUnauthorized() (401) |
| 3 | `test_user_can_logout` | Проверяет выход из системы (удаление текущего токена) | Пользователь с токеном | POST-запрос /api/v1/auth/logout | assertOk() (200), assertJson(['result' => 'success']) |
| 4 | `test_user_can_logout_all_sessions` | Проверяет выход из всех сессий (удаление всех токенов) | Пользователь с двумя токенами | POST-запрос /api/v1/auth/logout-all | assertOk() (200); assertCount(0, $user->fresh()->tokens) |
| 5 | `test_user_can_list_sessions` | Проверяет получение списка активных сессий | Пользователь с токеном | GET-запрос /api/v1/auth/sessions | assertOk() (200), assertJsonStructure(['result', 'data' => ['items']]) |
| 6 | `test_user_can_delete_session` | Проверяет удаление конкретной сессии | Пользователь с 2 токенами и DeviceSession | DELETE-запрос /api/v1/auth/sessions/{id} | assertOk() (200) |
| 7 | `test_delete_nonexistent_session_returns_404` | Проверяет, что удаление несуществующей сессии возвращает 404 | Пользователь, несуществующий ID | DELETE-запрос /api/v1/auth/sessions/nonexistent-id | assertStatus(404) |

### `Feature/Comments`
*Всего тестов: 25*

#### `CommentSettingsTest`
*Класс: `Tests\Feature\Comments\CommentSettingsTest` | Тестов: 12*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_owner_can_get_shared_folder_comment_settings` | Проверяет, что владелец общей папки может получить настройки комментариев | Пользователь, SharedFolder | GET-запрос /api/v1/shared-folders/{folderId}/comment-settings | assertOk() (200), assertJsonStructure(['data' => ['settings' => ['shared_comments_mode', 'mentions_enabled']]]) |
| 2 | `test_editor_can_get_shared_folder_comment_settings` | Проверяет, что редактор может получить настройки комментариев | Владелец, редактор, SharedFolder, SharedFolderAccess (edit) | GET-запрос от имени редактора | assertOk() (200) |
| 3 | `test_viewer_cannot_get_shared_folder_comment_settings` | Проверяет, что зритель не может получить настройки комментариев | Владелец, зритель, SharedFolder | GET-запрос от имени зрителя | assertStatus(403) |
| 4 | `test_get_shared_folder_settings_nonexistent_returns_404` | Проверяет запрос настроек несуществующей папки | Пользователь | GET-запрос /api/v1/shared-folders/nonexistent/comment-settings | assertStatus(404) |
| 5 | `test_owner_can_update_shared_folder_comment_settings` | Проверяет обновление настроек комментариев общей папки владельцем | Пользователь, SharedFolder | PATCH-запрос с JSON: sharedCommentsMode='disabled', mentionsEnabled=false | assertOk() (200) |
| 6 | `test_editor_can_update_shared_folder_comment_settings` | Проверяет, что редактор может обновить настройки | Владелец, редактор, SharedFolder, SharedFolderAccess (edit) | PATCH-запрос от имени редактора с телом mentionsEnabled=false | assertOk() (200) |
| 7 | `test_viewer_cannot_update_shared_folder_comment_settings` | Проверяет, что зритель не может обновить настройки | Владелец, зритель, SharedFolder | PATCH-запрос от имени зрителя | assertStatus(403) |
| 8 | `test_update_shared_folder_settings_invalid_value_fails` | Проверяет валидацию — недопустимое sharedCommentsMode вызывает ошибку | Пользователь, SharedFolder | PATCH-запрос с sharedCommentsMode='invalid_value' | assertStatus(422) |
| 9 | `test_owner_can_update_local_folder_comment_settings` | Проверяет обновление настроек комментариев локальной папки | Пользователь, Folder (локальная папка) | PATCH-запрос /api/v1/local-folders/{folderId}/comment-settings с JSON: privateCommentsEnabled=false | assertOk() (200) |
| 10 | `test_other_user_cannot_update_local_folder_comment_settings` | Проверяет, что другой пользователь не может обновить настройки чужой папки | Владелец, другой пользователь, Folder | PATCH-запрос от имени другого пользователя | assertStatus(404) |
| 11 | `test_update_local_folder_settings_nonexistent_returns_404` | Проверяет обновление настроек несуществующей папки | Пользователь | PATCH-запрос /api/v1/local-folders/nonexistent/comment-settings | assertStatus(404) |
| 12 | `test_unauthenticated_cannot_access_comment_settings` | Проверяет, что неаутентифицированный пользователь не может получить настройки | Нет пользователя | GET-запрос /api/v1/shared-folders/some-id/comment-settings | assertUnauthorized() (401) |

#### `CommentTest`
*Класс: `Tests\Feature\Comments\CommentTest` | Тестов: 13*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_user_can_list_comment_threads` | Проверяет, что пользователь может получить список тредов комментариев для файла | Пользователь, файл с доступом (FileUserAccess) | GET-запрос /api/v1/comment-threads?targetType=file&targetId=<id>&scope=all | assertOk() (200), assertJsonPath('result', 'success'), assertJsonStructure(['data' => ['policy', 'threads']]) |
| 2 | `test_user_can_create_comment_on_file` | Проверяет создание комментария к файлу | Пользователь, файл с доступом | POST-запрос /api/v1/comments с JSON: targetType=file, targetId=<id>, scope=private, body='Nice file!' | assertStatus(201), assertJsonPath('data.comment.body', 'Nice file!') |
| 3 | `test_user_can_reply_to_comment` | Проверяет ответ на существующий комментарий | Пользователь, файл, родительский комментарий | POST-запрос /api/v1/comments с JSON: threadId=<id>, body='Reply!', parentCommentId=<id> | assertStatus(201), assertJsonPath('data.comment.body', 'Reply!') |
| 4 | `test_user_can_update_own_comment` | Проверяет редактирование своего комментария | Пользователь, файл, комментарий 'Original' | PATCH-запрос /api/v1/comments/{commentId} с JSON {"body": "Updated"} | assertOk() (200), assertJsonPath('data.comment.body', 'Updated') |
| 5 | `test_user_cannot_update_others_comment` | Проверяет, что пользователь не может редактировать чужой комментарий | Два пользователя (author, other), файл, комментарий автора | PATCH-запрос /api/v1/comments/{commentId} от имени other с телом "Hacked" | assertStatus(403) |
| 6 | `test_user_can_delete_own_comment` | Проверяет удаление своего комментария | Пользователь, файл, комментарий 'Delete me' | DELETE-запрос /api/v1/comments/{commentId} | assertOk() (200) |
| 7 | `test_user_cannot_delete_others_comment` | Проверяет, что пользователь не может удалить чужой комментарий | Два пользователя, файл, комментарий автора | DELETE-запрос /api/v1/comments/{commentId} от имени other | assertStatus(403) |
| 8 | `test_user_can_mark_thread_as_read` | Проверяет отметку треда как прочитанного | Пользователь, файл, комментарий | POST-запрос /api/v1/comment-threads/{threadId}/read | assertOk() (200) |
| 9 | `test_owner_can_update_file_comment_settings` | Проверяет обновление настроек комментариев файла владельцем | Пользователь, файл с доступом | PATCH-запрос /api/v1/files/{fileId}/comment-settings с JSON: sharedCommentsEnabled=false, mentionsEnabled=true | assertOk() (200), assertJsonPath('result', 'success') |
| 10 | `test_non_owner_cannot_update_file_comment_settings` | Проверяет, что не-владелец не может изменить настройки комментариев | Два пользователя, файл | PATCH-запрос /api/v1/files/{fileId}/comment-settings от имени other | assertStatus(403) |
| 11 | `test_creating_comment_without_thread_or_target_fails` | Проверяет валидацию — комментарий без thread/target вызывает ошибку | Пользователь | POST-запрос /api/v1/comments с JSON: body='Orphan' (без target/thread) | assertStatus(422) |
| 12 | `test_creating_comment_with_empty_body_fails` | Проверяет валидацию — пустое body вызывает ошибку | Пользователь, файл | POST-запрос /api/v1/comments с body='' | assertStatus(422) |
| 13 | `test_unauthenticated_user_cannot_access_comments` | Проверяет, что неаутентифицированный пользователь не может получить список тредов | Нет пользователя | GET-запрос /api/v1/comment-threads | assertUnauthorized() (401) |

### `Feature/Contacts`
*Всего тестов: 27*

#### `ContactRequestTest`
*Класс: `ContactRequestTest` | Тестов: 7*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_list_returns_pending_requests` | Проверяет, что аутентифицированный пользователь может получить список входящих запросов на добавление в контакты. Эндпоинт возвращает только pending-запросы и правильную структуру ответа. | User (создаётся через фабрику), requester (User), ContactRequest со статусом 'pending' | GET /api/v1/contact-requests (actingAs user) | assertOk, assertJsonPath('result', 'success'), assertJsonStructure с items, assertCount(1) |
| 2 | `test_list_returns_only_pending_requests` | Проверяет, что в списке отображаются только запросы со статусом 'pending', а принятые запросы не попадают в выдачу. | User, requester (User), otherRequester (User); два ContactRequest: один pending, другой accepted | GET /api/v1/contact-requests (actingAs user) | assertOk, assertCount(1) |
| 3 | `test_accept_request_updates_status` | Проверяет, что владелец запроса может принять входящий запрос на добавление в контакты. Статус запроса меняется на 'accepted'. | User, requester (User), Contact (с email пользователя), ContactRequest со статусом 'pending' | POST /api/v1/contact-requests/{id}/accept (actingAs user) | assertOk, assertJsonPath('result', 'success'), assertDatabaseHas status=accepted |
| 4 | `test_accept_nonexistent_request_returns_404` | Проверяет, что попытка принять несуществующий запрос возвращает 404. | User, несуществующий ID 'nonexistent-id' | POST /api/v1/contact-requests/nonexistent-id/accept (actingAs user) | assertStatus(404) |
| 5 | `test_reject_request_updates_status` | Проверяет, что владелец запроса может отклонить входящий запрос на добавление в контакты. Статус запроса меняется на 'rejected'. | User, requester (User), ContactRequest со статусом 'pending' | POST /api/v1/contact-requests/{id}/reject (actingAs user) | assertOk, assertJsonPath('result', 'success'), assertDatabaseHas status=rejected |
| 6 | `test_reject_other_users_request_returns_404` | Проверяет, что пользователь не может отклонить запрос, адресованный другому пользователю — возвращается 404. | User, other (User), requester (User); ContactRequest на other | POST /api/v1/contact-requests/{id}/reject (actingAs user) | assertStatus(404) |
| 7 | `test_unauthenticated_user_cannot_access_contact_requests` | Проверяет, что неаутентифицированный пользователь не может получить список запросов — возвращается 401. | Без аутентификации | GET /api/v1/contact-requests | assertUnauthorized |

#### `ContactResolveHistoryTest`
*Класс: `ContactResolveHistoryTest` | Тестов: 10*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_resolve_links_contacts_by_email` | Проверяет, что при разрешении контактов по email система находит совпадения среди зарегистрированных пользователей и связывает контакт с resolved_user_id. Возвращается количество новых разрешённых контактов. | User, registered (User), Contact (с email registered->email, resolved_user_id=null) | POST /api/v1/contacts/resolve (actingAs user) | assertOk, assertJsonPath('data.newly_resolved', 1) |
| 2 | `test_resolve_links_contacts_by_phone` | Проверяет разрешение контактов по номеру телефона. Если у зарегистрированного пользователя совпадает телефон, контакт разрешается. | User, registered (User с phone='+79991112233'), Contact (с phone='+79991112233', email=null, resolved_user_id=null) | POST /api/v1/contacts/resolve (actingAs user) | assertOk, assertJsonPath('data.newly_resolved', 1) |
| 3 | `test_resolve_skips_already_resolved_contacts` | Проверяет, что уже разрешённые контакты пропускаются при повторном разрешении — returned 0 новых. | User, registered (User), Contact (с resolved_user_id = registered->id) | POST /api/v1/contacts/resolve (actingAs user) | assertOk, assertJsonPath('data.newly_resolved', 0) |
| 4 | `test_resolve_returns_zero_when_no_contacts` | Проверяет, что при отсутствии контактов возвращается 0 новых разрешений. | User (без контактов) | POST /api/v1/contacts/resolve (actingAs user) | assertOk, assertJsonPath('data.newly_resolved', 0) |
| 5 | `test_history_returns_shared_files_for_contact` | Проверяет, что для контакта отображается история отправленных файлов. Возвращается список объектов FileUserAccess. | User, recipient (User), File, Contact resolvedTo recipient, FileUserAccess с access_type='shared' | GET /api/v1/contacts/{contact->id}/history (actingAs user) | assertOk, assertJsonPath('result', 'success'), assertJsonStructure, assertCount(1) |
| 6 | `test_history_returns_empty_when_no_shares` | Проверяет, что если с контактом не было общих файлов, то история пуста. | User, Contact (без FileUserAccess) | GET /api/v1/contacts/{contact->id}/history (actingAs user) | assertOk, assertJsonPath('data.items', []) |
| 7 | `test_history_other_users_contact_returns_404` | Проверяет, что нельзя просмотреть историю контакта, принадлежащего другому пользователю — возвращается 404. | User, other (User), Contact (принадлежит other) | GET /api/v1/contacts/{contact->id}/history (actingAs user) | assertStatus(404) |
| 8 | `test_history_nonexistent_contact_returns_404` | Проверяет, что запрос истории для несуществующего контакта возвращает 404. | User, несуществующий ID 'nonexistent' | GET /api/v1/contacts/nonexistent/history (actingAs user) | assertStatus(404) |
| 9 | `test_unauthenticated_cannot_resolve` | Проверяет, что неаутентифицированный пользователь не может выполнить разрешение контактов. | Без аутентификации | POST /api/v1/contacts/resolve | assertUnauthorized |
| 10 | `test_unauthenticated_cannot_view_history` | Проверяет, что неаутентифицированный пользователь не может просмотреть историю контакта. | Без аутентификации | GET /api/v1/contacts/some-id/history | assertUnauthorized |

#### `ContactTest`
*Класс: `Tests\Feature\Contacts\ContactTest` | Тестов: 10*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_user_can_list_contacts` | Проверяет, что пользователь может получить список своих контактов | Пользователь, 3 контакта | GET-запрос /api/v1/contacts | assertOk() (200), assertJsonPath('result', 'success') |
| 2 | `test_user_can_create_contact_with_email` | Проверяет создание контакта с email | Пользователь | POST-запрос /api/v1/contacts с JSON: name='John Doe', email='john@example.com' | assertStatus(201), assertDatabaseHas('contacts', ['email' => 'john@example.com']) |
| 3 | `test_user_can_create_contact_with_phone` | Проверяет создание контакта с телефоном | Пользователь | POST-запрос /api/v1/contacts с JSON: name='Jane Doe', phone='+1234567890' | assertStatus(201), assertDatabaseHas('contacts', ['phone' => '+1234567890']) |
| 4 | `test_contact_creation_without_email_or_phone_fails` | Проверяет валидацию — хотя бы одно из полей email/phone обязательно | Пользователь | POST-запрос /api/v1/contacts с JSON: name='No Contact Info' | assertStatus(422) |
| 5 | `test_creating_duplicate_contact_email_fails` | Проверяет, что дубликат email вызывает ошибку | Пользователь, существующий контакт с email='existing@example.com' | POST-запрос /api/v1/contacts с тем же email | assertStatus(422) |
| 6 | `test_user_can_show_contact` | Проверяет просмотр данных контакта | Пользователь, контакт | GET-запрос /api/v1/contacts/{contactId} | assertOk() (200), assertJsonPath('data.contact.id', $contact->id) |
| 7 | `test_showing_other_users_contact_returns_404` | Проверяет, что чужой контакт возвращает 404 | Два пользователя, контакт второго | GET-запрос от имени первого пользователя | assertStatus(404) |
| 8 | `test_user_can_delete_contact` | Проверяет удаление контакта | Пользователь, контакт | DELETE-запрос /api/v1/contacts/{contactId} | assertOk() (200), assertDatabaseMissing('contacts', ['id' => $contact->id]) |
| 9 | `test_user_can_import_contacts` | Проверяет массовый импорт контактов | Пользователь | POST-запрос /api/v1/contacts/import с JSON: contacts = [['name'=>'Alice', 'email'=>'alice@example.com'], ['name'=>'Bob', 'email'=>'bob@example.com']] | assertOk() (200), assertJsonPath('data.imported', 2) |
| 10 | `test_unauthenticated_user_cannot_access_contacts` | Проверяет, что неаутентифицированный пользователь не может получить список контактов | Нет пользователя | GET-запрос /api/v1/contacts | assertUnauthorized() (401) |

### `Feature/Documents`
*Всего тестов: 47*

#### `DocumentControllerTest`
*Класс: `Tests\Feature\Documents\DocumentControllerTest` | Тестов: 24*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_owner_can_create_markdown_document` | Проверяет создание Markdown-документа с добавлением .md. | User, payload: fileName='TestDoc' | POST /api/v1/documents (actingAs user) | assertStatus(201), assertJsonPath('data.file.is_editable', true), assertJsonPath('data.file.editor_type', 'markdown'), assertStringEndsWith('.md', fileName) |
| 2 | `test_create_document_appends_md_extension` | Проверяет, что .md добавляется, если не указан. | User, payload: fileName='Doc.md' | POST /api/v1/documents | assertStatus(201), fileName='Doc.md' (без дублирования) |
| 3 | `test_create_document_requires_file_name` | Проверяет валидацию — fileName обязателен. | User, payload: {} | POST /api/v1/documents | assertStatus(422) |
| 4 | `test_owner_can_view_document` | Проверяет просмотр документа владельцем. | User, File (is_editable=true, editor_type='markdown') | GET /api/v1/documents/{id} (actingAs user) | assertOk(), assertJsonPath('data.file.id', $file->id), assertJsonStructure с content |
| 5 | `test_shared_user_can_view_document` | Проверяет просмотр shared-пользователем. | owner, shared (FileUserAccess), File | GET /api/v1/documents/{id} (actingAs shared) | assertOk() |
| 6 | `test_non_access_user_cannot_view_document` | Проверяет, что без доступа — 403. | owner, other, File | GET /api/v1/documents/{id} (actingAs other) | assertStatus(403) |
| 7 | `test_non_markdown_file_returns_404` | Проверяет, что не-markdown файл возвращает 404. | User, File (is_editable=false) | GET /api/v1/documents/{id} | assertStatus(404) |
| 8 | `test_owner_can_save_document` | Проверяет сохранение документа владельцем. | User, File markdown, lock захвачен, content | PUT /api/v1/documents/{id} (actingAs user) с content, etag | assertOk(), assertJsonPath('result', 'success') |
| 9 | `test_update_document_checks_lock` | Проверяет, что без блокировки — 423 LOCK_REQUIRED. | User, File markdown, нет lock | PUT /api/v1/documents/{id} без lock | assertStatus(423), assertJsonPath('data.code', 'LOCK_REQUIRED') |
| 10 | `test_update_document_with_wrong_etag_returns_409` | Проверяет конфликт etag — 409 DOCUMENT_CONFLICT. | User, File, lock, content; etag не совпадает | PUT /api/v1/documents/{id} с неверным etag | assertStatus(409), assertJsonPath('data.code', 'DOCUMENT_CONFLICT'), assertJsonStructure с currentState |
| 11 | `test_non_owner_can_save_with_can_edit` | Проверяет, что shared-пользователь с can_edit=true может сохранять. | owner, shared (can_edit=true), File, lock захвачен shared | PUT /api/v1/documents/{id} (actingAs shared) | assertOk() |
| 12 | `test_shared_without_can_edit_cannot_save` | Проверяет, что shared-пользователь без can_edit не может сохранять. | owner, shared (can_edit=false), File | PUT /api/v1/documents/{id} (actingAs shared) | assertStatus(403) |
| 13 | `test_save_with_quota_exceeded_returns_413` | Проверяет, что при превышении квоты возвращается 413. | User, File, lock, content; StorageService имитирует превышение | PUT /api/v1/documents/{id} | assertStatus(413), assertJsonPath('data.code', 'quota_exceeded') |
| 14 | `test_save_updates_etag_and_updated_by` | Проверяет, что после сохранения etag и updated_by обновлены. | User, File, lock, content | PUT /api/v1/documents/{id} | assertJsonPath('data.etag', новый etag), assertJsonPath('data.updatedBy.id', $user->id) |
| 15 | `test_update_document_content_in_s3` | Проверяет, что content сохраняется/обновляется в S3 (Storage::fake()). | User, File, lock, content='# Hello' | PUT /api/v1/documents/{id} с content | Storage assertExists |
| 16 | `test_owner_can_update_can_edit_flag` | Проверяет обновление can_edit владельцем. | owner, shared (User), File, FileUserAccess (shared, can_edit=false) | PATCH /api/v1/files/{id}/accesses/{accessId} (actingAs owner) с {can_edit: true} | assertOk(), assertDatabaseHas('file_user_access', ['can_edit' => true]) |
| 17 | `test_non_owner_cannot_update_can_edit` | Проверяет, что не-владелец не может изменить can_edit. | owner, other, File, FileUserAccess | PATCH /api/v1/files/{id}/accesses/{accessId} (actingAs other) | assertStatus(404) |
| 18 | `test_can_edit_update_requires_boolean` | Проверяет валидацию — can_edit обязателен и boolean. | owner, File, FileUserAccess | PATCH /api/v1/files/{id}/accesses/{accessId} без can_edit | assertStatus(422) |
| 19 | `test_document_content_normalizes_image_urls` | Проверяет, что presigned URL заменяются на stable URL при сохранении. | User, File, lock, content с presigned S3 URL | PUT /api/v1/documents/{id} | S3 URL заменён на /api/v1/files/{id}/content |
| 20 | `test_document_content_hydrates_image_urls` | Проверяет, что stable URL заменяются на presigned при чтении. | User, File, content с /api/v1/files/{id}/content | GET /api/v1/documents/{id} | content содержит presigned S3 URL |
| 21 | `test_view_document_via_shared_folder_access` | Проверяет просмотр через общую папку. | owner, editor, SharedFolder, SharedFolderAccess edit, SharedFolderFile, File markdown | GET /api/v1/documents/{id} (actingAs editor) | assertOk() |
| 22 | `test_edit_document_via_shared_folder_access` | Проверяет редактирование через общую папку (can_edit не проверяется, т.к. через shared folder). | owner, editor, SharedFolder, SharedFolderAccess edit, SharedFolderFile, File markdown, lock | PUT /api/v1/documents/{id} (actingAs editor) с content, etag | assertOk() |
| 23 | `test_nonexistent_document_returns_404` | Проверяет, что несуществующий документ возвращает 404. | User | GET /api/v1/documents/nonexistent | assertStatus(404) |
| 24 | `test_unauthenticated_user_cannot_access_documents` | Проверяет, что без auth — 401. | Нет пользователя | GET /api/v1/documents/some-id | assertUnauthorized() |

#### `DocumentLockControllerTest`
*Класс: `Tests\Feature\Documents\DocumentLockControllerTest` | Тестов: 14*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_user_can_acquire_lock` | Проверяет захват блокировки. | User, File markdown, canEditDocument=true | POST /api/v1/documents/{id}/lock (actingAs user) | assertStatus(201), assertDatabaseHas('document_locks', ['file_id' => $file->id, 'user_id' => $user->id]) |
| 2 | `test_cannot_acquire_lock_if_already_locked_by_other` | Проверяет, что при блокировке другим пользователем — 423. | User, other, File, DocumentLock на other | POST /api/v1/documents/{id}/lock (actingAs user) | assertStatus(423), assertJsonPath('data.code', 'LOCK_CONFLICT'), assertJsonStructure с lock info |
| 3 | `test_same_user_can_reacquire_lock` | Проверяет, что тот же пользователь может перезахватить блокировку. | User, File, DocumentLock на user | POST /api/v1/documents/{id}/lock (actingAs user) | assertStatus(201) |
| 4 | `test_can_acquire_expired_lock` | Проверяет, что можно захватить истекшую блокировку. | User, File, DocumentLock на other (expires_at в прошлом) | POST /api/v1/documents/{id}/lock (actingAs user) | assertStatus(201) |
| 5 | `test_cannot_acquire_lock_without_edit_permission` | Проверяет, что без can_edit — 403. | owner, shared (can_edit=false), File, FileUserAccess | POST /api/v1/documents/{id}/lock (actingAs shared) | assertStatus(403) |
| 6 | `test_owner_can_takeover_lock` | Проверяет перехват блокировки владельцем. | owner, other, File, DocumentLock на other | POST /api/v1/documents/{id}/lock/takeover (actingAs owner) | assertOk(), assertDatabaseHas('document_locks', ['file_id' => $file->id, 'user_id' => $owner->id]) |
| 7 | `test_non_owner_cannot_takeover` | Проверяет, что не-владелец не может перехватить блокировку. | owner, shared, other, File, DocumentLock на other | POST /api/v1/documents/{id}/lock/takeover (actingAs shared) | assertStatus(403) |
| 8 | `test_takeover_nonexistent_lock` | Проверяет перехват без активной блокировки. | owner, File (нет DocumentLock) | POST /api/v1/documents/{id}/lock/takeover (actingAs owner) | assertOk(), создаётся новая блокировка |
| 9 | `test_user_can_renew_lock_with_heartbeat` | Проверяет продление блокировки heartbeat. | User, File, DocumentLock на user | POST /api/v1/documents/{id}/lock/heartbeat (actingAs user) | assertOk(), expires_at обновлён |
| 10 | `test_heartbeat_fails_if_lock_expired` | Проверяет heartbeat для истекшей блокировки — 423 LOCK_EXPIRED. | User, File, DocumentLock на user (expires_at в прошлом) | POST /api/v1/documents/{id}/lock/heartbeat (actingAs user) | assertStatus(423), assertJsonPath('data.code', 'LOCK_EXPIRED') |
| 11 | `test_heartbeat_fails_if_lock_taken_over` | Проверяет heartbeat для забранной блокировки — 423 LOCK_TAKEN_OVER. | User, File, DocumentLock на other | POST /api/v1/documents/{id}/lock/heartbeat (actingAs user) | assertStatus(423), assertJsonPath('data.code', 'LOCK_TAKEN_OVER'), assertJsonStructure с lockedBy |
| 12 | `test_user_can_release_lock` | Проверяет снятие блокировки. | User, File, DocumentLock на user | DELETE /api/v1/documents/{id}/lock (actingAs user) | assertStatus(204), assertDatabaseMissing('document_locks', ['file_id' => $file->id]) |
| 13 | `test_release_nonexistent_lock_is_idempotent` | Проверяет идемпотентность — удаление несуществующей блокировки возвращает 204. | User, File (нет DocumentLock) | DELETE /api/v1/documents/{id}/lock (actingAs user) | assertStatus(204) |
| 14 | `test_unauthenticated_user_cannot_access_lock_endpoints` | Проверяет, что без auth — 401. | Нет пользователя | POST /api/v1/documents/some-id/lock | assertUnauthorized() |

#### `AssetControllerTest`
*Класс: `Tests\Feature\Documents\AssetControllerTest` | Тестов: 9*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_user_can_list_their_own_images` | Проверяет список изображений владельца. | User, 3 File (image/png, owner_id=user), статус Available | GET /api/v1/assets/images (actingAs user) | assertOk(), assertCount(3, items), assertJsonPath('result', 'success') |
| 2 | `test_user_can_list_images_shared_with_them` | Проверяет доступ к изображениям, расшаренным пользователю. | owner, user, File (image/png), FileUserAccess (shared) | GET /api/v1/assets/images (actingAs user) | assertOk(), items содержит shared-изображение |
| 3 | `test_images_exclude_non_image_mime_types` | Проверяет, что не-изображения исключены из списка. | User, File (text/plain), File (image/png) | GET /api/v1/assets/images | items содержит только image/png |
| 4 | `test_images_include_only_available_status` | Проверяет, что файлы со статусом, отличным от Available, не показываются. | User, 2 File (image/png): один Available, один uploading | GET /api/v1/assets/images | assertCount(1, items) |
| 5 | `test_images_filter_by_search` | Проверяет поиск по имени. | User, File 'photo.png', File 'document.png' | GET /api/v1/assets/images?search=photo | assertCount(1, items); fileName === 'photo.png' |
| 6 | `test_images_cursor_pagination` | Проверяет курсорную пагинацию. | User, 3 изображения; per_page=2 | GET /api/v1/assets/images?per_page=2 | assertCount(2, items); nextCursor не null; второй запрос с cursor возвращает последнее |
| 7 | `test_images_include_stable_url_format` | Проверяет, что каждое изображение содержит stableUrl=/api/v1/files/{id}/content. | User, File image/png | GET /api/v1/assets/images | assertStringContainsString('/api/v1/files/', item.stableUrl) |
| 8 | `test_images_include_width_and_height` | Проверяет, что ответ содержит width и height. | User, File (image/png, width=800, height=600) | GET /api/v1/assets/images | item.width === 800, item.height === 600 |
| 9 | `test_unauthenticated_cannot_list_images` | Проверяет, что без auth — 401. | Нет пользователя | GET /api/v1/assets/images | assertUnauthorized() |

### `Feature/Files`
*Всего тестов: 50*

#### `FileActionsTest`
*Класс: `FileActionsTest` | Тестов: 11*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_user_can_pin_file` | Проверяет, что пользователь может закрепить файл (pin). | User, File (owner_id=user), FileUserAccess owner (в setUp) | POST /api/v1/files/{id}/pin (actingAs user) | assertOk |
| 2 | `test_user_can_unpin_file` | Проверяет, что пользователь может открепить ранее закреплённый файл (unpin). Сначала выполняет pin, затем unpin. | User, File, FileUserAccess owner (в setUp) | POST /api/v1/files/{id}/pin, затем POST /api/v1/files/{id}/unpin (actingAs user) | assertOk (оба запроса) |
| 3 | `test_user_can_favorite_file` | Проверяет, что пользователь может добавить файл в избранное. | User, File, FileUserAccess owner (в setUp) | POST /api/v1/files/{id}/favorite (actingAs user) | assertOk |
| 4 | `test_user_can_unfavorite_file` | Проверяет, что пользователь может удалить файл из избранного. Сначала выполняет favorite, затем unfavorite. | User, File, FileUserAccess owner (в setUp) | POST /api/v1/files/{id}/favorite, затем POST /api/v1/files/{id}/unfavorite (actingAs user) | assertOk (на unfavorite) |
| 5 | `test_user_can_move_file_to_folder` | Проверяет перемещение файла в указанную папку организации. | User, File, FileUserAccess owner, Folder (user_id=user); payload: folder_id | POST /api/v1/files/{id}/move-folder (actingAs user) с folder_id | assertOk |
| 6 | `test_user_can_clear_folder` | Проверяет, что можно убрать файл из папки, передав folder_id=null. | User, File, FileUserAccess owner; payload: folder_id=null | POST /api/v1/files/{id}/move-folder (actingAs user) с folder_id=null | assertOk |
| 7 | `test_user_can_set_tags_on_file` | Проверяет установку тегов на файл — передаётся массив tag_ids. | User, File, FileUserAccess owner, Tag (user_id=user); payload: tag_ids=[tag->id] | POST /api/v1/files/{id}/set-tags (actingAs user) | assertOk |
| 8 | `test_user_can_update_description` | Проверяет обновление описания файла. | User, File, FileUserAccess owner; payload: description='New description' | PATCH /api/v1/files/{id}/description (actingAs user) | assertOk |
| 9 | `test_user_can_view_file_activity` | Проверяет, что пользователь может просмотреть активность (историю действий) по файлу. | User, File, FileUserAccess owner | GET /api/v1/files/{id}/activity (actingAs user) | assertOk, assertJsonStructure с items |
| 10 | `test_owner_can_view_file_accesses` | Проверяет, что владелец может просмотреть список доступов (кому расшарен файл). | User, File, FileUserAccess owner | GET /api/v1/files/{id}/accesses (actingAs user) | assertOk, assertJsonStructure с items |
| 11 | `test_non_owner_cannot_view_accesses` | Проверяет, что не-владелец не может просмотреть список доступов к файлу — возвращается 404. | User, other (User), File, FileUserAccess owner (для user); other не имеет доступа | GET /api/v1/files/{id}/accesses (actingAs other) | assertStatus(404) |

#### `FileDeleteTest`
*Класс: `FileDeleteTest` | Тестов: 3*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_owner_can_soft_delete_file` | Проверяет, что владелец может мягко удалить файл (soft delete). Файл помечается как удалённый, но остаётся в БД. | User, File (owner_id=user), FileUserAccess owner | DELETE /api/v1/files/{file->id} (actingAs user) | assertOk, assertSoftDeleted(file) |
| 2 | `test_shared_user_can_detach_file` | Проверяет, что пользователь, которому расшарен файл, может открепить его от себя — запись FileUserAccess удаляется. | owner (User), shared (User), File (owner_id=owner), FileUserAccess (user_id=shared) | DELETE /api/v1/files/{file->id} (actingAs shared) | assertOk, assertDatabaseMissing file_user_access |
| 3 | `test_user_without_access_cannot_delete` | Проверяет, что пользователь без доступа не может удалить/открепить файл — возвращается 404. | owner (User), other (User), File (owner_id=owner), без FileUserAccess | DELETE /api/v1/files/{file->id} (actingAs other) | assertStatus(404) |

#### `FileDownloadTest`
*Класс: `FileDownloadTest` | Тестов: 3*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_user_can_download_file` | Проверяет, что владелец файла может получить ссылку на скачивание. Используется fake S3 storage. | User, File (owner_id=user), FileUserAccess owner, Storage::fake('s3') | POST /api/v1/files/{id}/download (actingAs user) | assertOk, assertJsonStructure с url |
| 2 | `test_download_unavailable_file_fails` | Проверяет, что нельзя скачать файл, который ещё не загружен (статус 'uploading') — возвращается FILE_NOT_AVAILABLE. | User, File uploading (owner_id=user), FileUserAccess owner | POST /api/v1/files/{id}/download (actingAs user) | assertStatus(422), assertJsonPath('data.code', 'FILE_NOT_AVAILABLE') |
| 3 | `test_user_without_access_cannot_download` | Проверяет, что пользователь без доступа не может скачать файл — возвращается 403. | owner (User), other (User), File (owner_id=owner), без FileUserAccess для other | POST /api/v1/files/{id}/download (actingAs other) | assertStatus(403) |

#### `FileIndexTest`
*Класс: `FileIndexTest` | Тестов: 5*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_user_can_list_owned_files` | Проверяет, что пользователь может получить список своих файлов с фильтром 'mine'. Ответ содержит структуру с items и pagination. | User, 3 File (owner_id=user); query filter=mine | GET /api/v1/files?filter=mine (actingAs user) | assertOk, assertJsonStructure с items и pagination |
| 2 | `test_user_can_list_received_files` | Проверяет, что пользователь может получить список файлов, расшаренных ему другими пользователями, с фильтром 'received'. | User, owner (User), File (owner_id=owner), FileUserAccess (user_id=user); query filter=received | GET /api/v1/files?filter=received (actingAs user) | assertOk |
| 3 | `test_user_can_list_favorite_files` | Проверяет, что пользователь может получить список избранных файлов с фильтром 'favorites'. | User, File (owner_id=user), FileUserAccess owner + favorite; query filter=favorites | GET /api/v1/files?filter=favorites (actingAs user) | assertOk |
| 4 | `test_file_list_supports_pagination` | Проверяет работу пагинации — при per_page=10 возвращается 10 элементов, а total равен 25. | User, 25 File (owner_id=user); query per_page=10&page=1 | GET /api/v1/files?per_page=10&page=1 (actingAs user) | assertOk, assertCount(10), assertEquals(25, pagination.total) |
| 5 | `test_file_list_supports_search` | Проверяет поиск по имени файла — возвращается только один файл с matching именем. | User, File 'unique_document.pdf' и 'other_file.txt' (owner_id=user); query search=unique | GET /api/v1/files?search=unique (actingAs user) | assertOk, assertCount(1) |

#### `FileShowTest`
*Класс: `FileShowTest` | Тестов: 5*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_owner_can_view_file` | Проверяет, что владелец файла может просмотреть его детали через API. | User, File (owner_id=user), FileUserAccess типа owner | GET /api/v1/files/{file->id} (actingAs user) | assertOk, assertJson(['result' => 'success']) |
| 2 | `test_shared_user_can_view_file` | Проверяет, что пользователь, которому файл расшарен, может его просмотреть. | owner (User), shared (User), File (owner_id=owner), FileUserAccess (user_id=shared) | GET /api/v1/files/{file->id} (actingAs shared) | assertOk |
| 3 | `test_user_without_access_cannot_view_file` | Проверяет, что пользователь без доступа не может просмотреть файл — возвращается 403. | owner (User), other (User), File (owner_id=owner), без FileUserAccess | GET /api/v1/files/{file->id} (actingAs other) | assertStatus(403) |
| 4 | `test_nonexistent_file_returns_404` | Проверяет, что запрос несуществующего файла возвращает 404. | User, несуществующий ID 'nonexistent-id' | GET /api/v1/files/nonexistent-id (actingAs user) | assertStatus(404) |
| 5 | `test_unauthenticated_user_cannot_view_file` | Проверяет, что неаутентифицированный пользователь не может просмотреть файл. | File (без аутентификации) | GET /api/v1/files/{file->id} | assertUnauthorized |

#### `FileUploadTest`
*Класс: `FileUploadTest` | Тестов: 6*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_init_upload_returns_presigned_url` | Проверяет инициализацию загрузки файла — сервис возвращает presigned URL для S3. Используется мок FileService для проверки квоты и возврата данных. | User, Mock FileService (checkStorageQuota->true, initUpload->file + upload_url); payload: original_name='test.pdf', size=1024, mime_type='application/pdf' | POST /api/v1/files/init-upload (actingAs user) | assertStatus(201), assertJsonStructure с 'file' и 'upload_url' |
| 2 | `test_init_upload_exceeding_file_size_limit_fails` | Проверяет, что при превышении лимита размера файла возвращается ошибка валидации. | User; payload: original_name='huge.pdf', size=999999999999, mime_type='application/pdf' | POST /api/v1/files/init-upload (actingAs user) | assertStatus(422), assertJsonPath('data.code', 'VALIDATION_ERROR') |
| 3 | `test_init_upload_exceeding_storage_quota_fails` | Проверяет, что при превышении квоты хранилища (500MB для бесплатного плана) возвращается ошибка STORAGE_LIMIT_EXCEEDED. Создаётся 10 файлов по 50MB. | User, 10 File по 50MB (owner_id=user), payload: size=1048576 (1MB) | POST /api/v1/files/init-upload (actingAs user) | assertStatus(422), assertJsonPath('data.code', 'STORAGE_LIMIT_EXCEEDED') |
| 4 | `test_complete_upload` | Проверяет завершение загрузки — статус файла меняется на 'available'. | User, File в статусе 'uploading' (owner_id=user); payload: file_id | POST /api/v1/files/complete-upload (actingAs user) | assertOk, assertJson(['result' => 'success']) |
| 5 | `test_complete_upload_not_owner_fails` | Проверяет, что завершить загрузку чужого файла нельзя — возвращается 403. | owner (User), other (User), File uploading (owner_id=owner); payload: file_id | POST /api/v1/files/complete-upload (actingAs other) | assertStatus(403) |
| 6 | `test_cancel_upload` | Проверяет отмену загрузки файла. | User, File uploading (owner_id=user) | POST /api/v1/files/{id}/cancel-upload (actingAs user) | assertOk |

#### `FileVersionTest`
*Класс: `FileVersionTest` | Тестов: 17*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_init_upload_requires_owned_file` | Проверяет, что инициализация загрузки новой версии для чужого файла возвращает 404. | User, other (User), File (owner_id=other); payload: original_name, size, mime_type | POST /api/v1/files/{id}/versions/init-upload (actingAs user) | assertStatus(404) |
| 2 | `test_init_upload_fails_for_url_file` | Проверяет, что нельзя загрузить версию для URL-файла (content_kind=url_file) — возвращается NOT_SUPPORTED. | User, File urlFile (owner_id=user); payload: original_name, size, mime_type | POST /api/v1/files/{id}/versions/init-upload (actingAs user) | assertStatus(422), assertJsonPath('data.code', 'NOT_SUPPORTED') |
| 3 | `test_init_upload_requires_validation` | Проверяет, что валидация обязательных полей работает — пустой payload возвращает 422. | User, File (owner_id=user); payload: [] | POST /api/v1/files/{id}/versions/init-upload (actingAs user) | assertStatus(422) |
| 4 | `test_update_version_basic_fields` | Проверяет обновление метаданных версии: version_label и comment. После обновления значения проверяются в БД. | User, File (owner_id=user), FileVersion (version_number=1); payload: version_label='Final draft', comment='With corrections' | PATCH /api/v1/files/{id}/versions/{version->id} (actingAs user) | assertOk, assertJsonPath('result', 'success'), assertEquals version_label и comment |
| 5 | `test_update_version_not_found` | Проверяет, что обновление несуществующей версии возвращает 404. | User, File (owner_id=user); payload: version_label='test'; несуществующий version_id | PATCH /api/v1/files/{id}/versions/nonexistent (actingAs user) | assertStatus(404) |
| 6 | `test_complete_upload_requires_valid_version` | Проверяет, что завершение загрузки с несуществующим version_id возвращает 404. | User, File (owner_id=user); payload: version_id='nonexistent' | POST /api/v1/files/{id}/versions/complete-upload (actingAs user) | assertStatus(404) |
| 7 | `test_complete_upload_fails_for_other_users_file` | Проверяет, что завершение загрузки версии для чужого файла возвращает 404. | User, other (User), File (owner_id=other); payload: version_id='test' | POST /api/v1/files/{id}/versions/complete-upload (actingAs user) | assertStatus(404) |
| 8 | `test_update_display_name_requires_versions` | Проверяет, что обновление display_name для файла без версий (has_versions=false) возвращает NO_VERSIONS. | User, File (owner_id=user, has_versions=false); payload: display_name='My Custom Name' | PATCH /api/v1/files/{id}/display-name (actingAs user) | assertStatus(422), assertJsonPath('data.code', 'NO_VERSIONS') |
| 9 | `test_update_display_name_works` | Проверяет успешное обновление display_name для файла с версиями (has_versions=true). | User, File (owner_id=user, has_versions=true); payload: display_name='My Custom Name' | PATCH /api/v1/files/{id}/display-name (actingAs user) | assertOk, assertJsonPath('data.display_name', 'My Custom Name') |
| 10 | `test_update_display_name_other_users_file_returns_404` | Проверяет, что нельзя изменить display_name чужого файла — возвращается 404. | User, other (User), File (owner_id=other); payload: display_name='Hacked' | PATCH /api/v1/files/{id}/display-name (actingAs user) | assertStatus(404) |
| 11 | `test_unauthenticated_user_cannot_access_versions` | Проверяет, что неаутентифицированный пользователь не может инициировать загрузку версии. | Без аутентификации; payload: [] | POST /api/v1/files/test/versions/init-upload | assertUnauthorized |
| 12 | `test_owner_can_download_version` | Проверяет, что владелец может скачать конкретную версию файла. Используется fake S3. | User, File (owner_id=user), FileVersion available; Storage::fake('s3') | POST /api/v1/files/{id}/versions/{version->id}/download (actingAs user) | assertOk, assertJsonPath('result', 'success'), assertJsonStructure с url и expires_in |
| 13 | `test_user_with_access_can_download_version` | Проверяет, что пользователь с доступом к файлу может скачать версию. | owner (User), editor (User), File (owner_id=owner), FileUserAccess (user_id=editor), FileVersion available | POST /api/v1/files/{id}/versions/{version->id}/download (actingAs editor) | assertOk, assertJsonPath('result', 'success') |
| 14 | `test_user_without_access_cannot_download_version` | Проверяет, что пользователь без доступа не может скачать версию — возвращается 404. | owner (User), other (User), File (owner_id=owner), FileVersion available | POST /api/v1/files/{id}/versions/{version->id}/download (actingAs other) | assertStatus(404) |
| 15 | `test_download_nonexistent_version_returns_404` | Проверяет, что запрос на скачивание несуществующей версии возвращает 404. | User, File (owner_id=user); несуществующий version_id 'nonexistent' | POST /api/v1/files/{id}/versions/nonexistent/download (actingAs user) | assertStatus(404) |
| 16 | `test_download_version_unauthenticated_returns_401` | Проверяет, что неаутентифицированный пользователь не может скачать версию. | Без аутентификации | POST /api/v1/files/test/versions/test/download | assertUnauthorized |
| 17 | `test_download_uploading_version_returns_404` | Проверяет, что нельзя скачать версию в статусе 'uploading' — возвращается 404. | User, File (owner_id=user), FileVersion со статусом 'uploading', is_active=false | POST /api/v1/files/{id}/versions/{version->id}/download (actingAs user) | assertStatus(404) |

### `Feature/Invitations`
*Всего тестов: 12*

#### `InvitationTest`
*Класс: `InvitationTest` | Тестов: 12*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_user_can_send_invitation` | Проверяет, что аутентифицированный пользователь может отправить приглашение по email. Возвращается 201 и структура с id, target_email, status. | User; payload: email='invitee@example.com' | POST /api/v1/invitations (actingAs user) | assertStatus(201), assertJsonPath('result', 'success'), assertJsonStructure с id, target_email, status |
| 2 | `test_send_invitation_requires_email` | Проверяет, что при отправке приглашения без email возвращается ошибка валидации 422. | User; payload: [] | POST /api/v1/invitations (actingAs user) | assertStatus(422) |
| 3 | `test_user_can_show_invitation_by_token` | Проверяет, что любой аутентифицированный пользователь может просмотреть приглашение по токену. Возвращается информация о приглашении, отправителе и целевой почте. | sender (User), Invitation (через фабрику), другой User для аутентификации | GET /api/v1/invitations/{token} (actingAs другой User) | assertOk, assertJsonPath('result', 'success'), assertJsonPath('data.target_email', ...), assertJsonStructure |
| 4 | `test_show_invitation_with_invalid_token_returns_404` | Проверяет, что запрос приглашения с невалидным токеном возвращает 404 с результатом 'error'. | User; невалидный токен 'invalid-token-12345' | GET /api/v1/invitations/invalid-token-12345 (actingAs user) | assertStatus(404), assertJsonPath('result', 'error') |
| 5 | `test_user_can_accept_invitation` | Проверяет, что пользователь может принять приглашение, если его email совпадает с target_email. | sender (User), recipient (User), Invitation (target_email=recipient->email) | POST /api/v1/invitations/{token}/accept (actingAs recipient) | assertOk, assertJsonPath('result', 'success') |
| 6 | `test_accept_expired_invitation_fails` | Проверяет, что принятие просроченного приглашения (expires_at в прошлом) возвращает ошибку EXPIRED. | sender (User), recipient (User), Invitation (expires_at=now()->subDay()) | POST /api/v1/invitations/{token}/accept (actingAs recipient) | assertStatus(422), assertJsonPath('data.code', 'EXPIRED') |
| 7 | `test_accept_already_accepted_invitation_fails` | Проверяет, что повторное принятие уже принятого приглашения возвращает ошибку NOT_PENDING. | sender (User), recipient (User), Invitation в статусе accepted (через фабрику accepted); другой User для аутентификации | POST /api/v1/invitations/{token}/accept (actingAs другой User) | assertStatus(422), assertJsonPath('data.code', 'NOT_PENDING') |
| 8 | `test_user_can_reject_invitation` | Проверяет, что пользователь может отклонить приглашение. | sender (User), Invitation; другой User для аутентификации | POST /api/v1/invitations/{token}/reject (actingAs другой User) | assertOk, assertJsonPath('result', 'success') |
| 9 | `test_reject_with_invalid_token_returns_404` | Проверяет, что отклонение приглашения с невалидным токеном возвращает 404. | User; невалидный токен 'invalid-token' | POST /api/v1/invitations/invalid-token/reject (actingAs user) | assertStatus(404) |
| 10 | `test_sender_can_cancel_own_invitation` | Проверяет, что отправитель может отменить своё приглашение — статус меняется на 'cancelled'. | sender (User), Invitation (sender_user_id=sender) | POST /api/v1/invitations/{id}/cancel (actingAs sender) | assertOk, assertJsonPath('result', 'success'), assertDatabaseHas status='cancelled' |
| 11 | `test_other_user_cannot_cancel_invitation` | Проверяет, что другой пользователь не может отменить чужое приглашение — возвращается 403. | sender (User), other (User), Invitation (sender_user_id=sender) | POST /api/v1/invitations/{id}/cancel (actingAs other) | assertStatus(403) |
| 12 | `test_unauthenticated_user_cannot_access_invitations` | Проверяет, что неаутентифицированный пользователь не может отправить приглашение. | Без аутентификации; payload: email | POST /api/v1/invitations | assertUnauthorized |

### `Feature/Links`
*Всего тестов: 8*

#### `UrlFileTest`
*Класс: `UrlFileTest` | Тестов: 8*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_preview_returns_metadata` | Проверяет, что эндпоинт превью ссылки возвращает метаданные (title, description, hostname) из HTML-страницы. HTTP-запрос к example.com замокан. | User, Http::fake example.com с HTML <title>Test Page</title>; payload: url='https://example.com' | POST /api/v1/links-preview (actingAs user) | assertOk, assertJsonPath('result', 'success'), assertJsonStructure с preview (title, description, hostname) |
| 2 | `test_preview_requires_valid_url` | Проверяет, что передача невалидного URL в превью возвращает 422. | User; payload: url='not-a-url' | POST /api/v1/links-preview (actingAs user) | assertStatus(422) |
| 3 | `test_preview_returns_minimal_on_fetch_failure` | Проверяет, что при ошибке загрузки страницы (500) возвращается минимальный превью с hostname в качестве заголовка. | User, Http::fake example.com возвращает 500; payload: url='https://example.com' | POST /api/v1/links-preview (actingAs user) | assertOk, assertJsonPath('data.preview.title', 'example.com') |
| 4 | `test_user_can_create_url_file` | Проверяет создание URL-файла по ссылке. Возвращается 201 и структура файла. | User, Http::fake example.com с HTML; payload: url='https://example.com' | POST /api/v1/url-files (actingAs user) | assertStatus(201), assertJsonPath('result', 'success'), assertJsonStructure с file (id, original_name) |
| 5 | `test_create_url_file_requires_valid_url` | Проверяет, что передача невалидного URL при создании URL-файла возвращает 422. | User; payload: url='invalid' | POST /api/v1/url-files (actingAs user) | assertStatus(422) |
| 6 | `test_created_url_file_has_correct_type` | Проверяет, что созданный URL-файл имеет content_kind='url_file' и правильный link_url. | User, Http::fake example.com с HTML; payload: url='https://example.com' | POST /api/v1/url-files (actingAs user), затем File::find | assertStatus(201), assertEquals('url_file', file->content_kind), assertEquals('https://example.com', file->link_url) |
| 7 | `test_create_url_file_without_auth_returns_401` | Проверяет, что неаутентифицированный пользователь не может создать URL-файл. | Без аутентификации; payload: url | POST /api/v1/url-files | assertUnauthorized |
| 8 | `test_preview_without_auth_returns_401` | Проверяет, что неаутентифицированный пользователь не может получить превью ссылки. | Без аутентификации; payload: url | POST /api/v1/links-preview | assertUnauthorized |

### `Feature/Organization`
*Всего тестов: 22*

#### `FolderTest`
*Класс: `FolderTest` | Тестов: 12*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_user_can_list_folders` | Проверяет, что пользователь может получить список своих папок. Ответ содержит структуру с items, включая id, name, parent_id. | User, 2 Folder (user_id=user) | GET /api/v1/folders (actingAs user) | assertOk, assertJsonPath('result', 'success'), assertJsonStructure с items |
| 2 | `test_user_can_get_folder_tree` | Проверяет, что пользователь может получить дерево папок через эндпоинт /tree. | User, Folder 'Root' | GET /api/v1/folders/tree (actingAs user) | assertOk, assertJsonPath('result', 'success') |
| 3 | `test_user_can_create_folder` | Проверяет создание новой папки. Возвращается 201 и имя созданной папки. | User; payload: name='My Folder' | POST /api/v1/folders (actingAs user) | assertStatus(201), assertJsonPath('result', 'success'), assertJsonPath('data.folder.name', 'My Folder'), assertDatabaseHas |
| 4 | `test_user_can_create_subfolder` | Проверяет создание подпапки с указанием parent_id. | User, Folder parent; payload: name='Subfolder', parent_id=parent->id | POST /api/v1/folders (actingAs user) | assertStatus(201), assertDatabaseHas с parent_id |
| 5 | `test_creating_folder_with_invalid_parent_fails` | Проверяет, что создание папки с несуществующим parent_id возвращает 404. | User; payload: name='Orphan', parent_id='nonexistent' | POST /api/v1/folders (actingAs user) | assertStatus(404) |
| 6 | `test_user_can_update_folder` | Проверяет обновление названия папки. | User, Folder 'Old Name'; payload: name='New Name' | PATCH /api/v1/folders/{id} (actingAs user) | assertOk, assertJsonPath('data.folder.name', 'New Name') |
| 7 | `test_updating_other_users_folder_returns_404` | Проверяет, что нельзя обновить папку другого пользователя — возвращается 404. | User, other (User), Folder (user_id=other); payload: name='Hacked' | PATCH /api/v1/folders/{id} (actingAs user) | assertStatus(404) |
| 8 | `test_user_can_delete_empty_folder` | Проверяет, что пустую папку можно удалить — запись исчезает из БД. | User, Folder (user_id=user, без файлов и подпапок) | DELETE /api/v1/folders/{id} (actingAs user) | assertOk, assertDatabaseMissing |
| 9 | `test_user_can_force_delete_folder_with_files` | Проверяет принудительное удаление папки с файлами через параметр force=1. | User, Folder, File (owner_id=user), FileUserAccess с folder_id; query force=1 | DELETE /api/v1/folders/{id}?force=1 (actingAs user) | assertOk, assertDatabaseMissing folders |
| 10 | `test_deleting_folder_with_children_fails` | Проверяет, что удаление папки, у которой есть дочерние подпапки, возвращает ошибку HAS_CHILDREN. | User, Folder parent, Folder childOf(parent) | DELETE /api/v1/folders/{parent->id} (actingAs user) | assertStatus(422), assertJsonPath('data.code', 'HAS_CHILDREN') |
| 11 | `test_folder_cycle_detection_on_update` | Проверяет обнаружение цикла при обновлении parent_id — попытка сделать родителя потомком себя возвращает CYCLE_DETECTED. | User, Folder parent, Folder childOf(parent); payload: parent_id=child->id (для parent) | PATCH /api/v1/folders/{parent->id} (actingAs user) | assertStatus(422), assertJsonPath('data.code', 'CYCLE_DETECTED') |
| 12 | `test_unauthenticated_user_cannot_access_folders` | Проверяет, что неаутентифицированный пользователь не может получить список папок. | Без аутентификации | GET /api/v1/folders | assertUnauthorized |

#### `TagTest`
*Класс: `TagTest` | Тестов: 10*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_user_can_list_tags` | Проверяет, что пользователь может получить список своих тегов. Ответ содержит структуру с items, включая id, name, files_count. | User, 3 Tag (user_id=user) | GET /api/v1/tags (actingAs user) | assertOk, assertJsonPath('result', 'success'), assertJsonStructure с items |
| 2 | `test_user_can_search_tags` | Проверяет поиск тегов по имени — возвращается только один совпадающий тег. | User, Tag 'urgent' и 'other'; query search=urg | GET /api/v1/tags?search=urg (actingAs user) | assertOk, assertCount(1) |
| 3 | `test_user_can_create_tag` | Проверяет создание нового тега. Возвращается 201 и имя созданного тега. | User; payload: name='important' | POST /api/v1/tags (actingAs user) | assertStatus(201), assertJsonPath('result', 'success'), assertJsonPath('data.tag.name', 'important'), assertDatabaseHas |
| 4 | `test_creating_duplicate_tag_fails` | Проверяет, что создание дублирующегося тега (такое же имя у того же пользователя) возвращает ошибку TAG_EXISTS. | User, Tag 'duplicate'; payload: name='duplicate' | POST /api/v1/tags (actingAs user) | assertStatus(422), assertJsonPath('data.code', 'TAG_EXISTS') |
| 5 | `test_user_can_update_tag` | Проверяет обновление имени тега. | User, Tag 'old'; payload: name='new' | PATCH /api/v1/tags/{id} (actingAs user) | assertOk, assertJsonPath('data.tag.name', 'new') |
| 6 | `test_updating_other_users_tag_returns_404` | Проверяет, что нельзя обновить тег другого пользователя — возвращается 404. | User, other (User), Tag (user_id=other); payload: name='hacked' | PATCH /api/v1/tags/{id} (actingAs user) | assertStatus(404) |
| 7 | `test_user_can_delete_tag` | Проверяет удаление тега — запись исчезает из БД. | User, Tag (user_id=user) | DELETE /api/v1/tags/{id} (actingAs user) | assertOk, assertDatabaseMissing |
| 8 | `test_user_can_attach_tags_to_file` | Проверяет прикрепление тега к файлу — создаётся запись в file_tags. | User, File (owner_id=user), FileUserAccess owner, Tag; payload: tag_ids=[tag->id] | POST /api/v1/files/{id}/attach-tags (actingAs user) | assertOk, assertDatabaseHas file_tags |
| 9 | `test_user_can_detach_tags_from_file` | Проверяет открепление тега от файла: сначала прикрепляет, затем открепляет — запись в file_tags удаляется. | User, File, FileUserAccess owner, Tag; сначала attach, затем payload: tag_ids=[tag->id] | POST /api/v1/files/{id}/detach-tags (actingAs user) | assertOk, assertDatabaseMissing file_tags |
| 10 | `test_unauthenticated_user_cannot_access_tags` | Проверяет, что неаутентифицированный пользователь не может получить список тегов. | Без аутентификации | GET /api/v1/tags | assertUnauthorized |

### `Feature/Push`
*Всего тестов: 8*

#### `PushTest`
*Класс: `PushTest` | Тестов: 8*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_vapid_key_is_returned_publicly` | Проверяет, что публичный VAPID-ключ доступен без аутентификации. | Без аутентификации | GET /api/v1/push/vapid-key | assertOk, assertJsonPath('result', 'success'), assertJsonStructure с public_key |
| 2 | `test_authenticated_user_can_subscribe` | Проверяет, что аутентифицированный пользователь может подписаться на push-уведомления. Создаётся запись в push_subscriptions. | User; payload: endpoint, p256dh, auth | POST /api/v1/push/subscribe (actingAs user) | assertOk, assertJsonPath('result', 'success'), assertDatabaseHas push_subscriptions |
| 3 | `test_subscribe_requires_all_fields` | Проверяет, что подписка без обязательных полей возвращает 422. | User; payload: [] | POST /api/v1/push/subscribe (actingAs user) | assertStatus(422) |
| 4 | `test_subscribe_updates_existing_subscription` | Проверяет, что при повторной подписке с тем же endpoint обновляются ключи p256dh и auth. | User, PushSubscription (со старыми ключами); payload: endpoint (тот же), p256dh='new_key', auth='new_auth' | POST /api/v1/push/subscribe (actingAs user) | assertOk, assertDatabaseHas с новыми p256dh и auth |
| 5 | `test_authenticated_user_can_unsubscribe` | Проверяет, что пользователь может отписаться от push-уведомлений — запись удаляется из БД. | User, PushSubscription; payload: endpoint | DELETE /api/v1/push/unsubscribe (actingAs user) с endpoint | assertOk, assertJsonPath('result', 'success'), assertDatabaseMissing |
| 6 | `test_unsubscribe_requires_endpoint` | Проверяет, что отписка без endpoint возвращает 422. | User; payload: [] | DELETE /api/v1/push/unsubscribe (actingAs user) | assertStatus(422) |
| 7 | `test_unauthenticated_cannot_subscribe` | Проверяет, что неаутентифицированный пользователь не может подписаться на push. | Без аутентификации; payload: endpoint, p256dh, auth | POST /api/v1/push/subscribe | assertUnauthorized |
| 8 | `test_unauthenticated_cannot_unsubscribe` | Проверяет, что неаутентифицированный пользователь не может отписаться от push. | Без аутентификации; payload: endpoint | DELETE /api/v1/push/unsubscribe | assertUnauthorized |

### `Feature/SharedFolders`
*Всего тестов: 58*

#### `SharedFolderFileTest`
*Класс: `SharedFolderFileTest` | Тестов: 16*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_user_can_add_shared_folder_only_file_to_my_files` | Проверяет, что пользователь может добавить файл, принадлежащий только общей папке (shared_folder_only=true), в свои файлы — флаг сбрасывается на false. | User, File (owner_id=user, shared_folder_only=true) | POST /api/v1/files/{id}/add-to-my-files (actingAs user) | assertOk, assertDatabaseHas shared_folder_only=false |
| 2 | `test_add_to_my_files_fails_if_not_shared_folder_only` | Проверяет, что добавление в "мои файлы" для обычного файла возвращает ALREADY_IN_MY_FILES. | User, File (owner_id=user, shared_folder_only=false) | POST /api/v1/files/{id}/add-to-my-files (actingAs user) | assertStatus(422), assertJsonPath('data.code', 'ALREADY_IN_MY_FILES') |
| 3 | `test_add_to_my_files_fails_for_other_users_file` | Проверяет, что нельзя добавить чужой файл в свои файлы — 403. | owner (User), other (User), File (owner_id=owner, shared_folder_only=true) | POST /api/v1/files/{id}/add-to-my-files (actingAs other) | assertStatus(403) |
| 4 | `test_user_can_sync_file_shared_folders` | Проверяет синхронизацию общих папок файла — можно установить набор folder_ids и создаются записи в shared_folder_files. | User, File, SharedFolder; payload: folder_ids=[folder->id] | POST /api/v1/files/{id}/shared-folders (actingAs user) | assertOk, assertJsonPath('data.folder_ids', [folder->id]), assertDatabaseHas shared_folder_files |
| 5 | `test_update_shared_folders_fails_for_shared_folder_only_file` | Проверяет, что для файла с shared_folder_only=true нельзя менять набор общих папок — 403. | User, File (shared_folder_only=true); payload: folder_ids=[] | POST /api/v1/files/{id}/shared-folders (actingAs user) | assertStatus(403) |
| 6 | `test_update_shared_folders_requires_folder_ids` | Проверяет, что синхронизация без folder_ids возвращает 422. | User, File; payload: [] | POST /api/v1/files/{id}/shared-folders (actingAs user) | assertStatus(422) |
| 7 | `test_update_shared_folders_only_affects_editable_folders` | Проверяет, что при синхронизации затрагиваются только те папки, куда пользователь имеет права редактирования. Чужие папки игнорируются. | owner (User), editor (User), File (owner_id=owner), FileUserAccess для editor, SharedFolder editable (принадлежит editor), SharedFolder other (принадлежит owner); payload: оба folder_ids | POST /api/v1/files/{id}/shared-folders (actingAs editor) | assertOk, assertDatabaseHas для editable, assertDatabaseMissing для other |
| 8 | `test_user_can_get_shared_folders_for_file` | Проверяет, что пользователь может получить список общих папок для файла. Возвращается массив folder_ids и объект folders. | User, File, SharedFolder, SharedFolderFile | GET /api/v1/files/{id}/shared-folders (actingAs user) | assertOk, assertJsonStructure с folder_ids и folders, assertContains folder->id |
| 9 | `test_get_shared_folders_fails_without_access` | Проверяет, что без доступа к файлу нельзя получить список его общих папок — 403. | owner (User), other (User), File (owner_id=owner) | GET /api/v1/files/{id}/shared-folders (actingAs other) | assertStatus(403) |
| 10 | `test_user_with_edit_access_can_add_file_to_folder` | Проверяет, что пользователь с правами редактирования может добавить свой файл в общую папку. | owner (User), editor (User), SharedFolder, SharedFolderAccess edit, File (owner_id=editor) | POST /api/v1/shared-folders/{id}/files/{file->id} (actingAs editor) | assertOk, assertDatabaseHas shared_folder_files |
| 11 | `test_add_file_fails_without_edit_access` | Проверяет, что пользователь с правами только на просмотр не может добавить файл в общую папку — 403. | owner (User), viewer (User), SharedFolder, SharedFolderAccess view, File (owner_id=viewer) | POST /api/v1/shared-folders/{id}/files/{file->id} (actingAs viewer) | assertStatus(403) |
| 12 | `test_add_file_to_nonexistent_folder_returns_404` | Проверяет, что добавление файла в несуществующую папку возвращает 404. | User, File; несуществующий folder_id 'nonexistent' | POST /api/v1/shared-folders/nonexistent/files/{file->id} (actingAs user) | assertStatus(404) |
| 13 | `test_user_with_edit_access_can_remove_file_from_folder` | Проверяет, что пользователь с правами редактирования может удалить свой файл из общей папки. | owner (User), editor (User), SharedFolder, SharedFolderAccess edit, File, SharedFolderFile | DELETE /api/v1/shared-folders/{id}/files/{file->id} (actingAs editor) | assertOk, assertDatabaseMissing shared_folder_files |
| 14 | `test_file_owner_can_remove_file_from_folder` | Проверяет, что владелец файла может удалить его из общей папки. | owner (User), SharedFolder, File (owner_id=owner), SharedFolderFile | DELETE /api/v1/shared-folders/{id}/files/{file->id} (actingAs owner) | assertOk |
| 15 | `test_remove_file_fails_without_permission` | Проверяет, что пользователь с правами просмотра не может удалить файл из общей папки — 403. | owner (User), viewer (User), SharedFolder, SharedFolderAccess view, File, SharedFolderFile | DELETE /api/v1/shared-folders/{id}/files/{file->id} (actingAs viewer) | assertStatus(403) |
| 16 | `test_unauthenticated_cannot_access_shared_folder_files` | Проверяет, что неаутентифицированный пользователь не может получить общие папки файла. | Без аутентификации | GET /api/v1/files/some-id/shared-folders | assertUnauthorized |

#### `SharedFolderTest`
*Класс: `SharedFolderTest` | Тестов: 42*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_user_can_list_shared_folders` | Проверяет, что пользователь может получить список своих общих папок. | User, SharedFolder (owner_id=user) | GET /api/v1/shared-folders (actingAs user) | assertOk, assertJsonPath('result', 'success'), assertJsonStructure с items |
| 2 | `test_user_can_create_shared_folder` | Проверяет создание общей папки. Возвращается 201, имя папки и флаг is_owner=true. | User; payload: name='Team Space' | POST /api/v1/shared-folders (actingAs user) | assertStatus(201), assertJsonPath('result', 'success'), assertJsonPath('data.folder.name', 'Team Space'), assertJsonPath('data.folder.is_owner', true), assertDatabaseHas |
| 3 | `test_owner_can_update_shared_folder` | Проверяет, что владелец может переименовать общую папку. | User, SharedFolder; payload: name='Renamed' | PATCH /api/v1/shared-folders/{id} (actingAs user) | assertOk, assertJsonPath('data.folder.name', 'Renamed') |
| 4 | `test_non_owner_cannot_update_shared_folder` | Проверяет, что не-владелец не может изменить общую папку — возвращается 403. | owner (User), other (User), SharedFolder; payload: name='Hacked' | PATCH /api/v1/shared-folders/{id} (actingAs other) | assertStatus(403) |
| 5 | `test_owner_can_delete_shared_folder` | Проверяет, что владелец может удалить общую папку — запись исчезает из БД. | User, SharedFolder | DELETE /api/v1/shared-folders/{id} (actingAs user) | assertOk, assertDatabaseMissing |
| 6 | `test_non_owner_cannot_delete_shared_folder` | Проверяет, что не-владелец не может удалить общую папку — возвращается 403. | owner (User), other (User), SharedFolder | DELETE /api/v1/shared-folders/{id} (actingAs other) | assertStatus(403) |
| 7 | `test_owner_can_create_subfolder` | Проверяет, что владелец может создать подпапку внутри общей папки. | User, SharedFolder parent; payload: name='Child' | POST /api/v1/shared-folders/{id}/subfolders (actingAs user) | assertStatus(201), assertJsonPath('data.folder.name', 'Child') |
| 8 | `test_user_with_edit_access_can_create_subfolder` | Проверяет, что пользователь с правами редактирования может создать подпапку. | owner (User), editor (User), SharedFolder, SharedFolderAccess edit | POST /api/v1/shared-folders/{id}/subfolders (actingAs editor) с name='Child' | assertStatus(201) |
| 9 | `test_user_with_view_access_cannot_create_subfolder` | Проверяет, что пользователь с правами только на просмотр не может создать подпапку — 403. | owner (User), viewer (User), SharedFolder, SharedFolderAccess view | POST /api/v1/shared-folders/{id}/subfolders (actingAs viewer) с name='Child' | assertStatus(403) |
| 10 | `test_owner_can_list_accesses` | Проверяет, что владелец может получить список доступов к общей папке. | User, SharedFolder | GET /api/v1/shared-folders/{id}/accesses (actingAs user) | assertOk, assertJsonPath('result', 'success') |
| 11 | `test_non_owner_cannot_list_accesses` | Проверяет, что не-владелец не может просмотреть доступы к папке — 403. | owner (User), other (User), SharedFolder | GET /api/v1/shared-folders/{id}/accesses (actingAs other) | assertStatus(403) |
| 12 | `test_owner_can_add_access_via_resolved_contact` | Проверяет, что владелец может добавить доступ к папке для контакта (разрешённого пользователя). Возвращается 201. | owner (User), recipient (User), SharedFolder, Contact resolvedTo recipient; payload: contact_id, access_type='view' | POST /api/v1/shared-folders/{id}/accesses (actingAs owner) | assertStatus(201), assertJsonPath('result', 'success') |
| 13 | `test_owner_can_remove_access` | Проверяет, что владелец может удалить доступ к папке — запись удаляется из БД. | owner (User), recipient (User), SharedFolder, Contact resolvedTo, SharedFolderAccess | DELETE /api/v1/shared-folders/{id}/accesses/{access->id} (actingAs owner) | assertOk, assertDatabaseMissing |
| 14 | `test_adding_duplicate_access_fails` | Проверяет, что при добавлении дублирующегося доступа возвращается ошибка DUPLICATE_ACCESS. | owner (User), recipient (User), SharedFolder, Contact resolvedTo, существующий SharedFolderAccess; payload: contact_id, access_type | POST /api/v1/shared-folders/{id}/accesses (actingAs owner) | assertStatus(422), assertJsonPath('data.code', 'DUPLICATE_ACCESS') |
| 15 | `test_owner_can_list_links` | Проверяет, что владелец может получить список ссылок на общую папку. | User, SharedFolder | GET /api/v1/shared-folders/{id}/links (actingAs user) | assertOk, assertJsonPath('result', 'success') |
| 16 | `test_owner_can_create_link` | Проверяет, что владелец может создать публичную ссылку на общую папку с параметрами access_type, ttl_hours, allow_save. | User, SharedFolder; payload: access_type='view', ttl_hours=24, allow_save=false | POST /api/v1/shared-folders/{id}/links (actingAs user) | assertStatus(201), assertJsonPath('result', 'success'), assertJsonStructure с id, url, status, access_type, expires_at |
| 17 | `test_owner_can_disable_link` | Проверяет, что владелец может деактивировать ссылку — статус меняется на 'disabled'. | User, SharedFolder, SharedFolderLink active; payload: access_type, ttl_hours, allow_save | POST /api/v1/shared-folders/{id}/links/{link->id}/disable (actingAs user) | assertOk, assertDatabaseHas status='disabled' |
| 18 | `test_non_owner_cannot_create_link` | Проверяет, что не-владелец не может создать ссылку на общую папку — 403. | owner (User), other (User), SharedFolder; payload: access_type, ttl_hours, allow_save | POST /api/v1/shared-folders/{id}/links (actingAs other) | assertStatus(403) |
| 19 | `test_member_can_leave_shared_folder` | Проверяет, что участник может покинуть общую папку. | owner (User), member (User), SharedFolder, SharedFolderAccess | DELETE /api/v1/shared-folders/{id}/leave (actingAs member) | assertOk |
| 20 | `test_owner_cannot_leave_their_own_folder` | Проверяет, что владелец не может покинуть собственную папку — возвращается OWNER_CANNOT_LEAVE. | User, SharedFolder | DELETE /api/v1/shared-folders/{id}/leave (actingAs user) | assertStatus(422), assertJsonPath('data.code', 'OWNER_CANNOT_LEAVE') |
| 21 | `test_public_can_resolve_valid_shared_link` | Проверяет, что публичный пользователь (без аутентификации) может открыть валидную ссылку на общую папку. | User, SharedFolder, SharedFolderLink active | POST /api/v1/shared-links/{token}/resolve | assertOk, assertJsonPath('result', 'success'), assertJsonPath('data.folder.name', ...) |
| 22 | `test_resolving_expired_shared_link_fails` | Проверяет, что просроченная ссылка возвращает ошибку LINK_INVALID (410). | User, SharedFolder, SharedFolderLink с expires_at в прошлом | POST /api/v1/shared-links/{token}/resolve | assertStatus(410), assertJsonPath('data.code', 'LINK_INVALID') |
| 23 | `test_user_can_get_all_flat_shared_folders` | Проверяет, что пользователь может получить плоский список всех общих папок через эндпоинт /all-flat. | User, 2 SharedFolder (owner_id=user) | GET /api/v1/shared-folders/all-flat (actingAs user) | assertOk, assertJsonPath('result', 'success') |
| 24 | `test_unauthenticated_user_cannot_access_shared_folders` | Проверяет, что неаутентифицированный пользователь не может получить список общих папок. | Без аутентификации | GET /api/v1/shared-folders | assertUnauthorized |
| 25 | `test_owner_can_list_files_in_shared_folder` | Проверяет, что владелец может получить список файлов в общей папке с пагинацией. | User, SharedFolder, File, SharedFolderFile | GET /api/v1/shared-folders/{id}/files (actingAs user) | assertOk, assertJsonPath('result', 'success'), assertJsonStructure с items, pagination |
| 26 | `test_non_member_cannot_list_files_in_shared_folder` | Проверяет, что не-участник не может просмотреть файлы в общей папке — 403. | owner (User), other (User), SharedFolder | GET /api/v1/shared-folders/{id}/files (actingAs other) | assertStatus(403) |
| 27 | `test_viewer_cannot_init_upload_to_folder` | Проверяет, что пользователь с правами только на просмотр не может инициировать загрузку в общую папку — 403. | owner (User), viewer (User), SharedFolder, SharedFolderAccess view; payload: original_name, size, mime_type | POST /api/v1/shared-folders/{id}/init-upload (actingAs viewer) | assertStatus(403) |
| 28 | `test_user_with_edit_access_can_add_url_file_to_folder` | Проверяет, что пользователь с правами редактирования может добавить URL-файл в общую папку. Создаётся запись в shared_folder_files. | owner (User), editor (User), SharedFolder, SharedFolderAccess edit; payload: url | POST /api/v1/shared-folders/{id}/url-file (actingAs editor) | assertStatus(201), assertJsonStructure с file, assertDatabaseHas shared_folder_files |
| 29 | `test_add_url_file_requires_valid_url` | Проверяет, что добавление URL-файла с невалидным URL возвращает 422. | owner (User), editor (User), SharedFolder, SharedFolderAccess edit; payload: url='not-a-url' | POST /api/v1/shared-folders/{id}/url-file (actingAs editor) | assertStatus(422) |
| 30 | `test_user_can_list_subfolders` | Проверяет, что пользователь может получить список подпапок в общей папке. | User, SharedFolder parent, SharedFolder child (parent_id=parent->id) | GET /api/v1/shared-folders/{id}/subfolders (actingAs user) | assertOk, assertJsonPath('result', 'success'), assertJsonStructure с items |
| 31 | `test_non_member_cannot_list_subfolders` | Проверяет, что не-участник не может просмотреть подпапки — 403. | owner (User), other (User), SharedFolder | GET /api/v1/shared-folders/{id}/subfolders (actingAs other) | assertStatus(403) |
| 32 | `test_public_can_list_files_via_shared_link` | Проверяет, что публичный пользователь может получить список файлов через валидную shared link. | User, SharedFolder, SharedFolderLink active, File, SharedFolderFile | GET /api/v1/shared-links/{token}/files | assertOk, assertJsonPath('result', 'success'), assertJsonStructure с items, pagination |
| 33 | `test_public_files_via_expired_link_returns_410` | Проверяет, что просроченная shared link возвращает 410 при попытке получить файлы. | User, SharedFolder, SharedFolderLink с expires_at в прошлом | GET /api/v1/shared-links/{token}/files | assertStatus(410), assertJsonPath('data.code', 'LINK_INVALID') |
| 34 | `test_owner_can_complete_upload_in_folder` | Проверяет, что владелец может завершить загрузку файла в общую папку — статус файла меняется на 'available'. | User, SharedFolder, File uploading (owner_id=user); payload: file_id | POST /api/v1/shared-folders/{id}/complete-upload (actingAs user) | assertOk, assertJsonPath('result', 'success'), assertJsonStructure с file, assertDatabaseHas status='available' |
| 35 | `test_editor_can_complete_upload_in_folder` | Проверяет, что пользователь с правами редактирования может завершить загрузку своего файла в общую папку. | owner (User), editor (User), SharedFolder, SharedFolderAccess edit, File uploading (owner_id=editor); payload: file_id | POST /api/v1/shared-folders/{id}/complete-upload (actingAs editor) | assertOk, assertJsonPath('result', 'success') |
| 36 | `test_viewer_cannot_complete_upload` | Проверяет, что пользователь с правами просмотра не может завершить загрузку — 403. | owner (User), viewer (User), SharedFolder, SharedFolderAccess view; payload: file_id='test' | POST /api/v1/shared-folders/{id}/complete-upload (actingAs viewer) | assertStatus(403) |
| 37 | `test_non_member_cannot_complete_upload` | Проверяет, что не-участник не может завершить загрузку в общую папку — 403. | owner (User), other (User), SharedFolder; payload: file_id='test' | POST /api/v1/shared-folders/{id}/complete-upload (actingAs other) | assertStatus(403) |
| 38 | `test_complete_upload_requires_file_id` | Проверяет, что завершение загрузки без file_id возвращает 422. | User, SharedFolder; payload: [] | POST /api/v1/shared-folders/{id}/complete-upload (actingAs user) | assertStatus(422) |
| 39 | `test_complete_upload_nonexistent_file_returns_404` | Проверяет, что завершение загрузки с несуществующим file_id возвращает 404. | User, SharedFolder; payload: file_id='nonexistent' | POST /api/v1/shared-folders/{id}/complete-upload (actingAs user) | assertStatus(404) |
| 40 | `test_complete_upload_nonexistent_folder_returns_404` | Проверяет, что завершение загрузки в несуществующую папку возвращает 404. | User, File; несуществующий folder_id | POST /api/v1/shared-folders/nonexistent/complete-upload (actingAs user) с file_id | assertStatus(404) |
| 41 | `test_complete_upload_other_users_file_returns_403` | Проверяет, что нельзя завершить загрузку чужого файла в свою папку — 403. | owner (User), other (User), SharedFolder, File (owner_id=other) | POST /api/v1/shared-folders/{id}/complete-upload (actingAs owner) с file_id | assertStatus(403) |
| 42 | `test_complete_upload_unauthenticated` | Проверяет, что неаутентифицированный пользователь не может завершить загрузку. | Без аутентификации; payload: file_id | POST /api/v1/shared-folders/test/complete-upload | assertUnauthorized |

### `Feature/Sharing`
*Всего тестов: 20*

#### `CreateLinkTest`
*Класс: `CreateLinkTest` | Тестов: 3*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_owner_can_create_share_link` | Проверяет, что владелец файла может создать публичную ссылку для скачивания с указанием TTL. | User, File (owner_id=user), FileUserAccess owner; payload: ttl_hours=24 | POST /api/v1/files/{id}/create-link (actingAs user) | assertStatus(201), assertJson(['result' => 'success']) |
| 2 | `test_owner_can_list_links` | Проверяет, что владелец может получить список всех ссылок на файл. | User, File, FileUserAccess owner, 2 ShareLink | GET /api/v1/files/{id}/links (actingAs user) | assertOk |
| 3 | `test_owner_can_disable_link` | Проверяет, что владелец может отключить (деактивировать) существующую ссылку на файл. | User, File, FileUserAccess owner, ShareLink | POST /api/v1/links/{link->id}/disable (actingAs user) | assertOk |

#### `PublicLinkTest`
*Класс: `Tests\Feature\Sharing\PublicLinkTest` | Тестов: 4*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_public_user_can_resolve_link` | Проверяет, что публичный пользователь может разрешить ссылку на файл | Владелец, файл, ShareLink | POST-запрос /api/v1/links/{token}/resolve | assertOk() (200), assertJson(['result' => 'success']) |
| 2 | `test_public_user_cannot_resolve_disabled_link` | Проверяет, что отключённая ссылка не разрешается | Владелец, файл, ShareLink с disabled | POST-запрос /api/v1/links/{token}/resolve | assertStatus(404), assertJsonPath('data.code', 'LINK_INVALID') |
| 3 | `test_public_user_cannot_resolve_expired_link` | Проверяет, что просроченная ссылка не разрешается | Владелец, файл, ShareLink с expired | POST-запрос /api/v1/links/{token}/resolve | assertStatus(404), assertJsonPath('data.code', 'LINK_INVALID') |
| 4 | `test_save_via_link_requires_authentication` | Проверяет, что сохранение через ссылку требует аутентификации | Владелец, файл, ShareLink с withSave | POST-запрос /api/v1/links/{token}/save | assertUnauthorized() (401) |

#### `ShareToContactTest`
*Класс: `ShareToContactTest` | Тестов: 3*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_owner_can_share_file_to_resolved_contact` | Проверяет, что владелец может расшарить файл разрешённому контакту. Создаётся FileUserAccess для получателя. | owner (User), recipient (User), File (owner_id=owner), Contact resolvedTo recipient, FileUserAccess owner | POST /api/v1/files/{id}/share-to-contact (actingAs owner) с contact_id | assertOk, assertJson(['result' => 'success']) |
| 2 | `test_owner_can_revoke_contact_access` | Проверяет, что владелец может отозвать доступ контакта к файлу — удаляется FileUserAccess. | owner (User), recipient (User), File, Contact resolvedTo, FileUserAccess owner, FileUserAccess (для recipient) | DELETE /api/v1/files/{id}/share-to-contact/{contact->id} (actingAs owner) | assertOk |
| 3 | `test_non_owner_cannot_share_file` | Проверяет, что не-владелец не может расшарить чужой файл — возвращается 404. | owner (User), other (User), recipient (User), File (owner_id=owner), Contact resolvedTo (принадлежит other) | POST /api/v1/files/{id}/share-to-contact (actingAs other) с contact_id | assertStatus(404) |

#### `SharingCoverageTest`
*Класс: `Tests\Feature\Sharing\SharingCoverageTest` | Тестов: 10*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_resolve_link_returns_file_info` | Проверяет, что при разрешении ссылки возвращается информация о файле и ссылке | Владелец, файл text/plain, ShareLink | POST-запрос /api/v1/links/{token}/resolve | assertOk() (200), assertJsonStructure(['data' => ['file' => ['id', 'original_name', 'size', 'mime_type'], 'link' => ['expires_at', 'allow_save']]]) |
| 2 | `test_resolve_link_with_invalid_token_returns_404` | Проверяет, что несуществующий токен возвращает 404 | Нет данных | POST-запрос /api/v1/links/invalid-token/resolve | assertStatus(404), assertJsonPath('data.code', 'LINK_INVALID') |
| 3 | `test_resolve_disabled_link_returns_404` | Проверяет, что отключённая ссылка возвращает 404 | Владелец, файл, отключённый ShareLink | POST-запрос /api/v1/links/{token}/resolve | assertStatus(404) |
| 4 | `test_download_via_link_returns_url` | Проверяет, что скачивание по ссылке возвращает URL | Владелец, файл Available, ShareLink | POST-запрос /api/v1/links/{token}/download | assertOk() (200), assertJsonStructure(['data' => ['url', 'expires_in']]) |
| 5 | `test_download_via_invalid_link_returns_404` | Проверяет, что скачивание по несуществующему токену возвращает 404 | Нет данных | POST-запрос /api/v1/links/bad-token/download | assertStatus(404) |
| 6 | `test_save_via_link_requires_auth` | Проверяет, что сохранение без аутентификации возвращает 401 | Нет данных | POST-запрос /api/v1/links/some-token/save | assertUnauthorized() (401) |
| 7 | `test_save_via_link_works` | Проверяет успешное сохранение файла через ссылку | Владелец, saver, файл Available, ShareLink с allow_save | POST-запрос /api/v1/links/{token}/save от имени saver | assertOk() (200), assertJsonPath('result', 'success') |
| 8 | `test_save_via_link_fails_for_own_file` | Проверяет, что владелец не может сохранить свой файл через ссылку | Владелец, файл, ShareLink | POST-запрос /api/v1/links/{token}/save от имени владельца | assertStatus(422), assertJsonPath('data.code', 'OWN_FILE') |
| 9 | `test_save_via_link_fails_without_save_permission` | Проверяет, что без allow_save сохранение запрещено | Владелец, saver, файл, ShareLink с allow_save=false | POST-запрос /api/v1/links/{token}/save от имени saver | assertStatus(403), assertJsonPath('data.code', 'SAVE_NOT_ALLOWED') |
| 10 | `test_save_via_link_fails_when_already_saved` | Проверяет, что повторное сохранение запрещено | Владелец, saver с FileUserAccess, файл, ShareLink | POST-запрос /api/v1/links/{token}/save от имени saver | assertStatus(422), assertJsonPath('data.code', 'ALREADY_SAVED') |

### `Feature/Support`
*Всего тестов: 22*

#### `SuggestionTest`
*Класс: `Tests\Feature\Support\SuggestionTest` | Тестов: 8*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_user_can_create_suggestion` | Проверяет создание предложения | Пользователь | POST-запрос /api/v1/support/suggestions с JSON: body='Please add dark mode support.' | assertStatus(201), assertJsonPath('result', 'success') |
| 2 | `test_create_suggestion_requires_body` | Проверяет валидацию — body обязателен | Пользователь | POST-запрос с пустым JSON {} | assertStatus(422) |
| 3 | `test_user_can_list_own_suggestions` | Проверяет получение списка своих предложений | Пользователь, SuggestionTicket status='new' | GET-запрос /api/v1/support/suggestions | assertOk() (200), assertCount(1, items) |
| 4 | `test_list_suggestions_shows_only_own` | Проверяет изоляцию — пользователь видит только свои предложения | Два пользователя, предложение для каждого | GET-запрос от первого | assertCount(1, items) |
| 5 | `test_user_can_show_own_suggestion` | Проверяет просмотр деталей своего предложения | Пользователь, SuggestionTicket | GET-запрос /api/v1/support/suggestions/{suggestionId} | assertOk() (200), assertJsonPath('data.suggestion.id', $suggestion->id) |
| 6 | `test_show_other_users_suggestion_returns_404` | Проверяет, что чужое предложение возвращает 404 | Два пользователя, предложение второго | GET-запрос от первого | assertStatus(404) |
| 7 | `test_download_attachment_with_nonexistent_suggestion` | Проверяет скачивание вложения несуществующего предложения | Пользователь | GET-запрос /api/v1/support/suggestions/nonexistent/attachments/att1 | assertStatus(404) |
| 8 | `test_unauthenticated_user_cannot_access_suggestions` | Проверяет, что неаутентифицированный пользователь не может получить список предложений | Нет пользователя | GET-запрос /api/v1/support/suggestions | assertUnauthorized() (401) |

#### `SupportTicketTest`
*Класс: `Tests\Feature\Support\SupportTicketTest` | Тестов: 14*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_user_can_create_ticket` | Проверяет создание тикета поддержки | Пользователь | POST-запрос /api/v1/support/tickets с JSON: body='I need help with uploading files.' | assertStatus(201), assertJsonPath('result', 'success') |
| 2 | `test_create_ticket_requires_body` | Проверяет валидацию — body обязателен | Пользователь | POST-запрос с пустым JSON {} | assertStatus(422) |
| 3 | `test_user_can_list_own_tickets` | Проверяет получение списка своих тикетов | Пользователь, SupportTicket status='new' | GET-запрос /api/v1/support/tickets | assertOk() (200), assertCount(1, items) |
| 4 | `test_list_tickets_shows_only_own` | Проверяет изоляцию — пользователь видит только свои тикеты | Два пользователя, тикет для каждого | GET-запрос от первого пользователя | assertOk() (200), assertCount(1, items) |
| 5 | `test_user_can_show_own_ticket` | Проверяет просмотр деталей своего тикета | Пользователь, SupportTicket | GET-запрос /api/v1/support/tickets/{ticketId} | assertOk() (200), assertJsonPath('data.ticket.id', $ticket->id) |
| 6 | `test_show_other_users_ticket_returns_404` | Проверяет, что чужой тикет возвращает 404 | Два пользователя, тикет второго | GET-запрос от первого | assertStatus(404) |
| 7 | `test_user_can_add_message` | Проверяет добавление сообщения в свой тикет | Пользователь, SupportTicket status='new' | POST-запрос /api/v1/support/tickets/{ticketId}/messages с JSON: body='More details' | assertOk() (200) |
| 8 | `test_add_message_to_other_users_ticket_returns_404` | Проверяет, что добавление сообщения в чужой тикет возвращает 404 | Два пользователя, тикет второго | POST-запрос от первого | assertStatus(404) |
| 9 | `test_user_can_confirm_ticket_completion` | Проверяет подтверждение завершения тикета | Пользователь, SupportTicket status='awaiting_confirmation' | POST-запрос /api/v1/support/tickets/{ticketId}/confirm | assertOk() (200), assertJsonPath('data.status', 'completed') |
| 10 | `test_confirm_ticket_wrong_status_returns_422` | Проверяет, что неправильный статус вызывает ошибку | Пользователь, SupportTicket status='new' | POST-запрос /api/v1/support/tickets/{ticketId}/confirm | assertStatus(422) |
| 11 | `test_user_can_mark_ticket_read` | Проверяет отметку тикета как прочитанного | Пользователь, SupportTicket status='in_progress' | POST-запрос /api/v1/support/tickets/{ticketId}/mark-read | assertOk() (200) |
| 12 | `test_add_message_to_nonexistent_ticket_returns_404` | Проверяет, что сообщение в несуществующий тикет возвращает 404 | Пользователь | POST-запрос /api/v1/support/tickets/nonexistent/messages | assertStatus(404) |
| 13 | `test_unauthenticated_user_cannot_access_tickets` | Проверяет, что неаутентифицированный пользователь не может получить тикеты | Нет пользователя | GET-запрос /api/v1/support/tickets | assertUnauthorized() (401) |
| 14 | `test_user_can_download_attachment_with_nonexistent_ticket_id` | Проверяет, что скачивание вложения несуществующего тикета возвращает 404 | Пользователь | GET-запрос /api/v1/support/tickets/nonexistent/attachments/att1 | assertStatus(404) |

### `Feature/Tariff`
*Всего тестов: 8*

#### `TariffTest`
*Класс: `Tests\Feature\Tariff\TariffTest` | Тестов: 8*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_user_can_list_tariffs` | Проверяет, что пользователь может получить список тарифных планов | Пользователь | GET-запрос /api/v1/tariffs | assertOk() (200), assertJsonPath('result', 'success'), assertJsonStructure(['data' => ['plans']]) |
| 2 | `test_tariff_list_contains_all_plans` | Проверяет, что список содержит все три плана: free, silver, gold | Пользователь | GET-запрос /api/v1/tariffs | assertTrue — разница между ключами планов и ['free','silver','gold'] пуста |
| 3 | `test_user_can_view_tariff_usage` | Проверяет просмотр текущего использования тарифа | Пользователь, 2 файла по 100 байт, 1 DeviceSession | GET-запрос /api/v1/tariffs/usage | assertOk() (200), assertJsonPath('result', 'success') |
| 4 | `test_tariff_usage_excludes_deleted_files` | Проверяет, что удалённые файлы не учитываются в использовании | Пользователь, файл 500 байт (обычный) и файл 300 байт (статус Deleted) | GET-запрос /api/v1/tariffs/usage | assertEquals(500, storage_used_bytes) |
| 5 | `test_tariff_usage_excludes_uploading_files` | Проверяет, что файлы в процессе загрузки не учитываются | Пользователь, файл 200 байт со статусом uploading | GET-запрос /api/v1/tariffs/usage | assertEquals(0, storage_used_bytes) |
| 6 | `test_user_can_request_plan_change` | Проверяет запрос на смену тарифного плана | Пользователь | POST-запрос /api/v1/tariffs/request с JSON: {"plan": "silver"} | assertOk() (200), assertJsonPath('result', 'success') |
| 7 | `test_request_plan_change_fails_with_invalid_plan` | Проверяет, что неверный план вызывает ошибку | Пользователь | POST-запрос /api/v1/tariffs/request с JSON: {"plan": "platinum"} | assertStatus(422) |
| 8 | `test_unauthenticated_user_cannot_access_tariffs` | Проверяет, что неаутентифицированный пользователь не может получить список тарифов | Нет пользователя | GET-запрос /api/v1/tariffs | assertUnauthorized() (401) |

### `Feature/User`
*Всего тестов: 18*

#### `InboxTest`
*Класс: `Tests\Feature\User\InboxTest` | Тестов: 12*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_count_returns_zero_when_empty` | Проверяет, что при пустом инбоксе счётчик возвращает нули | Пользователь, нет входящих элементов | GET-запрос /api/v1/inbox/count | assertJsonPath('data.files', 0); assertJsonPath('data.folders', 0); assertJsonPath('data.total', 0) |
| 2 | `test_count_returns_correct_counts` | Проверяет корректный подсчёт входящих файлов и папок | Пользователь-получатель, отправитель, PendingReceivedFile и PendingReceivedSharedFolder | GET-запрос /api/v1/inbox/count | assertJsonPath('data.files', 1); assertJsonPath('data.folders', 1); assertJsonPath('data.total', 2) |
| 3 | `test_list_files_returns_empty_when_none` | Проверяет, что при отсутствии файлов список пуст | Пользователь, нет входящих файлов | GET-запрос /api/v1/inbox/files | assertJsonPath('data.items', []) |
| 4 | `test_list_files_returns_pending_files` | Проверяет список входящих файлов | Пользователь-получатель, отправитель, файл, PendingReceivedFile | GET-запрос /api/v1/inbox/files | assertOk() (200), assertCount(1, items) |
| 5 | `test_list_files_shows_only_for_recipient` | Проверяет изоляцию — файлы видны только получателю | Три пользователя (current, other, sender), PendingReceivedFile для other | GET-запрос от имени current | assertCount(0, items) |
| 6 | `test_accept_file_creates_access` | Проверяет принятие входящего файла | Получатель, отправитель, файл, PendingReceivedFile | POST-запрос /api/v1/inbox/files/accept с JSON: {"ids": [pending_id]} | assertOk() (200); assertDatabaseHas('file_user_access', ...); assertDatabaseMissing('pending_received_files', ...) |
| 7 | `test_accept_file_requires_ids` | Проверяет валидацию — ids обязателен | Пользователь | POST-запрос /api/v1/inbox/files/accept с пустым JSON {} | assertStatus(422) |
| 8 | `test_reject_file_removes_pending` | Проверяет отклонение входящего файла | Получатель, отправитель, файл, PendingReceivedFile | POST-запрос /api/v1/inbox/files/reject с JSON: {"ids": [pending_id]} | assertOk() (200); assertDatabaseMissing('pending_received_files', ...) |
| 9 | `test_list_shared_folders_returns_pending` | Проверяет список ожидающих общих папок | Получатель, приглашающий, общая папка, PendingReceivedSharedFolder | GET-запрос /api/v1/inbox/shared-folders | assertOk() (200), assertCount(1, items) |
| 10 | `test_accept_shared_folder_creates_access` | Проверяет принятие приглашения в общую папку | Получатель, приглашающий, общая папка, PendingReceivedSharedFolder | POST-запрос /api/v1/inbox/shared-folders/accept с JSON: {"ids": [pending_id]} | assertOk() (200); assertDatabaseHas('shared_folder_accesses', ...) |
| 11 | `test_reject_shared_folder_removes_pending` | Проверяет отклонение приглашения в общую папку | Получатель, приглашающий, общая папка, PendingReceivedSharedFolder | POST-запрос /api/v1/inbox/shared-folders/reject с JSON: {"ids": [pending_id]} | assertOk() (200); assertDatabaseMissing('pending_received_shared_folders', ...) |
| 12 | `test_unauthenticated_user_cannot_access_inbox` | Проверяет, что неаутентифицированный пользователь не может получить доступ к инбоксу | Нет пользователя | GET-запрос /api/v1/inbox/count | assertUnauthorized() (401) |

#### `UserSettingsTest`
*Класс: `Tests\Feature\User\UserSettingsTest` | Тестов: 6*

| № | Тест | Описание | Входные данные | Выходные данные | Ожидаемый результат |
|---|------|----------|---------------|-----------------|--------------------|
| 1 | `test_user_can_update_settings` | Проверяет обновление настроек уведомлений | Пользователь | PATCH-запрос /api/v1/user/settings с JSON: {"notifications_enabled": false, "notify_new_files": true} | assertOk() (200), assertJsonPath('result', 'success') |
| 2 | `test_settings_persist_in_database` | Проверяет, что настройки сохраняются в БД | Пользователь | PATCH-запрос /api/v1/user/settings; затем refresh модели | assertFalse(notifications_enabled); assertFalse(notify_new_files) |
| 3 | `test_user_can_update_contact_settings` | Проверяет обновление настроек контактов | Пользователь | PATCH-запрос /api/v1/user/settings с JSON: {"allow_contacts_without_confirmation": true, "auto_add_received_files": true} | assertTrue(allow_contacts_without_confirmation); assertTrue(auto_add_received_files) |
| 4 | `test_updating_with_invalid_boolean_fails` | Проверяет валидацию — не-булево значение для булева поля вызывает ошибку | Пользователь | PATCH-запрос /api/v1/user/settings с JSON: {"notifications_enabled": "not-a-boolean"} | assertStatus(422) |
| 5 | `test_empty_update_succeeds` | Проверяет, что пустой запрос успешно проходит | Пользователь | PATCH-запрос с пустым JSON {} | assertOk() (200) |
| 6 | `test_unauthenticated_user_cannot_update_settings` | Проверяет, что неаутентифицированный пользователь не может обновить настройки | Нет пользователя | PATCH-запрос /api/v1/user/settings | assertUnauthorized() (401) |
