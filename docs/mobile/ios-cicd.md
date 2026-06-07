# iOS CI/CD — устройство и эксплуатация

## Как работает автоматический деплой

```
git push → GitHub Actions → Mac self-hosted runner
  → eas build --local (~20 мин)
  → eas submit → Apple TestFlight
  → лог загружается в Delifile / iOS Build Logs
```

Запускается автоматически при push в `master` **только если изменены файлы в `mobile/`** (настроено через `paths: - 'mobile/**'` в workflow).

---

## Инфраструктура

| Компонент | Где |
|---|---|
| Runner | MacBook Pro Alina (`alinabel@MacBook-Pro-Alina`) |
| Runner процесс | LaunchAgent: `~/Library/LaunchAgents/actions.runner.atryom-delifile.MacBook-Pro-Alina.plist` |
| Workflow файл | `.github/workflows/ios-build.yml` |
| Логи сборок | Delifile → папка «iOS Build Logs» (shared_folder_id: `01kthtznmcakp23njmbv9vabw5`) |

---

## GitHub Secrets

Настраиваются в GitHub → репозиторий → Settings → Secrets and variables → Actions.

| Secret | Что это |
|---|---|
| `EXPO_TOKEN` | Токен Expo аккаунта `atryom` — для `eas build` и `eas submit` |
| `DELIFILE_TOKEN` | Bearer токен пользователя delifile.ru — для загрузки логов |
| `MAC_KEYCHAIN_PASSWORD` | Пароль от login keychain на Mac (нужен для разблокировки перед сборкой) |

---

## Apple credentials

| Что | Значение |
|---|---|
| Apple Team ID | `6LBXV3GHST` |
| Bundle ID (приложение) | `com.delifile.app` |
| Bundle ID (ShareExtension) | `com.delifile.app.ShareExtension` |
| App Store Connect App ID | `6776556322` |
| Distribution Certificate | `CF44B0E418267FB9C8163913EE38BFD74299B32A` |
| App Store Connect API Key | `24HF4XV68L` — «[Expo] EAS Submit 5rHUiB5z-6», хранится на EAS серверах |

Distribution certificate и provisioning profiles хранятся в EAS (credentialsSource: remote). App Store Connect API Key настроен один раз интерактивно через `eas submit` и с тех пор используется автоматически.

---

## Build number

Каждый CI прогон получает уникальный `CFBundleVersion = github.run_number`. Шаг «Set iOS build number» записывает это значение в `app.json` перед сборкой (изменение не коммитится). В `eas.json` установлено `"appVersionSource": "local"` — EAS читает build number из `app.json`, а не из удалённого счётчика (remote-режим не работает с `eas build --local`).

---

## Нестандартные решения (важно знать)

### Патч keychain.js

**Проблема:** macOS 14 не возвращает идентити при `security find-identity -v` в контексте GitHub Actions runner — EAS считает, что сертификат не импортирован, и падает.

**Решение:** Workflow патчит все копии `keychain.js` в `~/.npm/_npx/` перед каждой сборкой, убирая флаг `-v` из вызова `find-identity`. Шаг «Patch EAS keychain.js для macOS 14» в workflow.

Если EAS обновится и кэш сбросится — патч применится заново автоматически. Если патч перестанет находить файлы (строка «Patched 0 file(s)»), нужно запустить сборку вручную, чтобы npm скачал новый кэш, а потом проверить путь к `keychain.js`.

### ShareExtension версия

**Проблема:** EAS обновляет `CFBundleShortVersionString` в `ios/DeliFile/Info.plist`, но не в `ios/ShareExtension/Info.plist`. App Store отклоняет сборку если версии не совпадают.

**Решение:** Плагин `mobile/plugins/withShareExtension.js` вызывает `patchInfoPlistVersion()` внутри `withXcodeProject`-колбека сразу после копирования `Info.plist` из шаблона. Отдельный `withDangerousMod` не работает — он выполняется в LIFO порядке до `withXcodeProject`, то есть раньше, чем файл создаётся.

---

## Управление runner'ом на Mac

```bash
# Проверить статус
launchctl list | grep actions.runner

# Перезапустить
launchctl stop  com.github.actions.runner.atryom-delifile.MacBook-Pro-Alina
launchctl start com.github.actions.runner.atryom-delifile.MacBook-Pro-Alina

# Посмотреть логи runner'а
cat ~/actions-runner/_diag/Runner_*.log | tail -50
```

Runner запускается автоматически при входе пользователя `alinabel` в систему (LaunchAgent, `LimitLoadToSessionType: Aqua`). Если Mac перезагрузился — достаточно войти в учётку, runner стартует сам.

---

## Добавить тестировщика в TestFlight

### Шаг 1 — добавить в команду App Store Connect

1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **Users and Access**
2. Вкладка **People** → кнопка **+**
3. Заполнить: имя, email (Apple ID тестировщика), роль **Developer**
4. Нажать **Invite** — придёт письмо

### Шаг 2 — добавить как тестировщика

После принятия приглашения:

1. TestFlight → **Internal Testing**
2. Рядом с «Testers» нажать **+** → выбрать пользователя
3. Тестировщик получит письмо → **View in TestFlight** → Install

### Что нужно тестировщику

- iPhone с приложением **TestFlight** (App Store, бесплатно)
- Apple ID (не обязательно привязанный к iPhone)

---

## Структура файлов CI/CD

```
.github/
  workflows/
    ios-build.yml          # основной workflow

mobile/
  eas.json                 # конфигурация EAS (профили сборки, submit)
  app.json                 # версия приложения (buildNumber ставится в CI)
  plugins/
    withShareExtension.js  # Xcode плагин для Share Extension
    share-extension/       # исходники Share Extension (шаблоны)
```
