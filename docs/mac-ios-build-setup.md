# Настройка Mac для автоматической сборки iOS

Эта инструкция выполняется **один раз** на MacBook.
После этого каждый `git push` будет автоматически собирать приложение и публиковать в TestFlight.

---

## Шаг 1 — Xcode

1. Открыть **App Store** на Mac
2. Найти **Xcode** и нажать **Установить** (≈15 ГБ, займёт время)
3. После установки — открыть Xcode, принять лицензионное соглашение и закрыть

> Без принятия лицензии сборка не запустится.

---

## Шаг 2 — Инструменты командной строки

Открыть **Terminal** (Finder → Программы → Утилиты → Terminal) и выполнить:

```bash
xcode-select --install
```

Появится окно — нажать **Установить**. Дождаться завершения.

---

## Шаг 3 — Homebrew (менеджер пакетов)

В том же Terminal:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Установка занимает несколько минут. В процессе может попросить пароль от Mac — вводить его нормально, символы не отображаются.

После установки Terminal попросит выполнить ещё 2 команды для добавления Homebrew в PATH — **выполнить их обязательно**. Они будут показаны прямо в терминале, выглядят примерно так:

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

Проверка что всё работает:

```bash
brew --version
```

Должно вывести версию, например: `Homebrew 4.x.x`

---

## Шаг 4 — Node.js, CocoaPods, дополнительные инструменты

```bash
brew install node cocoapods watchman jq
```

Проверка:

```bash
node --version
pod --version
```

---

## Шаг 5 — EAS CLI и вход в аккаунт

```bash
npm install -g eas-cli
```

Войти в Expo-аккаунт:

```bash
eas login
```

Введёт email и пароль от аккаунта на expo.dev.

---

## Шаг 6 — Регистрация Mac как сборщика в GitHub

### 6.1. Создать runner на GitHub

1. Открыть репозиторий на **github.com**
2. Перейти: **Settings → Actions → Runners**
3. Нажать **New self-hosted runner**
4. Выбрать: **macOS** → **ARM64** (для Apple Silicon) или **X64** (для Intel Mac)

GitHub покажет три блока команд — выполнить их по очереди в Terminal.

### 6.2. Блок 1 — Скачать runner

Команды выглядят примерно так (копировать точно с сайта GitHub, не отсюда):

```bash
mkdir actions-runner && cd actions-runner
curl -o actions-runner-osx-arm64-2.x.x.tar.gz -L https://github.com/...
tar xzf ./actions-runner-osx-arm64-2.x.x.tar.gz
```

### 6.3. Блок 2 — Настроить runner

```bash
./config.sh --url https://github.com/ВАШ_ЛОГИН/ВАШ_РЕПОЗИТОРИЙ --token ТОКЕН_С_САЙТА
```

На вопросы можно нажимать Enter (принять значения по умолчанию).

### 6.4. Блок 3 — Запустить как постоянный сервис

Вместо `./run.sh` из инструкции GitHub выполнить эти команды — тогда runner будет запускаться автоматически даже после перезагрузки Mac:

```bash
sudo ./svc.sh install
sudo ./svc.sh start
```

Проверка что runner запущен:

```bash
sudo ./svc.sh status
```

Должно показать `Active: active (running)`.

---

## Шаг 7 — Добавить секреты в GitHub

Перейти: репозиторий на github.com → **Settings → Secrets and variables → Actions → New repository secret**

Добавить два секрета:

| Имя | Значение |
|-----|---------|
| `EXPO_TOKEN` | Создать на [expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens) — кнопка **Create token** |
| `DELIFILE_TOKEN` | Bearer-токен от аккаунта Delifile |

---

## Проверка — первый тестовый запуск

После всех шагов сделать любое изменение в папке `mobile/` на рабочем компьютере и запушить в `master`.

На GitHub перейти: **Actions** — там появится запущенный workflow **iOS Build & Deploy**.

Первая сборка самая долгая (20–40 минут) — CocoaPods скачивает зависимости.
Последующие — 10–15 минут благодаря кешированию.

---

## Что делать если что-то пошло не так

- **Лог сборки** автоматически появится в Delifile с именем `ios-build-failure-ДАТА.log`
- **Лог в GitHub**: Actions → выбрать запуск → раскрыть нужный шаг
- Mac должен быть **включён и разблокирован** в момент сборки (экран может быть закрыт)

---

## Итоговая схема после настройки

```
git push (Windows/WSL)
    └─ GitHub Actions
         └─ Mac (self-hosted runner)
              ├─ npm ci
              ├─ eas build --local   (~15–30 мин)
              ├─ eas submit          → TestFlight
              └─ лог                 → Delifile
                                          ↓
                                   iPhone: уведомление
                                   в приложении TestFlight
                                   → нажать "Установить"
```
