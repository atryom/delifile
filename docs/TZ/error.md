# Анализ нового функционала: Markdown-редактор

**Базовая версия документации:** `14bb624`
**Коммит с новым функционалом:** `d3f9b61` (Merge feature/markdown-editor → master)
**Первый раунд исправлений:** `3a77e52` (пункты 1–5, 7–11, 13)
**Второй раунд исправлений:** `bcb106f` (пункты #1/#8, #2, #6)
**Третий раунд (тесты):** `06ea93e`

---

## 1. Ошибки и нестыковки в коде

После трёх раундов исправлений критические и средние ошибки отсутствуют.

### Исправлено

| Раунд | Пункт | Описание |
|---|---|---|
| `3a77e52` | #1 | stableUrl при вставке картинок (onImageSelected → img.stableUrl) |
| `3a77e52` | #2 | Защита от цикла в canViewDocument (visited[]) |
| `3a77e52` | #3 | N+1 → один whereIn в normalizeImageUrls |
| `3a77e52` | #4 | Квота при сохранении документа (дельта, а не полный размер) |
| `3a77e52` | #5 | Нейтральный endpoint updateAccess (убрана isMarkdownDocument) |
| `3a77e52` | #7 | Сохранение пустого документа (present\|string) |
| `3a77e52` | #8 | Inline-баннер вместо alert() (conflictError) |
| `3a77e52` | #9 | lock всегда в ответе ({ isLocked: false }) |
| `3a77e52` | #10 | release() без ошибки в консоли (error: () => {}) |
| `3a77e52` | #11 | null guard в DocumentLock::isExpired() |
| `3a77e52` | #13 | Стили ImagePickerComponent в SCSS |
| `bcb106f` | #1/8 | hydrateImageUrls N+1 → batch whereIn + pre-generate presigned map |
| `bcb106f` | #2 | formatImageItem: assetUrl = stableUrl = `/api/v1/files/{id}/content` |
| `bcb106f` | #6 | quota_exceeded (413) обработан на фронте (статус 'quota') |
| `06ea93e` | — | Валидация content исправлена на `['present', 'nullable', 'string']` |
| `06ea93e` | — | Полный набор тестов backend + frontend |

---

## 2. Разница с документацией (docs/TZ/markdown_editor_mvp_tz.md)

| Пункт ТЗ | Статус | Комментарий |
|---|---|---|
| **9.1 POST /documents** — пример ответа содержит `storageKey` | ❌ | Ответ не содержит `storageKey`. Поле не используется клиентом, низкий приоритет |
| **5.3 Автосохранение с debounce** | ⚠️ | Только явное сохранение по кнопке. ТЗ допускает оба варианта |
| **Остальные пункты** | ✅ | Все требования выполнены |

---

## 3. Покрытие тест-кейсами

### Backend (коммит `06ea93e`)

| Файл | Тестов | Ключевые сценарии |
|---|---|---|
| `DocumentControllerTest` | **21** | Create (4), get capabilities (5), lock field always present isLocked (2: no lock, expired), save (4: success, etag conflict, no lock, empty content), permissions (2: shared can_edit, shared readonly), quota 413, updateAccess (3: owner grant, non-owner forbidden, saved-type 404), shared folder view, normalizeImageUrls |
| `DocumentLockControllerTest` | **14** | Acquire (3: owner, 423, no rights), expired reacquire, re-acquire own active lock, heartbeat (3: renew, LOCK_EXPIRED no lock, LOCK_EXPIRED expired own, LOCK_TAKEN_OVER), takeover (3: owner, non-owner, own lock refreshes), release (2: own, idempotent) |
| `AssetControllerTest` | **9** | Own images, shared images, excluded other users, non-image excluded, search, auth required, stable assetUrl, stableUrl always application path, cursor pagination |

### Frontend (коммит `06ea93e`)

| Файл | Тестов | Ключевые сценарии |
|---|---|---|
| `DocumentsApiService` spec | 9 | Все HTTP-методы (create, get, save, acquireLock, heartbeat, takeover, releaseLock, getImages, updateAccess) |
| `DocumentLockService` spec | 10 | idle, acquire held, acquire 423 readonly, release, takeover success, takeover 403, reacquire, reset, heartbeat LOCK_EXPIRED, heartbeat LOCK_TAKEN_OVER |
| `MarkdownEditorComponent` spec | **20** | create, load, filename display, hide/show toolbar, canEdit, takeover banner, expired banner, locked-by-other banner, back nav, loading states, save() success, save() empty content, save() 409 → conflictError, save() 413 → quota, save() 500 → error, onImageSelected stableUrl, ngOnDestroy, reacquire, takeover |
| `ImagePickerComponent` spec | 13 | create, getImages on init, image grid display, filenames, empty state, selection, confirm disabled/enabled, emit selected, emit cancelled (✕, Отмена, overlay), load-more button, append images, debounce search |
| `MarkdownEditorPanelComponent` spec | **27** | create, load, filename, save button visibility, collapse toggle, hidden body, takeover banner, expired banner, locked-by-other banner, conflict banner, save() success, save() empty content, save() 413 quota, save() conflict error clear, onImageSelected stableUrl, ngOnDestroy release, ngOnDestroy no release, reacquire, canEdit, close output |

Общий итог: **1123 строки тестового кода**, **114 тест-кейсов**.
