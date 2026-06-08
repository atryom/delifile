# Автодеплой web на прод через GitHub Actions

Цель: каждый `git push` в `master` с изменениями в `backend/` или `frontend/`
автоматически деплоит web на прод (`delifile.ru`).

Деплой выполняется **на самом прод-сервере** через self-hosted runner (так же,
как iOS-сборка на Mac). Workflow обновляет живой каталог `/var/www/atryom/data/www/delifile.ru`
(его отдаёт nginx) командой `git reset --hard origin/master` и запускает `./deploy`.

- Workflow: `.github/workflows/deploy.yml`
- Скрипт деплоя: `./deploy` (composer install → `migrate --force` → clear caches →
  `npm ci` → bump version → `build:prod` → копирование `dist → public/`,
  сохраняя `public/backend/`)

> **Эта инструкция выполняется один раз на прод-сервере.**

---

## Предусловия (должны быть на проде)

- Репозиторий уже склонирован в `/var/www/atryom/data/www/delifile.ru`, ветка `master`, `git remote`
  указывает на `https://github.com/atryom/delifile.git`.
- Установлены и доступны в `PATH`: `git`, `php`, `composer`, `node`, `npm`
  (теми же версиями, что использует `./deploy`).
- Пользователь, под которым работает runner, **владеет** `/var/www/atryom/data/www/delifile.ru`
  и может писать в `public/` (либо nginx читает из каталога, доступного этому
  пользователю). Проверка: `sudo -u <runner-user> touch /var/www/atryom/data/www/delifile.ru/public/.wtest && rm /var/www/atryom/data/www/delifile.ru/public/.wtest`
- `backend/.env`, `backend/storage/`, `public/backend/` уже настроены и лежат на
  месте. Они в `.gitignore`, поэтому `git reset --hard` их **не трогает**.

---

## Шаг 1 — Создать self-hosted runner в GitHub

1. GitHub → репозиторий `atryom/delifile` → **Settings** → **Actions** →
   **Runners** → **New self-hosted runner**.
2. Выбрать **Linux**, архитектуру (обычно **x64**).
3. GitHub покажет готовые команды `download` и `config` с токеном. Их выполнить
   на проде в Шаге 2.

---

## Шаг 2 — Установить runner на прод-сервере

Под пользователем, который владеет `/var/www/atryom/data/www/delifile.ru` (НЕ root):

```bash
# Каталог для раннера (любой, например в домашней папке пользователя)
mkdir -p ~/actions-runner && cd ~/actions-runner

# Команды download/config берём из GitHub (Шаг 1). Пример:
curl -o actions-runner.tar.gz -L https://github.com/actions/runner/releases/download/<версия>/actions-runner-linux-x64-<версия>.tar.gz
tar xzf actions-runner.tar.gz

# Конфигурация. ВАЖНО: добавить метку linux-deploy (имя — на ваш выбор),
# а также убедиться что есть стандартная метка Linux.
./config.sh --url https://github.com/atryom/delifile --token <ТОКЕН_ИЗ_GITHUB> --labels linux-deploy
```

> Метки `self-hosted`, `Linux`, `X64` добавляются автоматически. Workflow web-деплоя
> требует `[self-hosted, Linux]` — этого достаточно. Доп. метку можно не указывать.

---

## Шаг 3 — Запустить runner как сервис (автозапуск)

```bash
cd ~/actions-runner
sudo ./svc.sh install <runner-user>   # <runner-user> — владелец /var/www/atryom/data/www/delifile.ru
sudo ./svc.sh start
sudo ./svc.sh status                  # должно быть active (running)
```

После этого runner стартует сам при перезагрузке сервера.

---

## Шаг 4 — Разрешить git работать в каталоге прода

Если runner-пользователь и владелец каталога различаются, git ругнётся на
«dubious ownership». Разрешить:

```bash
git config --global --add safe.directory /var/www/atryom/data/www/delifile.ru
```

(выполнить под тем же пользователем, под которым работает runner)

---

## Шаг 5 — (опционально) Свой путь деплоя

Если прод лежит не в `/var/www/atryom/data/www/delifile.ru`, задать переменную репозитория:

GitHub → **Settings** → **Secrets and variables** → **Actions** → вкладка
**Variables** → **New repository variable**:

- Name: `DEPLOY_PATH`
- Value: `/полный/путь/к/каталогу`

Без неё используется `/var/www/atryom/data/www/delifile.ru`.

---

## Шаг 6 — Проверка

1. Сделать любой коммит с изменением в `frontend/` или `backend/` и запушить в `master`.
2. GitHub → **Actions** → workflow **Web Deploy (production)** → должен запуститься
   джоб **Deploy web to production**.
3. В логе джоба видно `git reset --hard`, текущий коммит и вывод `./deploy`.
4. Открыть `https://delifile.ru` — изменения на месте.

---

## Как это работает / важные детали

- **Триггер:** push в `master` + изменения в `backend/**` или `frontend/**`.
  Пуши только в `mobile/`/`docs/` web-деплой не запускают.
- **Деплой на месте:** workflow намеренно НЕ использует `actions/checkout`
  (тот кладёт копию в `_work`). Вместо этого `cd /var/www/atryom/data/www/delifile.ru`,
  `git reset --hard origin/master`, `./deploy` — обновляется живой каталог.
- **Миграции:** `./deploy` выполняет `php artisan migrate --force` на каждом
  деплое — миграции применяются автоматически.
- **Версия:** `bump-version.js` правит `package.json`/`environment*.ts`, но НЕ
  коммитит — петли деплоя нет. На следующем деплое `git reset --hard` сбрасывает
  эти правки (поэтому версия в UI = версия из репозитория +1; чтобы реально
  инкрементить — коммитить bump вручную, но для автодеплоя это не требуется).
- **Параллельные деплои:** `concurrency: web-deploy`, `cancel-in-progress: false`
  — деплои не пересекаются, новый ждёт завершения текущего (безопасно для миграций).
- **Метки раннеров:** web-деплой требует `[self-hosted, Linux]`, iOS-сборка —
  `[self-hosted, macOS]`. Это разводит их по серверам (прод-Linux vs MacBook),
  чтобы джобы не попадали на чужой runner.

---

## Диагностика

- **Джоб не стартует:** проверить, что runner в статусе **Idle/Active** в
  Settings → Actions → Runners; что менялись именно `backend/`/`frontend/`.
- **`dubious ownership` / git ошибки:** выполнить Шаг 4 под runner-пользователем.
- **Нет прав на `public/`:** runner-пользователь должен владеть `/var/www/atryom/data/www/delifile.ru`.
- **`composer`/`npm`/`php` не найдены:** они должны быть в `PATH` пользователя
  раннера (проверить `sudo -u <runner-user> bash -lc 'which php composer node npm'`).
- **Деплой упал на середине:** `concurrency` не прерывает текущий джоб; смотреть
  лог конкретного шага `./deploy` в Actions.
