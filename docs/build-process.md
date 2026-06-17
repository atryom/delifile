# Как мы собираем мобильные приложения

## Android APK — локальная сборка (WSL2)

### Зависимости

- JDK 17
- Android SDK в `~/android-sdk/`
- NDK 27.1 (ставится автоматически при первой сборке)
- WSL2, минимум 8 ГБ RAM

### Шаг 1 — Prebuild (только если менялись app.json или нативные модули)

```bash
cd /var/www/delifile/mobile
npx expo prebuild --platform android
```

Это генерирует папку `android/` из Expo конфига. Не нужно запускать перед каждой сборкой — только после изменений в зависимостях или `app.json`.

### Шаг 2 — Сборка APK

```bash
cd /var/www/delifile/mobile/android
GRADLE_OPTS="-Xmx1200m -XX:MaxMetaspaceSize=256m" \
  ./gradlew assembleRelease --no-daemon --max-workers=1 -Dorg.gradle.parallel=false
```

Выход: `android/app/build/outputs/apk/release/app-release.apk`

Для debug-сборки (если нужно потестировать):
```bash
./gradlew assembleDebug --no-daemon --max-workers=1
```

**Важный момент:** в `android/app/build.gradle` должна быть строка:
```groovy
debuggableVariants = []
```
Без неё debug-сборка не бандлит JS и приложение не запустится без Metro-сервера.

### Keystore для подписи release

```
Файл:  ~/android-sdk/delifile-release.keystore
Alias: delifile
Pass:  delifile123
```

### Шаг 3 — Загрузка APK в Delifile

После сборки переименовать APK и загрузить вручную в shared folder на delifile.ru.
Имя файла: `delifile_<версия>.apk` (версию смотреть в `mobile/app.json` → `version`).

Загрузка через API (3 шага):

```bash
DELIFILE_TOKEN="<твой Bearer токен>"
FOLDER_ID="01kthtznmcakp23njmbv9vabw5"   # папка "Android Builds" в Delifile
APK_FILE="delifile_1.1.32.apk"
APK_SIZE=$(wc -c < "$APK_FILE" | tr -d ' ')

# Шаг 1 — инициализация
INIT=$(curl -sf -X POST "https://delifile.ru/api/v1/shared-folders/${FOLDER_ID}/init-upload" \
  -H "Authorization: Bearer ${DELIFILE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"original_name\": \"${APK_FILE}\", \"size\": ${APK_SIZE}, \"mime_type\": \"application/vnd.android.package-archive\"}")

FILE_ID=$(echo "$INIT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['file']['id'])")
UPLOAD_URL=$(echo "$INIT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['upload']['url'])")

# Шаг 2 — загрузка в S3
curl -sf -X PUT "$UPLOAD_URL" \
  -H "Content-Type: application/vnd.android.package-archive" \
  --data-binary @"$APK_FILE"

# Шаг 3 — завершение
curl -sf -X POST "https://delifile.ru/api/v1/shared-folders/${FOLDER_ID}/complete-upload" \
  -H "Authorization: Bearer ${DELIFILE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"file_id\": \"${FILE_ID}\"}"
```

---

## iOS — автоматическая сборка через GitHub Actions + macOS runner

### Как это работает

Используется **self-hosted macOS runner** (физический MacBook в команде).
Workflow: `.github/workflows/ios-build.yml`

**Триггер:** любой `git push` в ветку `master`, если затронуты файлы в `mobile/**`.

**Инструмент сборки:** EAS CLI (`eas build --local`) — сборка идёт прямо на mac-машине, не в облаке EAS.

### Шаги CI

1. Checkout кода
2. Установка Node 20 + `npm ci` + `npm install -g eas-cli`
3. Разблокировка macOS keychain (`security unlock-keychain`)
4. Фикс macOS 14 — выдача прав code signing инструментам через `set-key-partition-list`
5. Установка сертификатов Apple WWDR (G4/G5/G6) из PKI Apple
6. Установка iOS build number = номер GitHub Actions run
7. **Сборка:** `eas build --platform ios --profile production --local --non-interactive`
   - занимает ~15–30 минут
   - лог пишется в `/tmp/ios-build.log`
   - EAS может вернуть non-zero код из-за ENOTEMPTY при cleanup — это нормально, проверяем наличие `.ipa`, а не exit code
8. **Отправка в TestFlight:** `eas submit --platform ios --path <ipa>`
   - Требует App Store Connect API Key (`.p8` файл материализуется из GitHub secret `ASC_API_KEY_P8_BASE64`)
9. Лог сборки всегда загружается в Delifile (имя: `ios-build-{success|failure}-{timestamp}.log`)

### GitHub secrets для iOS CI

| Secret | Назначение |
|--------|-----------|
| `EXPO_TOKEN` | Токен expo.dev (EAS auth) |
| `MAC_KEYCHAIN_PASSWORD` | Пароль keychain на MacBook |
| `ASC_API_KEY_P8_BASE64` | App Store Connect API Key (.p8) в base64 |
| `ASC_KEY_ID` | ID ключа ASC |
| `ASC_ISSUER_ID` | Issuer ID в App Store Connect |
| `DELIFILE_TOKEN` | Bearer токен для загрузки логов в Delifile |

### Что происходит в итоге

После успешного CI:
- Новая версия приложения появляется в **TestFlight** (для тестировщиков)
- При одобрении — вручную публикуется в App Store через App Store Connect

**Важно:** папка `mobile/ios/` в `.gitignore` — нативный iOS-проект генерируется EAS на машине при сборке. Нативные плагины правятся в `mobile/plugins/`, а не в `ios/`.

---

## Конфигурационные файлы

| Файл | Назначение |
|------|-----------|
| `mobile/app.json` | Версия, bundle ID, иконки, EAS project ID |
| `mobile/eas.json` | Профили сборки (development / preview / production) |
| `mobile/package.json` | Скрипты: bump, build:editor |
| `.github/workflows/ios-build.yml` | iOS CI pipeline |
| `~/android-sdk/delifile-release.keystore` | Keystore для Android release (не в git) |
