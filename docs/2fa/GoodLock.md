# LockPass — Техническое задание и инфраструктурный гайдбук

> Документ в двух частях: **ТЗ** (что строим) и **Инфраструктура** (как
> строим, деплоим, автоматизируем). Инфраструктурная часть написана по
> реальному опыту проекта Delifile — достаточно открыть этот файл, чтобы
> воспроизвести всё окружение без итераций.

---

## Архитектурное решение: LockPass — самостоятельный сервис

LockPass разрабатывается как **независимое универсальное приложение** 2FA.
У него собственная БД, собственные пользователи, собственный деплой.
Домен: **lockpass.ru**. Сервер: **62.217.182.207** (FastPanel, shared с другими
проектами).

Никакой общей базы данных, shared users или модульной зависимости с Delifile
**нет и быть не должно**.

Допустимые связи с Delifile:
1. **Delifile как клиент LockPass** — в будущем Delifile может использовать
   LockPass как источник 2FA по открытому API (как любое стороннее приложение).
2. **APK-сборки в Delifile** — Android APK после сборки загружается в папку
   Delifile для удобства тестирования. Это не архитектурная зависимость, а
   инструмент доставки артефактов.

---

## Оценка исходного ТЗ (до доработки)

Функциональная часть хорошая: сценарии, сущности, статусы — всё на месте.
Пробелы, закрытые в этой версии:

- Push-уведомления отсутствовали — добавлены в требования и интеграцию FCM/APNs.
- Стек не указан — добавлен раздел 19.
- TOTP без параметров — добавлен раздел 31.
- Нет API JSON-схем — добавлен раздел 32.
- Нет Mobile Auth Flow — добавлен раздел 33.
- Нет Firebase Setup — добавлен раздел 34.
- Нет Apple Developer Setup — добавлен раздел 35.
- Нет локальной разработки — добавлен раздел 36.
- Нет стратегии тестирования — добавлен раздел 37.
- iOS background push не детализирован — добавлен раздел 38.
- SSE vs Polling не выбрано — выбор зафиксирован в разделе 9.2.

---

# Часть I — Техническое задание

## 1. Общие сведения

### 1.1. Наименование проекта
LockPass — самостоятельная система двухфакторной аутентификации с мобильным
приложением для Android и iOS.

### 1.2. Назначение проекта
Подтверждение входа пользователя в любое клиентское приложение через мобильное
устройство: push-уведомление → подтверждение одним нажатием, либо ввод
одноразового TOTP-кода.

### 1.3. Состав решения
- Backend API (Laravel).
- Веб-интерфейс: страница подтверждения + панель управления устройствами
  (Angular SPA).
- Мобильное приложение Android + iOS (Expo / React Native).
- Административная панель.
- Журнал событий безопасности.

---

## 2. Цели и задачи

### 2.1. Цели
- Дополнительный уровень защиты при авторизации в клиентских приложениях.
- Исключить доступ только по логину и паролю.
- Привязка мобильного устройства к учётной записи LockPass.
- Push-подтверждение входа с мобильного устройства.

### 2.2. Задачи
- Регистрация пользователя в LockPass и привязка устройства.
- Создание 2FA-сессии при попытке входа в клиентское приложение.
- Push-уведомление на устройство с открытием экрана подтверждения.
- Подтверждение входа или выдача TOTP-кода.
- Проверка результата на сервере LockPass.
- Отзыв привязки устройства.
- Ведение журнала событий.
- Открытый API для интеграции клиентских приложений.

---

## 3. Термины и сокращения

| Термин | Значение |
|--------|---------|
| 2FA | Двухфакторная аутентификация |
| Web | Веб-интерфейс LockPass |
| Mobile App | Мобильное приложение LockPass |
| Client App | Стороннее приложение, использующее LockPass API |
| TOTP | One-time password, RFC 6238 |
| Session | Сессия подтверждения входа |
| Device | Привязанное мобильное устройство |
| Recovery code | Резервный код восстановления доступа |
| FCM | Firebase Cloud Messaging (push Android) |
| APNs | Apple Push Notification service (push iOS) |
| FCM token | Токен устройства для отправки push |

---

## 4. Роли пользователей

### 4.1. Обычный пользователь
- Регистрируется в LockPass.
- Привязывает мобильное устройство.
- Подтверждает вход в клиентские приложения.
- Использует резервные коды.
- Управляет своими устройствами.

### 4.2. Администратор LockPass
- Просматривает список пользователей и их устройств.
- Блокирует устройство или пользователя.
- Сбрасывает 2FA для пользователя.
- Просматривает журнал событий.
- Управляет политиками безопасности.

### 4.3. Клиентское приложение (интеграция)
- Создаёт 2FA-сессию по API.
- Опрашивает статус сессии.
- Получает результат (approved / rejected / expired).

---

## 5. Функциональные требования

### 5.1. Авторизация пользователя
Вход в LockPass (web и mobile) по email и паролю. Токен авторизации —
Sanctum Personal Access Token.

### 5.2. Создание 2FA-сессии
Клиентское приложение вызывает `POST /api/2fa/session/create` с user_id.
Backend создаёт сессию `pending` с TTL 5 минут.

### 5.3. Push-уведомление
Сразу после создания сессии backend отправляет push на все активные устройства
пользователя. Push содержит `session_id` и открывает экран подтверждения.

### 5.4. Экран подтверждения (web)
Показывает QR-код с данными сессии и таймер. Клиентское приложение опрашивает
статус сессии polling-ом каждые 2 секунды (решение по SSE vs Polling — раздел 9.2).

### 5.5. Сканирование QR
Мобильное приложение может получить данные сессии сканированием QR — резервный
способ, если push не дошёл.

### 5.6. Подтверждение / отклонение
Пользователь нажимает «Разрешить» или «Отклонить» в мобильном приложении.
Backend переводит сессию в `approved` / `rejected`.

### 5.7. TOTP-код
Мобильное приложение отображает одноразовый код; пользователь вводит его в
клиентском приложении вручную (параметры — раздел 31).

### 5.8. Привязка устройства
Пользователь сканирует QR привязки; приложение отправляет `device_uuid` и
`fcm_token`.

### 5.9. Отвязка устройства
Через web или мобильное приложение. Backend переводит устройство в `revoked`,
FCM-токен инвалидируется.

### 5.10. Журнал событий
Все значимые события логируются с IP, user agent, timestamp.

### 5.11. Recovery flow
Восстановление через резервные коды (генерируются при привязке устройства) или
административный сброс.

---

## 6. Пользовательские сценарии

### 6.1. Привязка устройства
1. Пользователь открывает «Добавить устройство» в web.
2. Система генерирует QR-привязки.
3. Пользователь сканирует QR мобильным приложением LockPass.
4. Приложение отправляет `device_uuid` + `fcm_token`.
5. Сервер сохраняет устройство как `active`, показывает резервные коды.

