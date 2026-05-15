# Тестирование Backend (Laravel 13)

## Быстрый старт

```bash
# Настройка тестовой БД (первый раз)
mysql -u root -e "CREATE DATABASE IF NOT EXISTS delifile-test"
mysql -u root -e "GRANT ALL ON delifile-test.* TO 'delifile-test'@'localhost' IDENTIFIED BY 'd<&vN6gG5P9Qo2oY'"

# Запуск всех тестов
composer test

# Запуск только Unit тестов
php artisan test --testsuite=Unit

# Запуск только Feature тестов
php artisan test --testsuite=Feature

# Запуск конкретного файла
php artisan test tests/Feature/Auth/RegistrationTest.php

# Запуск с детальным выводом
php artisan test --verbose
```

**Важно:** phpunit.xml настроен на MySQL БД `delifile`. Для работы используется `DatabaseTransactions` (транзакции откатываются после каждого теста).

## Конфигурация

- **phpunit.xml** — использует MySQL и `CACHE_STORE=array`
- **.env.testing** — содержит настройки для MySQL (общие с рабочей БД `delifile`)
- **TestCase.php** — использует `DatabaseTransactions` (не `RefreshDatabase`), чтобы не затрагивать существующие данные

## Структура тестов

```
tests/
├── Feature/
│   ├── Activity/
│   │   └── ActivityTest.php                 (5 тестов)
│   ├── Admin/
│   │   └── AdminTest.php                    (14 тестов)
│   ├── Auth/
│   │   ├── RegistrationTest.php             (4 теста)
│   │   ├── LoginTest.php                    (5 тестов)
│   │   ├── SessionTest.php                  (3 теста)
│   │   ├── PasswordChangeTest.php           (3 теста)
│   │   ├── EmailVerificationTest.php        (6 тестов)
│   │   └── PasswordResetTest.php            (6 тестов)
│   ├── Comments/
│   │   └── CommentTest.php                  (13 тестов)
│   ├── Contacts/
│   │   ├── ContactTest.php                  (10 тестов)
│   │   └── ContactRequestTest.php           (8 тестов)
│   ├── Files/
│   │   ├── FileUploadTest.php               (6 тестов)
│   │   ├── FileShowTest.php                 (5 тестов)
│   │   ├── FileIndexTest.php                (3 теста)
│   │   ├── FileDeleteTest.php               (4 теста)
│   │   ├── FileActionsTest.php              (7 тестов)
│   │   ├── FileDownloadTest.php             (6 тестов)
│   │   └── FileVersionTest.php              (12 тестов)
│   ├── Invitations/
│   │   └── InvitationTest.php               (12 тестов)
│   ├── Links/
│   │   └── UrlFileTest.php                  (8 тестов)
│   ├── Organization/
│   │   ├── FolderTest.php                   (12 тестов)
│   │   └── TagTest.php                      (10 тестов)
│   ├── SharedFolders/
│   │   └── SharedFolderTest.php             (20 тестов)
│   ├── Sharing/
│   │   ├── ShareToContactTest.php           (3 теста)
│   │   ├── CreateLinkTest.php               (3 теста)
│   │   ├── PublicLinkTest.php               (3 теста)
│   │   └── SharingCoverageTest.php          (10 тестов)
│   ├── Support/
│   │   ├── SupportTicketTest.php            (14 тестов)
│   │   └── SuggestionTest.php               (8 тестов)
│   ├── Tariff/
│   │   └── TariffTest.php                   (8 тестов)
│   └── User/
│       ├── InboxTest.php                    (12 тестов)
│       └── UserSettingsTest.php             (6 тестов)
├── Unit/
│   └── Services/
└── TestCase.php
```

**Всего: 31 файл, 230+ feature-тестов**

## Соглашения

1. Используем `DatabaseTransactions` (не `RefreshDatabase`) — транзакции откатываются после каждого теста, не затрагивая существующие данные
2. Каждый Feature-тест тестирует один endpoint или один user flow
3. Используем named-методы фабрик для читаемости: `File::factory()->uploading()->create()`
4. Проверяем формат ответа: `{result, message, data}`
5. Для Public эндпоинтов — без `actingAs()`
6. Для Protected — через `actingAs($user)`
7. Для Admin — через `actingAs($superuser)`
8. При тестировании с `Http::fake()` — явно мокать HTTP-запросы
9. Для Push-уведомлений VAPID-ключи заданы в `.env.testing`

## VAPID / Push-уведомления

VAPID-ключи для WebPush настроены в `.env.testing`:
```
VAPID_PUBLIC_KEY=BAgQ8HOSeECR4NjJGECcqUNqrbE6YphvO5cT-X2ODRIPE4qcBd3FQ9kakGqF7U1ctSk0dSmvMOJV9rW8J4AC5VQ
VAPID_PRIVATE_KEY=8YGlm-0iu8Qy0e86LLv6j8Fmw_qSOnkie6t2WrfFCHE
```

Если тест вызывает `PushNotificationService`, убедитесь что эти ключи заданы, иначе WebPush выбросит исключение `[VAPID] You must provide a public key.`

## Доступные фабрики (13 шт)

- `UserFactory` — пользователи (включая состояния)
- `FileFactory` — файлы (состояние `uploading()`)
- `FolderFactory` — папки (состояние `childOf()`)
- `TagFactory` — теги
- `ContactFactory` — контакты (состояние `resolvedTo()`)
- `ShareLinkFactory` — ссылки на файлы (состояния: `disabled()`, `expired()`, `withSave()`)
- `SharedFolderFactory` — общие папки (состояние `childOf()`)
- `SharedFolderAccessFactory` — доступы к общим папкам (состояние `edit()`)
- `SharedFolderFileFactory` — файлы в общих папках
- `FileUserAccessFactory` — доступы к файлам (состояние `owner()`)
- `ActivityLogFactory` — логи активности
- `DeviceSessionFactory` — сессии
- `InvitationFactory` — приглашения

## Отладка

```bash
# Вывод SQL-запросов
php artisan test --verbose

# Фильтр по тесту
php artisan test --filter='test_user_can_register'

# Запуск только новых тестов
php artisan test --filter='Tests\\Feature\\(Contacts|Organization|SharedFolders|Comments)'
```

## Написание нового теста

```php
<?php

namespace Tests\Feature\Activity;

use App\Models\ActivityLog;
use App\Models\File;
use App\Models\User;
use Tests\TestCase;

class ActivityTest extends TestCase
{
    public function test_user_can_list_activity(): void
    {
        $user = User::factory()->create();
        $file = File::factory()->create(['owner_id' => $user->id]);
        ActivityLog::factory()->count(3)->create([
            'file_id' => $file->id,
            'user_id' => $user->id,
        ]);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/activity');

        $response->assertOk()
            ->assertJsonPath('result', 'success')
            ->assertJsonStructure(['data' => ['items', 'pagination']]);
    }

    public function test_unauthenticated_user_cannot_access_activity(): void
    {
        $response = $this->getJson('/api/v1/activity');
        $response->assertUnauthorized();
    }
}
```
