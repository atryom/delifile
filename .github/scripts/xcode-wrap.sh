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
fi
exec /usr/bin/xcodebuild "$@"
