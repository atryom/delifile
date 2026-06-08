# Исправления по типам папок и просмотру файлов — 2026-06-08

## Запрос

По итогам кросс-платформенного тестирования выявлен ряд замечаний:

1. **iOS/Android**: Нет иконки для обозначения типа папки (Фильмы / Галерея)
2. **iOS/Android**: Нельзя выбрать тип при создании корневой папки
3. **iOS/Android**: Для папки типа «Галерея» не применился дизайн аля Instagram (как в WEB/PWA)
4. **Все платформы**: В папке типа «Галерея» нет ограничения на добавление — должны быть доступны только изображения и видео (без ссылок и документов/заметок)
5. **WEB/PWA**: В папке типа «Фильмы» не скрыты кнопки добавления файлов/ссылок
6. **iOS/Android**: Нет возможности просмотра файлов типа изображение, видео, PDF (только скачивание)

## Рабочая папка

`/var/www/delifile`

---

## План реализации

### Issue 1: Иконки типа папки на мобильном

**Файлы:**
- `mobile/app/(app)/files/shared-folders/index.tsx` — строки 164, 190 (иконки в корневом списке)
- `mobile/app/(app)/files/shared-folders/[id].tsx` — строка 429 (иконки субпапок)

**Решение:** Заменить хардкодный `🗂` на функцию `getFolderIcon(folder_type)`:
- `gallery` → `🖼`
- `movies` → `🎬`
- `default` → `🗂`

---

### Issue 2: Выбор типа при создании корневой папки

**Файл:** `mobile/app/(app)/files/shared-folders/index.tsx`

**Решение:**
- Добавить `newFolderType` state (`'default' | 'gallery' | 'movies'`, default = `'default'`)
- Добавить под TextInput три кнопки выбора типа (аналог `add.tsx`)
- Передать `newFolderType` в `sharedFoldersApi.create(n, undefined, newFolderType)`
- Сбрасывать после создания

---

### Issue 3: Instagram-дизайн галереи на мобильном

**Файлы:**
- Новый: `mobile/src/components/ui/GalleryItemSheet.tsx`
- `mobile/src/components/ui/GalleryGrid.tsx` — заменить открытие GalleryViewer на GalleryItemSheet

**Решение:** Создать bottom sheet / modal с двумя зонами:
- Верхняя: медиа (expo-image / expo-av)
- Нижняя: имя файла, счётчики лайков/комментариев, кнопка лайка, список комментариев, поле ввода

---

### Issue 4: Ограничения добавления в папке «Галерея»

**Файлы:**
- `mobile/app/(app)/files/shared-folders/[id].tsx` — передавать `folder_type` параметром в add-экран
- `mobile/app/(app)/files/shared-folders/add.tsx` — скрывать «Добавить ссылку» и «Создать документ» для gallery; ограничить picker
- `frontend/.../folders-tree.component.html` — скрыть табы «Ссылка» и «Заметка» при `currentFolderType() === 'gallery'`
- `frontend/.../folders-tree.component.ts` — при открытии модала в gallery auto-select таб 'file'

---

### Issue 5: WEB — скрыть «Добавить файл» в папке «Фильмы»

**Файл:** `frontend/src/app/features/folders/pages/folders-tree/folders-tree.component.html`

**Решение:** Обернуть кнопку «Добавить файл» (строка 8) в `@if (currentFolderType() !== 'movies')`

---

### Issue 6: Просмотр файлов на мобильном

**Файл:** `mobile/app/(app)/files/[id].tsx`

**Решение:** Smart-открытие бинарных файлов:
- `image/*` / `video/*` → открыть GalleryViewer (modal) с presigned URL
- `application/pdf` → открыть modal с WebView (react-native-webview) и presigned URL
- Остальные → оставить кнопку «Скачать»
