# Анализ нового функционала: Markdown-редактор

**Базовая версия документации:** `14bb624`
**Коммит с новым функционалом:** `d3f9b61`
**Первый раунд исправлений:** `3a77e52`
**Второй раунд исправлений:** `bcb106f`
**Третий раунд (тесты):** `06ea93e`
**Четвёртый раунд (autosave + storageKey):** `37bbe04`
**Пятый раунд (тесты autosave + storageKey):** `TBD`

---

## 1. Ошибки и нестыковки в коде

### Исправлено

| Раунд | Пункт | Описание |
|---|---|---|
| `3a77e52` | #1 | stableUrl при вставке картинок |
| `3a77e52` | #2 | Защита от цикла в canViewDocument |
| `3a77e52` | #3 | N+1 → один whereIn в normalizeImageUrls |
| `3a77e52` | #4 | Квота при сохранении (дельта) |
| `3a77e52` | #5 | Нейтральный endpoint updateAccess |
| `3a77e52` | #7 | Сохранение пустого документа |
| `3a77e52` | #8 | Inline-баннер вместо alert() |
| `3a77e52` | #9 | lock всегда в ответе |
| `3a77e52` | #10 | release() без ошибки в консоли |
| `3a77e52` | #11 | null guard в DocumentLock::isExpired() |
| `3a77e52` | #13 | Стили ImagePickerComponent в SCSS |
| `bcb106f` | #1/8 | hydrateImageUrls N+1 → batch |
| `bcb106f` | #2 | formatImageItem: assetUrl = stableUrl |
| `bcb106f` | #6 | quota_exceeded (413) на фронте |
| `37bbe04` | — | storageKey в ответе POST/GET /documents |
| `37bbe04` | — | Autosave с debounce 3s |

### Текущие замечания

Все замечания закрыты.

---

## 2. Разница с документацией (docs/TZ/markdown_editor_mvp_tz.md)

| Пункт ТЗ | Статус | Комментарий |
|---|---|---|
| **9.1 POST /documents** — пример ответа содержит `storageKey` | ✅ | Добавлен в `buildDocumentResponse()` и модель `Document` |
| **5.3 Автосохранение с debounce** | ✅ | Реализовано: 3s debounce в обоих редакторах, сброс при ручном save, отключено при conflictError |
| **Остальные пункты** | ✅ | Все требования выполнены |

---

## 3. Покрытие тест-кейсами

### Backend

| Файл | Тестов | Сценарии |
|---|---|---|
| `DocumentControllerTest` | **22** | Create, storageKey, capabilities, lock isLocked false, save (success, conflict, no lock, empty), permissions, quota 413, updateAccess, shared folder view, normalizeImageUrls |
| `DocumentLockControllerTest` | **14** | Acquire, 423, re-acquire, heartbeat, takeover, release |
| `AssetControllerTest` | **9** | Images, search, pagination, stableUrl |

### Frontend

| Файл | Тестов | Сценарии |
|---|---|---|
| `DocumentsApiService` spec | 9 | HTTP-методы |
| `DocumentLockService` spec | 10 | Состояния lock |
| `MarkdownEditorComponent` spec | **24** | save(), autosave (fire/skip/cancel), 409/413/500, stableUrl, ngOnDestroy, reacquire, takeover |
| `ImagePickerComponent` spec | 13 | Загрузка, поиск, пагинация, stableUrl |
| `MarkdownEditorPanelComponent` spec | **31** | save(), autosave (fire/skip/cancel), баннеры, stableUrl, ngOnDestroy, reacquire |

**Общий итог:** 123 тест-кейса. Все расхождения с ТЗ закрыты. Покрытие autosave и storageKey добавлено.
