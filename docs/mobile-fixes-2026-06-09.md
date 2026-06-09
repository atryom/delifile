# Mobile + Web fixes — 2026-06-09

## Issue 1: Android editor hangs on loader
**Root**: `handleMessage('scriptLoaded')` uses `document.dispatchEvent(new MessageEvent())` which is unreliable on Android.  
**Fix**: Call `window._editorInit()` directly (same as `onLoadEnd` path).

## Issue 2: "Смотрел" filter chip grows
**Root**: `filterChip` style has no `alignSelf`, stretches in horizontal ScrollView.  
**Fix**: `alignSelf: 'center'`, replace `minHeight` with `height`.

## Issue 3: Rating picker can't close
**Fix**: Replace inline picker with Modal overlay (grid 0-10, cancel button).

## Issue 4: Long press doesn't work
**Root**: `TouchableOpacity` inside FlatList unreliable for long press on both platforms.  
**Fix**: Replace with `Pressable`.

## Issue 5: Gallery sheet white space
**Root**: Container `flex:1` + fixed media height leaves empty white area.  
**Fix**: `mediaBox → flex:1`, `info` → `position:absolute` bottom.

## Issue 6: File count discrepancy
**Root**: Count query includes `uploading`/non-available files.  
**Fix**: Add `.whereHas('file', fn($fq) => $fq->where('status', 'available'))` to all `files_count` aggregates.