### 6.2. Подтверждение входа через Push
1. Клиентское приложение создаёт 2FA-сессию через LockPass API.
2. LockPass отправляет push на устройство пользователя.
3. Пользователь открывает уведомление → нажимает «Разрешить».
4. Клиентское приложение опрашивает статус и завершает авторизацию.

### 6.3. Подтверждение через TOTP
1. Клиентское приложение показывает поле ввода кода.
2. Приложение LockPass отображает код с таймером (30 сек).
3. Пользователь вводит код → клиент проверяет через LockPass API.

### 6.4. Отзыв устройства
1. Пользователь выбирает устройство в списке → «Удалить».
2. Статус → `revoked`; push на это устройство больше не отправляются.

---

## 7. Backend API

### 7.1. Основные задачи
- Управление пользователями и сессиями.
- Создание и завершение 2FA-сессий.
- Генерация и проверка TOTP (параметры — раздел 31).
- Привязка и отвязка устройств (с сохранением `fcm_token`).
- Отправка push через FCM/APNs.
- Аудит событий.
- Управление резервными кодами.

### 7.2. API-методы

```
# Аутентификация
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout

# Управление 2FA-сессиями (вызывается клиентским приложением)
POST   /api/2fa/session/create
GET    /api/2fa/sessions/{id}
POST   /api/2fa/session/verify-code

# Действия мобильного приложения
POST   /api/2fa/session/approve
POST   /api/2fa/session/reject

# Управление устройствами
POST   /api/2fa/device/link
POST   /api/2fa/device/unlink
POST   /api/2fa/device/update-token
GET    /api/2fa/devices

# Восстановление и аудит
GET    /api/2fa/audit
POST   /api/2fa/recovery/verify
```

JSON-схемы всех методов — раздел 32.

### 7.3. Схема базы данных

#### users
| Поле | Тип |
|------|-----|
| id | bigint PK |
| name | string |
| email | string unique |
| password | string (bcrypt) |
| two_factor_enabled | boolean default false |
| created_at / updated_at | timestamps |

#### devices
| Поле | Тип |
|------|-----|
| id | bigint PK |
| user_id | FK → users |
| device_uuid | string unique |
| device_name | string |
| platform | enum(android, ios) |
| app_version | string |
| fcm_token | string nullable |
| totp_secret | string nullable (зашифрован) |
| status | enum(active, revoked, blocked, pending_link) |
| last_seen_at | timestamp |
| created_at / updated_at | timestamps |

#### two_factor_sessions
| Поле | Тип |
|------|-----|
| id | bigint PK |
| user_id | FK → users |
| device_id | FK → devices nullable |
| session_uuid | string unique |
| code | string nullable (TOTP) |
| qr_payload | text |
| client_app | string nullable |
| status | enum(pending, approved, rejected, expired, used) |
| expires_at | timestamp |
| confirmed_at | timestamp nullable |
| created_at / updated_at | timestamps |

#### two_factor_events
| Поле | Тип |
|------|-----|
| id | bigint PK |
| user_id | FK → users nullable |
| device_id | FK → devices nullable |
| session_id | FK → two_factor_sessions nullable |
| event_type | string |
| event_data | json nullable |
| ip_address | string |
| user_agent | string |
| created_at | timestamp |

#### recovery_codes
| Поле | Тип |
|------|-----|
| id | bigint PK |
| user_id | FK → users |
| code_hash | string |
| used_at | timestamp nullable |
| created_at / updated_at | timestamps |

---

## 8. Мобильное приложение

### 8.1. Экраны
- Приветствие / регистрация / вход
- Привязка устройства (QR-сканер)
- Экран подтверждения входа (push-triggered)
- Одноразовый TOTP-код с таймером
- Список активных сессий / история
- Управление устройствами
- Настройки безопасности (PIN, биометрия)
- Экран восстановления доступа

### 8.2. Функции
- Регистрация FCM/APNs токена при старте → отправка на backend.
- Обработка push во всех состояниях (foreground / background / killed) —
  детали в разделе 38.
- Сканирование QR-кода.
- Отправка approve/reject.
- Отображение TOTP-кода с таймером.
- SecureStore для токенов и TOTP-секретов (Expo).
- Локальная защита PIN / биометрией (Expo LocalAuthentication).
- Обновление `fcm_token` при его смене (`onTokenRefresh`).

### 8.3. Платформы
Android (minSdk 26) и iOS (min iOS 16).

---

## 9. Веб-интерфейс (Angular)

### 9.1. Экран подтверждения
- QR-код с данными сессии.
- Таймер TTL (5 мин).
- Поле ввода TOTP-кода (ручной режим).
- Статус: ожидание → успех / ошибка / истечение.

### 9.2. Polling vs SSE — решение: Polling

Выбран **polling** каждые 2 секунды по `GET /api/2fa/sessions/{id}`.

Причина: nginx с reverse proxy на shared-хостинге (FastPanel) часто буферизует
SSE, что приводит к задержкам без дополнительной настройки на уровне панели.
Polling проще, предсказуем и достаточен при TTL 5 минут.

### 9.3. Административный раздел
- Список пользователей и устройств.
- Блокировка устройства / сброс 2FA.
- Журнал событий с фильтрами.

---

## 10. Требования к безопасности

