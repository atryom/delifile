#!/bin/bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$PROJECT_ROOT/mobile"
SECRETS="$PROJECT_ROOT/secrets/build.env"
KEYSTORE_DIR="$HOME/android-keystore"
KEYSTORE="$KEYSTORE_DIR/delifile-release.keystore"
KEY_ALIAS="delifile"
DELIFILE_FOLDER="01ktkmjhwqjxx286mjzfzrfmfp"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✔${NC}  $*"; }
info() { echo -e "${YELLOW}▸${NC}  $*"; }
fail() { echo -e "${RED}✘${NC}  $*" >&2; exit 1; }

[ -f "$SECRETS" ] || fail "Файл $SECRETS не найден. Создай его:\n  mkdir -p $(dirname $0)/secrets\n  echo 'DELIFILE_TOKEN=xxx' > $SECRETS\n  echo 'KEYSTORE_PASS=xxx' >> $SECRETS"
source "$SECRETS"

[ -n "$DELIFILE_TOKEN" ] || fail "DELIFILE_TOKEN не задан в $SECRETS"
[ -n "$KEYSTORE_PASS"  ] || fail "KEYSTORE_PASS не задан в $SECRETS"

# Авто-инкремент patch-версии и versionCode
info "Поднимаем patch-версию..."
NEW_VERSION=$(node -e "
const fs = require('fs');
const f = '$MOBILE_DIR/app.json';
const cfg = JSON.parse(fs.readFileSync(f));
const parts = cfg.expo.version.split('.').map(Number);
parts[2]++;
cfg.expo.version = parts.join('.');
fs.writeFileSync(f, JSON.stringify(cfg, null, 2) + '\n');
console.log(cfg.expo.version);
")
ok "Версия: $NEW_VERSION"

# Обновляем versionCode в build.gradle (если есть)
if [ -f "$MOBILE_DIR/android/app/build.gradle" ]; then
  CURRENT_CODE=$(grep 'versionCode' "$MOBILE_DIR/android/app/build.gradle" | grep -o '[0-9]*' | head -1)
  NEW_CODE=$(( ${CURRENT_CODE:-1} + 1 ))
  sed -i "s/versionCode $CURRENT_CODE/versionCode $NEW_CODE/" "$MOBILE_DIR/android/app/build.gradle"
  sed -i "s/versionName \"[^\"]*\"/versionName \"$NEW_VERSION\"/" "$MOBILE_DIR/android/app/build.gradle"
fi

APK_NAME="delifile_${NEW_VERSION}.apk"
APK_SRC="$MOBILE_DIR/android/app/build/outputs/apk/release/app-release.apk"
APK_DEST="/tmp/$APK_NAME"

# 1. Keystore
if [ ! -f "$KEYSTORE" ]; then
  info "Создаём release keystore..."
  mkdir -p "$KEYSTORE_DIR"
  keytool -genkeypair -v \
    -keystore "$KEYSTORE" \
    -alias "$KEY_ALIAS" \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KEYSTORE_PASS" -keypass "$KEYSTORE_PASS" \
    -dname "CN=DeliFile, OU=Dev, O=DeliFile, L=Moscow, ST=Moscow, C=RU" \
    2>/dev/null
  ok "Keystore создан: $KEYSTORE"
else
  ok "Keystore найден: $KEYSTORE"
fi

# 2. Expo prebuild (если нет android/)
if [ ! -d "$MOBILE_DIR/android" ]; then
  info "Запускаем expo prebuild..."
  cd "$MOBILE_DIR"
  npx expo prebuild --platform android --no-install
  ok "Prebuild готов"
else
  ok "android/ уже существует"
fi

# 3. Сборка APK
info "Сборка release APK (arch: arm64-v8a)..."
cd "$MOBILE_DIR/android"
GRADLE_OPTS="-Xmx2048m -XX:MaxMetaspaceSize=512m" \
./gradlew assembleRelease \
  --no-daemon \
  -PreactNativeArchitectures=arm64-v8a \
  -Pandroid.injected.signing.store.file="$KEYSTORE" \
  -Pandroid.injected.signing.store.password="$KEYSTORE_PASS" \
  -Pandroid.injected.signing.key.alias="$KEY_ALIAS" \
  -Pandroid.injected.signing.key.password="$KEYSTORE_PASS"
ok "APK собран"

cp "$APK_SRC" "$APK_DEST"
APK_SIZE=$(wc -c < "$APK_DEST" | tr -d ' ')
info "Размер APK: $(( APK_SIZE / 1024 / 1024 )) МБ  →  $APK_NAME"

# 4. Загрузка в Delifile (папка Android Builds)
info "Загружаем в Delifile..."

INIT=$(curl -sf -X POST "https://delifile.ru/api/v1/shared-folders/${DELIFILE_FOLDER}/init-upload" \
  -H "Authorization: Bearer ${DELIFILE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"original_name\": \"${APK_NAME}\", \"size\": ${APK_SIZE}, \"mime_type\": \"application/vnd.android.package-archive\"}")

FILE_ID=$(echo "$INIT"    | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['file']['id'])")
UPLOAD_URL=$(echo "$INIT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['upload']['url'])")

curl -sf -X PUT "$UPLOAD_URL" \
  -H "Content-Type: application/vnd.android.package-archive" \
  --data-binary @"$APK_DEST"

curl -sf -X POST "https://delifile.ru/api/v1/shared-folders/${DELIFILE_FOLDER}/complete-upload" \
  -H "Authorization: Bearer ${DELIFILE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"file_id\": \"${FILE_ID}\"}"

rm -f "$APK_DEST"

echo ""
ok "Готово! Загружен: $APK_NAME"
ok "Папка: https://delifile.ru/folders?shared_folder_id=${DELIFILE_FOLDER}"

# Коммитим обновлённый app.json с новой версией
cd "$PROJECT_ROOT"
git add mobile/app.json
git commit -m "chore(mobile): bump version to $NEW_VERSION" 2>/dev/null && \
  ok "app.json закоммичен (версия $NEW_VERSION)" || true
