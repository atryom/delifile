#!/usr/bin/env python3
"""Patch fastlane create_keychain.rb for macOS 15 Sequoia compatibility.

Changes:
  1. Wraps 'security set-keychain-settings' call in begin/rescue (flag -t removed in macOS 15).
  2. Deduplicates and caps keychain search list to 30 entries to avoid ARG_MAX overflow.

Idempotent: checks for _macOS15 marker before patching.
Non-fatal: exits 0 even if file not found or patch already applied.
"""
import re
import subprocess
import sys
import pathlib

MARKER = "_macOS15"


def find_files():
    result = subprocess.run(
        ["find", "/opt/homebrew", "/usr/local", "-name", "create_keychain.rb",
         "-path", "*/fastlane/actions/*"],
        capture_output=True, text=True
    )
    return [f for f in result.stdout.splitlines() if f.strip()]


def patch_file(path: str) -> bool:
    p = pathlib.Path(path)
    content = p.read_text()

    if MARKER in content:
        print(f"[patch_fastlane] Already patched: {path}")
        return True

    patched = content
    applied = []

    # ------------------------------------------------------------------
    # Patch 1: wrap the `security set-keychain-settings` sh() call
    # in begin/rescue so macOS 15 (-t flag removed) doesn't kill the build.
    # Targets the block:
    #   command = "security set-keychain-settings"
    #   command << ...
    #   commands << Fastlane::Actions.sh(command, log: false)
    # ------------------------------------------------------------------
    pat1 = re.compile(
        r'([ \t]*)(command = "security set-keychain-settings"'
        r'(?:\n(?![ \t]*commands <<)[^\n]*)*\n'
        r'[ \t]*commands << Fastlane::Actions\.sh\(command,\s*log:\s*false\))',
        re.MULTILINE,
    )

    def wrap_rescue(m):
        indent = m.group(1)
        block = m.group(2)
        lines = block.splitlines()
        indented = '\n'.join(indent + '  ' + ln.lstrip() for ln in lines)
        return (
            f"{indent}begin  # {MARKER}: set-keychain-settings -t removed on macOS 15\n"
            f"{indented}\n"
            f"{indent}rescue => _e15sk\n"
            f"{indent}  nil\n"
            f"{indent}end"
        )

    new = pat1.sub(wrap_rescue, patched)
    if new != patched:
        patched = new
        applied.append("set-keychain-settings → begin/rescue")

    # ------------------------------------------------------------------
    # Patch 2: deduplicate + cap keychain list before list-keychains -s
    # to avoid ARG_MAX overflow from accumulated stale EAS keychains.
    # Inserts `keychains = keychains.uniq.last(30)` before the sh() call.
    # ------------------------------------------------------------------
    pat2 = re.compile(
        r'([ \t]*)(commands << Fastlane::Actions\.sh\("security list-keychains -s)',
    )

    def cap_list(m):
        indent = m.group(1)
        rest = m.group(2)
        # Only patch if not already done
        return (
            f"{indent}keychains = keychains.uniq.last(30)  # {MARKER}: cap to avoid ARG_MAX\n"
            f"{indent}{rest}"
        )

    if 'keychains = keychains.uniq.last(30)' not in patched:
        new = pat2.sub(cap_list, patched)
        if new != patched:
            patched = new
            applied.append("list-keychains → uniq.last(30)")

    if not applied:
        print(f"[patch_fastlane] No matching patterns found in {path} — skipping")
        return True

    p.write_text(patched)
    print(f"[patch_fastlane] Patched {path}: {', '.join(applied)}")
    return True


files = find_files()
if not files:
    print("[patch_fastlane] create_keychain.rb not found — skipping")
    sys.exit(0)

for f in files:
    patch_file(f)

sys.exit(0)
