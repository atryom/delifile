#!/bin/bash
# Intercept 'security create-keychain' to capture the random password EAS uses.
# EAS creates its temp keychain with a random password, then does NOT run
# set-key-partition-list — so codesign gets errSecInternalComponent on macOS 26.
# This wrapper saves the password to /tmp/eas-kc-pass-<keychain>.txt so our
# keychain watcher can call set-key-partition-list with the correct password.
if [ "$1" = "create-keychain" ]; then
    prev=""
    kc_pass=""
    kc_path=""
    for arg in "$@"; do
        if [ "$prev" = "-p" ]; then kc_pass="$arg"; fi
        case "$arg" in *eas-build-*.keychain*) kc_path="$arg";; esac
        prev="$arg"
    done
    if [ -n "$kc_path" ] && [ -n "$kc_pass" ]; then
        printf '%s' "$kc_pass" > "/tmp/eas-kc-pass-${kc_path##*/}.txt"
    fi
fi
exec /usr/bin/security "$@"