- Все запросы — HTTPS (TLS 1.2+, Let's Encrypt через FastPanel).
- 2FA-сессии: TTL 5 минут, одноразовые.
- TOTP: максимум 5 неверных попыток → блокировка на 15 минут.
- Лимит создания сессий: 10 в минуту на пользователя (раздел 30).
- QR содержит только `session_uuid` + nonce.
- TOTP-секреты хранятся в БД в зашифрованном виде (APP_KEY Laravel).
- Мобильное приложение: секреты в SecureStore, биометрия/PIN обязательна.
- Устройство может быть отозвано удалённо.

---

## 11. Логирование событий

| `event_type` | Описание |
|-------------|---------|
| `user.registered` | Регистрация |
| `user.login` | Вход в LockPass |
| `device.linked` | Привязка устройства |
| `device.unlinked` | Отвязка устройства |
| `2fa.session.created` | Создана сессия |
| `2fa.push.sent` | Push отправлен |
| `2fa.session.scanned` | QR отсканирован |
| `2fa.session.approved` | Успешное подтверждение |
| `2fa.session.rejected` | Отклонение |
| `2fa.session.expired` | Истечение |
| `2fa.code.invalid` | Неверный код |
| `recovery.used` | Использован резервный код |
| `admin.2fa.reset` | Административный сброс |

---

## 12. Восстановление доступа

- При привязке устройства генерируются 8 одноразовых резервных кодов.
- Использованный код помечается `used_at`.
- Администратор может сбросить 2FA после верификации личности.
- При утере устройства — отзыв через web-интерфейс LockPass.

---

## 13. Ограничения

- Один код — одно использование.
- Одна сессия — один approve.
- Истекшие сессии не подтверждаются.
- `device_uuid` уникален глобально.
- Допустимо несколько привязанных устройств (настраивается политикой).

---

## 14. Статусы

**Сессия:** `pending` → `approved` / `rejected` / `expired` / `used`

**Устройство:** `pending_link` → `active` / `revoked` / `blocked`

### Ошибки API
| HTTP | Значение |
|------|---------|
| 422 | Неверный код или данные |
| 410 | Истекшая сессия |
| 403 | Устройство заблокировано / не привязано |
| 429 | Превышен rate limit |
| 409 | Сессия уже использована |

---

## 15. Критерии приёмки

- Пользователь может зарегистрироваться и привязать устройство.
- Push приходит в течение 5 сек после создания сессии.
- Подтверждение через push работает.
- Подтверждение через TOTP-код работает.
- Клиентское приложение получает статус `approved` через polling.
- Устройство можно отвязать.
- События сохраняются в журнал.
- Резервные коды работают.
- Повторное использование QR или кода невозможно.
- Вход без 2FA невозможен при включённой защите.

---

## 16. Этапы реализации

### Этап 1 — Backend core
БД + миграции, API сессий и устройств, TOTP, Laravel queue.

### Этап 2 — Мобильное приложение
Expo-проект, FCM (Expo Notifications), SecureStore, LocalAuthentication,
подтверждение входа.

### Этап 3 — Web-интерфейс
Angular-компоненты: 2FA-экран, polling, список устройств.

### Этап 4 — Admin + Recovery + Push
Административный раздел, резервные коды, полная интеграция FCM/APNs.

---

## 17. Deliverables
- Исходный код backend (Laravel).
- Исходный код мобильного приложения (Expo).
- Исходный код web (Angular).
- Миграции БД.
- Описание API (раздел 32).
- Инструкция по развёртыванию (Часть II).

---

## 18. Структура репозитория

```
lockpass/
├── backend/          # Laravel API
├── frontend/         # Angular SPA
│   ├── src/
│   ├── scripts/
│   │   └── bump-version.js
│   └── dist/         # .gitignore — создаётся при сборке
├── mobile/           # Expo / React Native
│   ├── app/          # expo-router экраны
│   ├── plugins/      # нативные плагины (Expo config plugins)
│   └── app.json
├── public/           # nginx webroot — .gitignore (кроме public/backend/)
│   └── backend/
│       └── index.php # точка входа Laravel
├── docs/
├── deploy            # bash-скрипт полного деплоя (chmod +x)
└── .github/
    └── workflows/
        ├── deploy.yml      # web autodeploy → self-hosted Linux
        └── ios-build.yml   # iOS build & submit → self-hosted macOS
```

> `mobile/ios/` — в `.gitignore`. Нативный код генерируется плагинами.
> Нативный Swift/Kotlin — только в `mobile/plugins/`.

---

# Часть II — Инфраструктура и развёртывание

## 19. Схема окружений

| Машина | Роль | Что происходит |
|--------|------|---------------|
| Windows / WSL (Ubuntu) | Разработка | Написание кода, `git push` в GitHub |
| 62.217.182.207 (FastPanel) | Продакшн | Self-hosted runner принимает триггер, запускает `./deploy` в живом каталоге |
| MacBook | iOS CI | Self-hosted runner собирает IPA и публикует в TestFlight |

Весь деплой инициируется через `git push` из WSL — прямого SSH-деплоя с локальной
машины на прод нет и быть не должно.

> **Важно:** self-hosted Linux runner должен быть установлен **на сервере
> 62.217.182.207**, а не на WSL. WSL тоже определяется как Linux, и GitHub не
> различит их по меткам — runner окажется на локальной машине вместо прода.

---

## 20. Технологический стек

| Слой | Технология | Версия |
|------|-----------|--------|
| Backend | Laravel | ^13.0 |
| PHP | PHP | ^8.3 |
| Frontend | Angular | ^21.0 |
| Мобильное | Expo SDK | ~54 |
| Мобильное | React Native | ~0.81 |
| Push | Firebase (FCM) + APNs | — |
| Веб-сервер | nginx + PHP-FPM (управляется FastPanel) | — |
| Очереди | Laravel Queue + Redis, workers запущены напрямую | — |
| CI/CD | GitHub Actions, self-hosted runners | — |
| iOS дистрибуция | EAS CLI (local build) + TestFlight | — |

---

## 20. Сервер и FastPanel

- **IP:** `62.217.182.207`
- **Домен:** `lockpass.ru`
- **Панель:** FastPanel (уже установлена, содержит другие проекты)
- **Пользователь:** `atryom` (sudo доступен)
- **Путь проекта:** `/var/www/atryom/data/www/lockpass.ru/`

### Шаг 1 — Создать сайт в FastPanel

1. FastPanel → **Сайты → Создать сайт**.
2. Домен: `lockpass.ru` (и `www.lockpass.ru`).
3. PHP-версия: **8.3**.
4. Document root оставить по умолчанию или указать `public/`
   (зависит от версии FastPanel — проверить что nginx указывает в `public/`).
5. Включить **SSL (Let's Encrypt)** — FastPanel выпустит сертификат автоматически.

### Шаг 2 — Настроить document root

FastPanel должен указывать nginx в `public/` внутри директории проекта.
Если корень сайта создался как `/var/www/atryom/data/www/lockpass.ru/`,
то в настройках сайта указать document root:
```
/var/www/atryom/data/www/lockpass.ru/public
```

### Шаг 3 — Добавить custom nginx-конфиг

FastPanel позволяет добавить кастомные директивы в блок `server {}` через
раздел **«Дополнительные директивы nginx»** (или аналог в установленной версии).

Добавить:
```nginx
# Angular SPA — все несуществующие пути → index.html
location / {
    try_files $uri $uri/ /index.html;
}

# Laravel API
location /api {
    try_files $uri $uri/ /backend/index.php?$query_string;
}

location ~ \.php$ {
    fastcgi_pass unix:/run/php/php8.3-fpm.sock;
    fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
    include fastcgi_params;
}
```

> FastPanel может уже добавить обработку PHP — проверить что не задвоилось.

### public/backend/index.php

Этот файл **не генерируется** Angular-сборкой, хранится в git и является
единственной точкой входа Laravel:

```php
<?php
define('LARAVEL_START', microtime(true));
require __DIR__ . '/../../backend/vendor/autoload.php';
$app = require __DIR__ . '/../../backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$response = $kernel->handle(
    $request = Illuminate\Http\Request::capture()
)->send();
$kernel->terminate($request, $response);
```

---

## 21. Скрипт деплоя (`./deploy`)

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND="$ROOT/frontend"
PUBLIC="$ROOT/public"
BACKEND="$ROOT/backend"
DIST="$FRONTEND/dist/lockpass/browser"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✔${NC}  $*"; }
info() { echo -e "${YELLOW}▸${NC}  $*"; }
fail() { echo -e "${RED}✘${NC}  $*" >&2; exit 1; }

info "Backend: composer install..."
cd "$BACKEND"
composer install --no-interaction --prefer-dist --optimize-autoloader --quiet
ok "Composer done"

info "Backend: migrations..."
php artisan migrate --force --no-interaction
ok "Migrations done"

info "Backend: clearing caches..."
php artisan config:clear --quiet
php artisan route:clear  --quiet
php artisan view:clear   --quiet
php artisan cache:clear  --quiet
chmod -R 775 "$BACKEND/storage" "$BACKEND/bootstrap/cache"
ok "Caches cleared"

info "Frontend: npm ci..."
cd "$FRONTEND"
npm ci --silent --legacy-peer-deps
ok "npm ci done"

info "Frontend: bumping version..."
node scripts/bump-version.js
ok "Version bumped"

info "Frontend: building..."
export NODE_OPTIONS="--max-old-space-size=1024"
npm run build:prod
ok "Build done"

info "Deploying dist → public/..."
[ -d "$DIST" ] || fail "Build not found: $DIST"
find "$PUBLIC" -maxdepth 1 ! -name 'backend' ! -path "$PUBLIC" -exec rm -rf {} +
cp -r "$DIST/." "$PUBLIC/"
ok "Frontend deployed"

info "Restarting queue workers..."
# Supervisor не используется — workers запущены напрямую (atryom, --sleep=3 --tries=3 --max-time=3600).
# queue:restart сигнализирует воркерам завершить текущий job и перезапуститься,
# подхватив новый код. Воркеры должны быть запущены заранее вручную или через cron.
cd "$BACKEND"
php artisan queue:restart
ok "Queue restart signal sent"

echo ""
echo -e "${GREEN}  Deploy complete.${NC}"
```

---

## 22. GitHub Actions — автодеплой web

Файл: `.github/workflows/deploy.yml`

```yaml
name: Web Deploy (production)

on:
  push:
    branches: [master]
    paths:
      - 'backend/**'
      - 'frontend/**'

concurrency:
  group: web-deploy
  cancel-in-progress: false   # не прерывать — опасно во время migrate

jobs:
  deploy:
    name: Deploy web to production
    runs-on: [self-hosted, Linux]

    env:
      DEPLOY_PATH: ${{ vars.DEPLOY_PATH || '/var/www/atryom/data/www/lockpass.ru' }}
      REPO_URL: https://github.com/atryom/lockpass.ru.git
      GH_TOKEN: ${{ github.token }}

    steps:
      - name: Pull latest & deploy
        run: |
          set -euo pipefail
          cd "$DEPLOY_PATH"

          AUTH="AUTHORIZATION: basic $(printf 'x-access-token:%s' "$GH_TOKEN" | base64 | tr -d '\n')"
          git -c http."https://github.com/".extraheader="$AUTH" \
            fetch --prune "$REPO_URL" +refs/heads/master:refs/remotes/origin/master

          git checkout -f -B master origin/master
          echo "Now at: $(git log --oneline -1)"

          ./deploy
```

> Workflow не использует `actions/checkout` — работает в живой директории
> прода, обновляет именно тот каталог, который отдаёт nginx.

---

## 23. Настройка self-hosted runner (Linux, сервер 62.217.182.207)

Выполнить **один раз** под пользователем `atryom`.

### Шаг 1 — Убедиться что на сервере есть нужные инструменты
```bash
php --version    # 8.3+ — FastPanel управляет версиями
composer --version
node --version   # v24.15.0 ✓ (установлен)
npm --version
git --version
```

### Шаг 2 — Создать runner в GitHub
**Settings → Actions → Runners → New self-hosted runner → Linux / x64** →
скопировать команды download/config с сайта GitHub.

### Шаг 3 — Установить runner
```bash
mkdir -p ~/actions-runner && cd ~/actions-runner
# Вставить команды с сайта GitHub:
curl -o actions-runner.tar.gz -L https://github.com/actions/runner/releases/...
tar xzf actions-runner.tar.gz
./config.sh --url https://github.com/atryom/lockpass.ru --token <ТОКЕН>
```

### Шаг 4 — Запустить как сервис
```bash
sudo ./svc.sh install atryom
sudo ./svc.sh start
sudo ./svc.sh status   # → active (running)
```

### Шаг 5 — Разрешить git в директории прода
```bash
git config --global --add safe.directory /var/www/atryom/data/www/lockpass.ru
```

### Шаг 6 — Задать DEPLOY_PATH в GitHub
**Settings → Secrets and variables → Actions → Variables → New**:
- Name: `DEPLOY_PATH`
- Value: `/var/www/atryom/data/www/lockpass.ru`

### Первоначальная подготовка прода (один раз вручную)
```bash
cd /var/www/atryom/data/www/lockpass.ru
git init
git remote add origin https://github.com/atryom/lockpass.ru.git
git fetch origin master
git checkout -f -B master origin/master

cp backend/.env.example backend/.env
# Заполнить .env (см. раздел 26)
php artisan key:generate

# public/backend/ создаётся из репозитория (index.php в git)
# Убедиться что файл есть:
ls public/backend/index.php

./deploy   # первый деплой
```

> FastPanel мог создать пустую директорию `lockpass.ru/`. Если там уже есть
> файлы от FastPanel (index.html-заглушка и т.п.) — удалить их перед `git init`.

### Queue workers (запуск после первого деплоя)

Supervisor не используется — воркеры запускаются напрямую под пользователем `atryom`.
Redis доступен на `127.0.0.1:6379` (без пароля).

```bash
# Запустить 2 воркера в фоне (выполнить один раз после первого деплоя)
cd /var/www/atryom/data/www/lockpass.ru/backend
nohup php artisan queue:work redis --sleep=3 --tries=3 --max-time=3600 \
  >> storage/logs/queue-worker.log 2>&1 &
nohup php artisan queue:work redis --sleep=3 --tries=3 --max-time=3600 \
  >> storage/logs/queue-worker.log 2>&1 &
```

При последующих деплоях `./deploy` посылает `php artisan queue:restart` —
воркеры подхватывают новый код после завершения текущего job.

Проверить что воркеры живы:
```bash
ps aux | grep 'queue:work'
```

---

## 24. GitHub Actions — сборка iOS

Файл: `.github/workflows/ios-build.yml`

```yaml
name: iOS Build & Deploy

on:
  workflow_dispatch:
  push:
    branches: [master]
    paths:
      - 'mobile/**'
      - '.github/workflows/ios-build.yml'

concurrency:
  group: ios-build
  cancel-in-progress: true

jobs:
  ios:
    name: Build & Submit iOS
    runs-on: [self-hosted, macOS]

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        working-directory: mobile
        run: npm ci && npm install -g eas-cli

      - name: Unlock login keychain
        run: |
          security unlock-keychain -p "${{ secrets.MAC_KEYCHAIN_PASSWORD }}" \
            "$HOME/Library/Keychains/login.keychain-db"

      - name: Install Apple WWDR certificates
        run: |
          for CERT in AppleWWDRCAG4.cer AppleWWDRCAG5.cer AppleWWDRCAG6.cer; do
            curl -fsSL -o /tmp/$CERT "https://www.apple.com/certificateauthority/$CERT"
            security import /tmp/$CERT -k ~/Library/Keychains/login.keychain-db \
              2>&1 | grep -v "already exists" || true
            rm -f /tmp/$CERT
          done

      - name: Patch EAS keychain.js (macOS 14 fix)
        run: |
          find ~/.npm/_npx -name "keychain.js" -path "*/ios/credentials/keychain.js" \
            -exec sed -i '' "s/'find-identity', '-v', '-s'/'find-identity', '-s'/g" {} \;

      - name: Set iOS build number
        working-directory: mobile
        run: |
          python3 -c "
          import json
          with open('app.json') as f: cfg = json.load(f)
          cfg['expo'].setdefault('ios', {})['buildNumber'] = '${{ github.run_number }}'
          with open('app.json', 'w') as f: json.dump(cfg, f, indent=2)
          "

      - name: Build iOS (local)
        id: build
        working-directory: mobile
        run: |
          set -o pipefail
          touch /tmp/build-start-marker
          eas build --platform ios --profile production --local --non-interactive \
            2>&1 | tee /tmp/ios-build.log
          IPA=$(find . -name "*.ipa" -newer /tmp/build-start-marker | head -1)
          echo "ipa_path=${IPA}" >> "$GITHUB_OUTPUT"
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
          EAS_BUILD_NO_EXPO_GO_WARNING: true
          FL_IMPORT_CERTIFICATE_ALLOW_ANY_APP: 'true'

      - name: Submit to TestFlight
        if: success()
        working-directory: mobile
        run: |
          python3 -c "
          import base64, json, os
          raw = os.environ['ASC_API_KEY_P8_BASE64'].strip()
          pem = raw if raw.startswith('-----') else base64.b64decode(raw).decode()
          with open('/tmp/asc_api_key.p8', 'w') as f: f.write(pem)
          with open('eas.json') as f: cfg = json.load(f)
          ios = cfg['submit']['production']['ios']
          ios['ascApiKeyPath']     = '/tmp/asc_api_key.p8'
          ios['ascApiKeyId']       = os.environ['ASC_KEY_ID']
          ios['ascApiKeyIssuerId'] = os.environ['ASC_ISSUER_ID']
          with open('eas.json', 'w') as f: json.dump(cfg, f, indent=2)
          "
          eas submit --platform ios \
            --path "${{ steps.build.outputs.ipa_path }}" \
            --non-interactive
          rm -f /tmp/asc_api_key.p8
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
          ASC_API_KEY_P8_BASE64: ${{ secrets.ASC_API_KEY_P8_BASE64 }}
          ASC_KEY_ID: ${{ secrets.ASC_KEY_ID }}
          ASC_ISSUER_ID: ${{ secrets.ASC_ISSUER_ID }}

      - name: Upload build log to Delifile (testing)
        if: always()
        env:
          DELIFILE_TOKEN: ${{ secrets.DELIFILE_TOKEN }}
          DELIFILE_FOLDER_ID: ${{ secrets.LOCKPASS_BUILDS_FOLDER_ID }}
        run: |
          # Удобная доставка артефактов для тестирования.
          # Если DELIFILE_TOKEN не задан — шаг пропускается.
          [ -z "$DELIFILE_TOKEN" ] && echo "DELIFILE_TOKEN not set, skipping" && exit 0

          LOG=/tmp/ios-build.log
          [ -f "$LOG" ] || echo "(сборка не запускалась)" > "$LOG"

          TIMESTAMP=$(date +%Y%m%d-%H%M%S)
          LOG_SIZE=$(wc -c < "$LOG" | tr -d ' ')
          FILENAME="lockpass-ios-${{ job.status }}-${TIMESTAMP}.log"

          INIT=$(curl -sf -X POST "https://delifile.ru/api/v1/shared-folders/${DELIFILE_FOLDER_ID}/init-upload" \
            -H "Authorization: Bearer ${DELIFILE_TOKEN}" \
            -H "Content-Type: application/json" \
            -d "{\"original_name\": \"${FILENAME}\", \"size\": ${LOG_SIZE}, \"mime_type\": \"text/plain\"}")

          FILE_ID=$(echo "$INIT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['file']['id'])")
          UPLOAD_URL=$(echo "$INIT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['upload']['url'])")

          curl -sf -X PUT "$UPLOAD_URL" -H "Content-Type: text/plain" --data-binary @"$LOG"
          curl -sf -X POST "https://delifile.ru/api/v1/shared-folders/${DELIFILE_FOLDER_ID}/complete-upload" \
            -H "Authorization: Bearer ${DELIFILE_TOKEN}" \
            -H "Content-Type: application/json" \
            -d "{\"file_id\": \"${FILE_ID}\"}"

          echo "Лог загружен: ${FILENAME}"
```

---

## 25. Настройка Mac-раннера (iOS CI)

Выполнить **один раз** на MacBook.

```bash
# Xcode из App Store → принять лицензию
xcode-select --install

# Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
# Выполнить команды добавления в PATH, которые покажет установщик.

brew install node cocoapods watchman jq

npm install -g eas-cli
eas login   # email + пароль expo.dev
```

Проект на expo.dev уже создан:

```bash
# Инициализировать в готовой папке проекта:
npm install --global eas-cli && npx create-expo-app lockpass && cd lockpass && eas init --id 6a1b93f8-dd3d-4942-a664-276910840274
```

| Параметр | Значение |
|---------|---------|
| EAS Project ID | `6a1b93f8-dd3d-4942-a664-276910840274` |
| Slug | `lockpass` |
| Bundle ID (iOS) | `ru.lockpass.app` |
| Package (Android) | `ru.lockpass.app` |
| Apple Team ID | `6LBXV3GHST` |

GitHub → **Settings → Actions → Runners → New self-hosted runner → macOS / ARM64**:

```bash
mkdir actions-runner && cd actions-runner
# Вставить команды с сайта GitHub
./config.sh --url https://github.com/atryom/lockpass.ru --token <ТОКЕН>
sudo ./svc.sh install
sudo ./svc.sh start
```

Mac должен быть включён и разблокирован во время сборки.

---

## 26. Секреты GitHub

### Secrets
| Имя | Описание |
|-----|---------|
| `EXPO_TOKEN` | Создать на expo.dev/settings/access-tokens |
| `ASC_API_KEY_P8_BASE64` | App Store Connect API Key (.p8), base64 |
| `ASC_KEY_ID` | Key ID из App Store Connect |
| `ASC_ISSUER_ID` | Issuer ID из App Store Connect |
| `MAC_KEYCHAIN_PASSWORD` | Пароль login.keychain-db на Mac |
| `DELIFILE_TOKEN` | (опционально) Bearer-токен Delifile для загрузки артефактов |
| `LOCKPASS_BUILDS_FOLDER_ID` | (опционально) ID папки в Delifile для сборок |

### Variables
| Имя | Значение |
|-----|---------|
| `DEPLOY_PATH` | `/var/www/atryom/data/www/lockpass.ru` |

### Backend `.env` (в gitignore, на сервере)
```env
APP_NAME=LockPass
APP_ENV=production
APP_KEY=           # php artisan key:generate
APP_URL=https://lockpass.ru

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=lockpass
DB_USERNAME=lockpass
DB_PASSWORD=wd)x&=x[5,Nyi0zg

FIREBASE_PROJECT_ID=lockpass-a3559
FIREBASE_CLIENT_EMAIL=   # из Service Account JSON (раздел 34)
FIREBASE_PRIVATE_KEY=    # из Service Account JSON (раздел 34)

QUEUE_CONNECTION=redis
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379
```

---

## 27. Android — сборка и публикация

```bash
cd mobile
npm ci
eas build --platform android --profile production --local
```

Переименовать APK: `lockpass_<version>.apk`

Загрузить в папку сборок в Delifile (для тестирования), затем в Google Play.

---

## 28. bump-version.js

```js
#!/usr/bin/env node
const fs   = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '../package.json');
const pkg     = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const parts   = pkg.version.split('.').map(Number);
parts[2]++;
pkg.version = parts.join('.');
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

const envFiles = [
  '../src/environments/environment.ts',
  '../src/environments/environment.production.ts',
].map(f => path.join(__dirname, f));

for (const f of envFiles) {
  if (!fs.existsSync(f)) continue;
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(/version:\s*'[^']+'/, `version: '${pkg.version}'`);
  fs.writeFileSync(f, c);
}
console.log(`version → ${pkg.version}`);
```

---

## 29. Схема CI/CD потока

```
Windows / WSL (разработка)
    └─ git push master → GitHub
                              │
                              ├─ backend/** или frontend/**
                              │       └─ GitHub Actions: Web Deploy
                              │              └─ self-hosted Linux
                              │                 (62.217.182.207, пользователь atryom)
                              │                      ├─ git fetch + checkout
                              │                      ├─ composer install + migrate
                              │                      ├─ npm ci + bump-version + build:prod
                              │                      └─ cp dist → public/ (nginx FastPanel)
                              │
                              └─ mobile/**
                                      └─ GitHub Actions: iOS Build & Deploy
                                             └─ self-hosted macOS (MacBook)
                                                     ├─ npm ci
                                                     ├─ eas build --local  (~15–30 мин)
                                                     ├─ eas submit          → TestFlight
                                                     └─ лог → Delifile (если DELIFILE_TOKEN задан)
```

---

## 30. Rate limiting

```php
// routes/api.php
Route::middleware(['auth:sanctum', 'throttle:session-create'])->group(function () {
    Route::post('/2fa/session/create', ...);
});

// RouteServiceProvider
RateLimiter::for('session-create', function (Request $request) {
    return Limit::perMinute(10)->by($request->user()?->id ?: $request->ip());
});
```

| Endpoint | Лимит |
|---------|-------|
| `session/create` | 10 req/min на пользователя |
| `session/verify-code` | 5 попыток на сессию |
| `auth/login` | 10 req/min на IP |

---

## 31. TOTP — параметры

| Параметр | Значение |
|---------|---------|
| Алгоритм | HMAC-SHA1 (RFC 6238, совместимо с Google Authenticator) |
| Период | 30 секунд |
| Цифр | 6 |
| Формат QR привязки | `otpauth://totp/LockPass:<email>?secret=<BASE32>&issuer=LockPass` |
| Хранение секрета | BASE32, зашифрован `encrypt()` Laravel в `devices.totp_secret` |
| Допуск по времени | ±1 период (окно 90 сек) |

Laravel-пакет: `pragmarx/google2fa-laravel` или `robthree/twofactorauth`.

---

## 32. API JSON-схемы

### POST /api/auth/login
```json
// Request
{ "email": "user@example.com", "password": "secret" }

// Response 200
{ "token": "1|abc123...", "user": { "id": 1, "name": "...", "email": "..." } }
```

### POST /api/2fa/session/create
```json
// Request (Bearer токен сервисного аккаунта клиентского приложения)
{ "user_id": 42, "client_app": "delifile" }

// Response 201
{
  "session_id": "uuid-...",
  "qr_payload": "lockpass://session/uuid-...",
  "expires_at": "2026-06-11T12:05:00Z",
  "status": "pending"
}
```

### GET /api/2fa/sessions/{id}
```json
// Response 200
{
  "session_id": "uuid-...",
  "status": "pending",
  "expires_at": "2026-06-11T12:05:00Z"
}
```

### POST /api/2fa/session/approve
```json
// Request (Bearer токен пользователя, из мобильного приложения)
{ "session_id": "uuid-..." }

// Response 200
{ "message": "approved" }
```

### POST /api/2fa/session/verify-code
```json
// Request
{ "session_id": "uuid-...", "code": "123456" }

// Response 200
{ "message": "approved" }

// Response 422
{ "message": "Invalid code", "attempts_left": 3 }
```

### POST /api/2fa/device/link
```json
// Request
{
  "device_uuid": "550e8400-e29b-41d4-a716-446655440000",
  "device_name": "My iPhone 15",
  "platform": "ios",
  "app_version": "1.0.0",
  "fcm_token": "fXM..."
}

// Response 201
{
  "device_id": 7,
  "status": "active",
  "recovery_codes": ["abc1-def2", "ghi3-jkl4", "..."]
}
```

---

## 33. Mobile Auth Flow

### Первый запуск
1. Экран регистрации: email + password → `POST /api/auth/register`.
2. Получить Bearer-токен → сохранить в `SecureStore`.
3. Запросить разрешение на push (`Notifications.requestPermissionsAsync()`).
4. Получить FCM/APNs токен → `POST /api/2fa/device/link`.
5. Показать резервные коды → пользователь сохраняет.

### Повторный запуск
1. Прочитать токен из `SecureStore`.
2. Если токен есть — перейти на главный экран.
3. Если нет — показать экран входа.

### Обновление FCM-токена
```ts
Notifications.addPushTokenListener(async ({ data: newToken }) => {
  await api.post('/api/2fa/device/update-token', {
    device_uuid: await SecureStore.getItemAsync('device_uuid'),
    fcm_token: newToken,
  });
});
```

---

## 34. Firebase Project Setup

### Статус

| Параметр | Значение | Статус |
|---------|---------|--------|
| Project name | `lockpass` | ✓ создан |
| Project ID | `lockpass-a3559` | ✓ |
| Project number | `91288666319` | ✓ |
| Android app (`ru.lockpass.app`) + `google-services.json` | в `mobile/` | ✓ |
| iOS app (`ru.lockpass.app`) + `GoogleService-Info.plist` | в `mobile/` | ✓ |
| Service Account JSON | `mobile/lockpass-a3559-firebase-adminsdk-fbsvc-1f01a3c6f0.json` | ✓ |
| APNs Authentication Key | — | ⬜ сделать |

### Извлечь credentials из Service Account JSON для `.env`

Открыть `mobile/lockpass-a3559-firebase-adminsdk-fbsvc-1f01a3c6f0.json`,
взять три поля:

```json
{
  "project_id": "lockpass-a3559",        → FIREBASE_PROJECT_ID
  "client_email": "firebase-adminsdk-...",→ FIREBASE_CLIENT_EMAIL
  "private_key": "-----BEGIN RSA..."     → FIREBASE_PRIVATE_KEY
}
```

Вставить в `.env` на сервере. `private_key` содержит переносы строк — в `.env`
они должны быть как `\n`, либо обернуть значение в двойные кавычки:

```env
FIREBASE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----\n"
```

> Файл JSON с ключом **не коммитить** в репозиторий. Добавить в `.gitignore`:
> `mobile/lockpass-a3559-firebase-adminsdk-*.json`

### APNs Authentication Key — пошагово

> **Важно:** APNs ключ (для push-уведомлений через Firebase) — это **не то же самое**,
> что App Store Connect API Key (для публикации в TestFlight). Это разные ключи.

**Шаг 1 — Зарегистрировать App ID (если ещё не сделано)**

Без App ID ключ создать не получится — он нужен на шаге конфигурации APNs.

1. [developer.apple.com](https://developer.apple.com) → **Certificates, Identifiers & Profiles → Identifiers → «+»**.
2. Выбрать **App IDs → App → Continue**.
3. Bundle ID: `ru.lockpass.app` (Explicit).
4. В списке Capabilities включить **Push Notifications**.
5. Нажать **Continue → Register**.

**Шаг 2 — Создать APNs ключ**

1. Слева: **Keys → «+»**.
2. Имя ключа: `LockPass APNs`.
3. Поставить галочку напротив **Apple Push Notifications service (APNs)**.
4. Нажать **Configure** рядом с галочкой — кнопка **Continue** не активируется
   пока не пройти этот шаг.
5. В открывшейся панели выбрать App ID: **ru.lockpass.app** → **Save**.
6. Нажать **Continue → Register**.
7. На следующем экране записать **Key ID** (например `AB12CD34EF`).
8. Нажать **Download** — скачается `AuthKey_AB12CD34EF.p8`.
   **Скачать можно только один раз.**

**Шаг 2 — Загрузить ключ в Firebase**

1. Открыть [console.firebase.google.com](https://console.firebase.google.com) → проект `lockpass`.
2. Шестерёнка → **Project Settings → вкладка Cloud Messaging**.
3. Прокрутить до раздела **Apple app configuration** → найти приложение `ru.lockpass.app`.
4. Нажать **Upload APNs Auth Key**.
5. Выбрать скачанный файл `.p8`.
6. В поле **Key ID** ввести Key ID из шага 1 (например `AB12CD34EF`).
7. В поле **Team ID** ввести `6LBXV3GHST`.
8. Нажать **Upload**.

После этого Firebase умеет отправлять push на iOS-устройства через APNs.

---

## 35. Apple Developer Portal Setup

1. [developer.apple.com](https://developer.apple.com) → **Identifiers → Register App ID**:
   - Bundle ID: `ru.lockpass.app`.
   - Team ID: `6LBXV3GHST`.
   - Capabilities: **Push Notifications**, **Keychain Sharing**.

2. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → My Apps → **+ New App**:
   - Bundle ID: `ru.lockpass.app`, SKU: `lockpass`.

3. **API Key для EAS submit**:
   - App Store Connect → Users and Access → **Integrations → App Store Connect API**.
   - Generate API Key → роль **Developer**.
   - Скачать `.p8` (хранить — скачивается один раз).
   - Закодировать: `base64 -w 0 AuthKey_XXXXXXXX.p8`
   - GitHub Secrets: `ASC_API_KEY_P8_BASE64`, `ASC_KEY_ID`, `ASC_ISSUER_ID`.

4. Distribution Certificate и Provisioning Profile создаёт EAS автоматически
   при первом `eas build --platform ios --profile production` (интерактивно,
   локально, не в CI).

---

## 36. Локальная разработка (WSL / Ubuntu)

Разработка ведётся в WSL на Windows. Код редактируется в VS Code через
расширение Remote — WSL. После `git push` деплой происходит автоматически
на сервере 62.217.182.207 — ничего дополнительно делать не нужно.

Требования в WSL: `php 8.3+, composer, node 20+, npm, git`

### Backend
```bash
cd backend
composer install
cp .env.example .env
# DB_CONNECTION=sqlite, DB_DATABASE=/abs/path/dev.sqlite
php artisan key:generate
php artisan migrate
php artisan serve   # → http://127.0.0.1:8000
```

### Frontend
```bash
cd frontend
npm install --legacy-peer-deps
# В environment.ts: apiUrl = 'http://127.0.0.1:8000'
npm start   # → http://localhost:4200
```

### Mobile
```bash
cd mobile
npm install
npx expo start
# Сканировать QR → Expo Go на телефоне
```

> Push-уведомления не работают в Expo Go. Для тестирования push:
> `eas build --platform android --profile development --local`

---

## 37. Стратегия тестирования

| Слой | Инструмент | Что тестировать |
|------|-----------|----------------|
| Backend | PHPUnit (`php artisan test`) | Сервисы TOTP, переходы статусов, все API-эндпоинты (SQLite in-memory) |
| Frontend | Jest + Angular Testing Library | 2FA-компонент, polling, форма привязки |
| Mobile E2E | Maestro | Привязка устройства, подтверждение входа, отклонение |

CI-шаг перед деплоем в `deploy.yml`:
```yaml
- name: Run backend tests
  run: cd backend && php artisan test --parallel
```

---

## 38. iOS Background Push — детали

| Состояние | Поведение | Действие |
|-----------|----------|---------|
| Foreground | `onNotificationReceived` мгновенно | Показать in-app экран подтверждения |
| Background | delivery через `content-available: 1` | Обновить бейдж; при тапе → открыть экран |
| Killed | Только notification tap | При запуске проверить `getLastNotificationResponseAsync` |

### Push payload (FCM V1)
```json
{
  "notification": { "title": "LockPass", "body": "Запрос на вход" },
  "data": { "session_id": "uuid-...", "type": "2fa_request" },
  "apns": { "payload": { "aps": { "content-available": 1 } } }
}
```

### Обработка в Expo
```ts
// При запуске — killed state
const last = await Notifications.getLastNotificationResponseAsync();
if (last?.notification.request.content.data?.type === '2fa_request') {
  router.replace(`/confirm/${last.notification.request.content.data.session_id}`);
}

// Foreground / background tap
Notifications.addNotificationResponseReceivedListener(({ notification }) => {
  const { type, session_id } = notification.request.content.data ?? {};
  if (type === '2fa_request') router.push(`/confirm/${session_id}`);
});
```

---

## 39. Мониторинг

- **Sentry:** `composer require sentry/sentry-laravel` + `npm install @sentry/angular`.
  Добавить `SENTRY_LARAVEL_DSN` в `.env`.
- **Health check:** `GET /api/health` → `{ "status": "ok", "db": "ok", "queue": "ok" }`.
- **Лог-ротация:** `backend/config/logging.php`, channel `daily`, `days: 14`.
- **Uptime:** UptimeRobot → пинговать `https://lockpass.ru/api/health` каждые 5 мин.

---

## 40. Диагностика типичных проблем

| Проблема | Причина | Решение |
|---------|---------|---------|
| Джоб не стартует | Runner offline | Settings → Actions → Runners → проверить Idle |
| `dubious ownership` | git не доверяет директории | `git config --global --add safe.directory <path>` |
| `composer: not found` | Нет в PATH раннера | `sudo -u atryom bash -lc 'which composer'` |
| PHP-версия не та | FastPanel держит несколько | Указать путь явно: `/usr/bin/php8.3` |
| `eas submit` зависает | Нет ASC API Key | Проверить секреты `ASC_*` |
| iOS keychain error | Keychain заблокирован | Убедиться что `security unlock-keychain` выполняется |
| Angular OOM при сборке | Мало RAM | `NODE_OPTIONS=--max-old-space-size=1024` |
| Push не приходит | fcm_token устарел | Проверить `device/update-token` логику |
| Push не приходит | Воркеры не запущены | `ps aux \| grep queue:work` — если пусто, запустить вручную |
| Push не приходит | Redis недоступен | `redis-cli ping` → должно вернуть `PONG` |
| Push на iOS killed | `content-available` не выставлен | Добавить в APNs payload |
| Polling 401 | CORS или Sanctum | Проверить `sanctum.stateful` и CORS middleware |

---

## 41. Правила разработки из опыта Delifile

Этот раздел фиксирует практики, выработанные на проекте Delifile и напрямую применимые к LockPass. Следовать им с первого дня, чтобы не наступать на те же грабли.

---

### 41.1. Деплой только через `./deploy`

Production-сборка **всегда** запускается командой `./deploy` из корня проекта. Никогда не запускать `npm run build:prod` напрямую на сервере.

`./deploy` автоматически поднимает patch-версию через `scripts/bump-version.js`. Ручное изменение версии не нужно — оно произойдёт само.

---

### 41.2. Android APK — только локальная сборка

Сборку APK запускать **только с флагом `--local`**:

```bash
cd mobile
eas build --local --platform android --profile preview
```

Облачный `eas build` (без `--local`) **не запускать** — он тратит платные минуты EAS и медленнее.

После успешной сборки:
1. Переименовать артефакт: `lockpass_<версия>.apk` (например, `lockpass_1.0.5.apk`).
2. Загрузить в shared folder на delifile.ru для удобства тестирования.

---

### 41.3. Мобильные формы ввода — бар над клавиатурой, не Modal

Все формы создания/редактирования в мобильном приложении реализовывать как **абсолютно позиционированный бар над клавиатурой**. `Modal` на Android не использовать — клавиатура открывается поверх Modal и перекрывает поля ввода.

```tsx
const [editMode, setEditMode] = useState(false);
const [kbHeight, setKbHeight] = useState(0);
const inputRef = useRef<TextInput>(null);

useEffect(() => {
  const show = Keyboard.addListener('keyboardDidShow', (e) =>
    setKbHeight(e.endCoordinates.height));
  const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
  return () => { show.remove(); hide.remove(); };
}, []);

// JSX:
{editMode && (
  <View style={[styles.inputBar, { bottom: kbHeight }]}>
    <TextInput ref={inputRef} autoFocus ... />
  </View>
)}
```

```ts
inputBar: {
  position: 'absolute', left: 0, right: 0,
  backgroundColor: '#fff',
  paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
  borderTopWidth: 1, borderTopColor: '#E2E8F0',
  elevation: 8,
}
```

> **Важно:** использовать `keyboardDidShow`, не `keyboardWillShow` — последний не работает на Android.

---

### 41.4. iOS — не трогать `ios/` напрямую

Каталог `mobile/ios/` должен быть в `.gitignore`. Всё нативное для iOS писать только через **Expo плагины** в `mobile/plugins/`. При `git push` в `master` GitHub Actions на MacBook запустит `eas build --local` который сам сгенерирует `ios/` из плагинов.

Прямые правки в `mobile/ios/` будут потеряны при следующей пересборке.

---

### 41.5. Не проверять через API до деплоя

Разработка ведётся локально в `/var/www/lockpass` (WSL). API на `lockpass.ru` — это **прод**. Правка кода и деплой — разные события.

После любого изменения backend-кода: сначала задеплоить (`./deploy` или push → runner), дождаться подтверждения деплоя, и только потом проверять через API.

---

### 41.6. Queue workers — без Supervisor

Supervisor на сервере не используется. Воркеры запускаются напрямую через `nohup`:

```bash
nohup php artisan queue:work --sleep=3 --tries=3 --max-time=3600 >> storage/logs/worker.log 2>&1 &
```

`./deploy` выполняет `php artisan queue:restart` — это сигнал воркерам завершить текущий job и перезапуститься с новым кодом. Если воркеры не запущены, `queue:restart` не принесёт эффекта — запустить вручную или добавить в `crontab`:

```
@reboot cd /var/www/atryom/data/www/lockpass.ru && nohup php artisan queue:work --sleep=3 --tries=3 --max-time=3600 >> backend/storage/logs/worker.log 2>&1 &
```

---

### 41.7. Polling вместо SSE

Статус 2FA-сессии на веб-странице обновляется через **polling каждые 2 секунды** (не SSE). Причина: FastPanel управляет nginx, и настройка `proxy_buffering off` через панель неудобна. SSE требует отключения буферизации, иначе события задерживаются или теряются.

```ts
// Angular — polling пример
interval(2000).pipe(
  switchMap(() => this.sessionService.getStatus(sessionId)),
  takeUntil(this.destroy$)
).subscribe(status => this.handleStatus(status));
```
| FastPanel перезаписал nginx | Панель обновила конфиг | Восстановить custom-директивы через UI панели |
