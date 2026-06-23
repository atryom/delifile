#!/usr/bin/env python3
"""Patch @expo/build-tools keychain.js for macOS 14/15 compatibility.

Changes:
  1. Removes '-v' flag from 'find-identity' call (causes hang on macOS 14+).
  2. Wraps create_keychain fastlane call in try/catch with retry (macOS 15 resilience).

Idempotent: checks for _macOS15 marker before patching.
Non-fatal: exits 0 even if file not found or patterns don't match.
"""
import re
import subprocess
import sys
import pathlib

MARKER = "_macOS15"


def find_files():
    result = subprocess.run(
        ["find", str(pathlib.Path.home() / ".npm/_npx"), "-name", "keychain.js",
         "-path", "*/@expo/build-tools/*"],
        capture_output=True, text=True
    )
    files = [f for f in result.stdout.splitlines() if f.strip()]

    # Also check local node_modules (eas-cli bundles build-tools)
    result2 = subprocess.run(
        ["find", str(pathlib.Path.home()), "-maxdepth", "10",
         "-name", "keychain.js", "-path", "*build-tools/dist/ios/credentials*"],
        capture_output=True, text=True
    )
    files += [f for f in result2.stdout.splitlines() if f.strip()]

    return list(set(files))


def patch_file(path: str) -> bool:
    p = pathlib.Path(path)
    content = p.read_text()

    if MARKER in content:
        print(f"[patch_keychain] Already patched: {path}")
        return True

    patched = content
    applied = []

    # ------------------------------------------------------------------
    # Patch 1: remove '-v' from find-identity invocation.
    # On macOS 14+ this flag causes 'security find-identity' to hang
    # for several minutes waiting for UI confirmation.
    # ------------------------------------------------------------------
    new = re.sub(r"'find-identity',\s*'-v'", "'find-identity'", patched)
    if new != patched:
        patched = new
        applied.append("find-identity: removed -v flag")

    # ------------------------------------------------------------------
    # Patch 2: wrap create_keychain fastlane call in try/catch with retry.
    # On macOS 15 the call may fail if keychain already exists or
    # set-keychain-settings -t is not supported.
    # Targets: await runFastlane(['run', 'create_keychain', ...])
    # Wraps the await expression so a failure triggers a second attempt.
    # ------------------------------------------------------------------
    pat2 = re.compile(
        r'([ \t]*)(await runFastlane\(\[\'run\',\s*\'create_keychain\'[^\)]*\]\))',
        re.DOTALL,
    )

    def wrap_try(m):
        indent = m.group(1)
        call = m.group(2)
        return (
            f"{indent}/* {MARKER}: retry on failure */\n"
            f"{indent}try {{\n"
            f"{indent}  {call}\n"
            f"{indent}}} catch (_e15ck) {{\n"
            f"{indent}  await runFastlane(['run', 'delete_keychain', "
            f"'name:' + keychainName]).catch(() => null);\n"
            f"{indent}  {call}\n"
            f"{indent}}}"
        )

    new = pat2.sub(wrap_try, patched)
    if new != patched:
        patched = new
        applied.append("create_keychain → try/catch with retry")

    if not applied:
        print(f"[patch_keychain] No matching patterns found in {path} — skipping")
        return True

    p.write_text(patched)
    print(f"[patch_keychain] Patched {path}: {', '.join(applied)}")
    return True


files = find_files()
if not files:
    print("[patch_keychain] keychain.js not found — skipping")
    sys.exit(0)

for f in files:
    patch_file(f)

sys.exit(0)
