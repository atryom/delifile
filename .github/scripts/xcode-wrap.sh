#!/bin/bash
if printf '%s\n' "$@" | grep -qF -- '-exportArchive'; then
  echo "[xcode-wrap] exportArchive detected — unlocking EAS keychain" >&2
  for PASS_FILE in /tmp/eas-kc-pass-*.txt; do
    [ -f "$PASS_FILE" ] || continue
    KC_PASS=$(cat "$PASS_FILE")
    KC_NAME="${PASS_FILE#/tmp/eas-kc-pass-}"; KC_NAME="${KC_NAME%.txt}"
    KC_PATH=$(find /private/var/folders /var/folders "$HOME/Library/Keychains" \
      -maxdepth 6 -name "$KC_NAME*" 2>/dev/null | head -1)
    if [ -n "$KC_PATH" ]; then
      /usr/bin/security unlock-keychain -p "$KC_PASS" "$KC_PATH" >/dev/null 2>&1
      /usr/bin/security set-keychain-settings -lut 36000 "$KC_PATH" >/dev/null 2>&1
      /usr/bin/security set-key-partition-list \
        -S "apple-tool:,apple:,codesign:" -s -k "$KC_PASS" "$KC_PATH" >/dev/null 2>&1 && \
        echo "[xcode-wrap] keychain unlocked OK: $KC_PATH" >&2 || \
        echo "[xcode-wrap] WARN: partition failed: $KC_PATH" >&2
    fi
  done

  # exportArchive переподписывает приложение. Без signingCertificate в export
  # options Xcode ищет "Apple Distribution" и находит посторонний сертификат
  # в login keychain -> "Provisioning profile doesn't include signing certificate".
  # Закрепляем SHA1 сертификата из EAS keychain в копии export options plist.
  EAS_KC=$(ls -t /private/var/folders/*/*/T/eas-build-*.keychain* 2>/dev/null | head -1)
  SHA1=""
  [ -n "$EAS_KC" ] && SHA1=$(/usr/bin/security find-identity -p codesigning "$EAS_KC" 2>/dev/null \
    | awk '/Distribution/ {print $2; exit}')
  if [ -n "$SHA1" ]; then
    ARGS=()
    NEXT_IS_PLIST=0
    for a in "$@"; do
      if [ "$NEXT_IS_PLIST" = 1 ]; then
        NEW_PLIST="/tmp/xcode-wrap-export-options-$$.plist"
        cp "$a" "$NEW_PLIST"
        /usr/libexec/PlistBuddy -c "Delete :signingCertificate" "$NEW_PLIST" >/dev/null 2>&1
        /usr/libexec/PlistBuddy -c "Add :signingCertificate string $SHA1" "$NEW_PLIST"
        echo "[xcode-wrap] exportArchive: signingCertificate=$SHA1 (from $EAS_KC)" >&2
        a="$NEW_PLIST"
        NEXT_IS_PLIST=0
      fi
      [ "$a" = "-exportOptionsPlist" ] && NEXT_IS_PLIST=1
      ARGS+=("$a")
    done
    exec /usr/bin/xcodebuild "${ARGS[@]}"
  fi
  echo "[xcode-wrap] WARN: no Distribution identity in EAS keychain — signingCertificate not pinned" >&2
  exec /usr/bin/xcodebuild "$@"
fi

# archive: фиксируем identity по SHA1 сертификата из keychain EAS.
# В login keychain раннера есть посторонний "Apple Distribution: ..." — Xcode
# выбирает его вместо EAS-сертификата ("iPhone Distribution: ...") и падает с
# "Provisioning profile doesn't include signing certificate".
IS_ARCHIVE=0
for a in "$@"; do [ "$a" = "archive" ] && IS_ARCHIVE=1; done
if [ "$IS_ARCHIVE" = 1 ]; then
  KC_PATH=$(ls -t /private/var/folders/*/*/T/eas-build-*.keychain* 2>/dev/null | head -1)
  if [ -n "$KC_PATH" ]; then
    PASS_FILE="/tmp/eas-kc-pass-${KC_PATH##*/}.txt"
    [ -f "$PASS_FILE" ] && /usr/bin/security unlock-keychain -p "$(cat "$PASS_FILE")" "$KC_PATH" >/dev/null 2>&1
    SHA1=$(/usr/bin/security find-identity -p codesigning "$KC_PATH" 2>/dev/null \
      | awk '/Distribution/ {print $2; exit}')
    if [ -n "$SHA1" ]; then
      echo "[xcode-wrap] archive: CODE_SIGN_IDENTITY=$SHA1 (from $KC_PATH)" >&2
      exec /usr/bin/xcodebuild "$@" CODE_SIGN_IDENTITY="$SHA1"
    fi
    echo "[xcode-wrap] WARN: no Distribution identity in $KC_PATH" >&2
  else
    echo "[xcode-wrap] WARN: EAS keychain not found — identity not pinned" >&2
  fi
fi
exec /usr/bin/xcodebuild "$@"
