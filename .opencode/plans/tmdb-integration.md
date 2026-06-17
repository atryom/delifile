# План: TMDb как альтернативный источник фильмов

**Дата:** 2026-06-09

## UI-подход: переключатель источника

Над строкой поиска — селектор из двух кнопок: **«Кинопоиск»** / **«TMDb»** (по умолчанию «Кинопоиск»).  
Пользователь сам выбирает источник перед поиском.

---

## 1. Бэкенд

### 1.1. `config/services.php`

```php
'tmdb' => [
    'token' => env('TMDB_API_TOKEN'),
],
```

### 1.2. `app/Services/TmdbService.php` (новый)

По аналогии с `KinopoiskService`. Базовый URL: `https://api.themoviedb.org/3`.

| Метод | Эндпоинт | Примечание |
|-------|----------|------------|
| `search(string $query)` | `GET /3/search/movie?query=...&language=ru-RU` | limit=5 |
| `fetchById(int $id)` | `GET /3/movie/{id}?language=ru-RU` | — |
| `extractIdFromUrl(string $url)` | — | `themoviedb.org/movie/123` |
| `normalize(array $data)` | — | нормализация в единый формат |

**Нормализованный результат (`custom_metadata`):**

```json
{
  "source": "tmdb",
  "tmdb_id": 550,
  "title": "Fight Club",
  "year": 1999,
  "poster_url": "https://image.tmdb.org/t/p/w500/...",
  "rating_tmdb": 8.4,
  "genres": ["драма"],
  "director": "Дэвид Финчер",
  "description": "...",
  "tmdb_url": "https://www.themoviedb.org/movie/550"
}
```

Поля `title`, `year`, `poster_url`, `genres`, `director`, `description` — совпадают по ключам с Kinopoisk (фронт использует их единообразно).

### 1.3. `app/Http/Controllers/Files/MovieController.php`

**`searchShared()`:**
- Принимает `source` (`'kinopoisk' | 'tmdb'`, default `'kinopoisk'`)
- Выбирает сервис по `source`
- Обнаружение URL: `kinopoisk.ru` → KP, `themoviedb.org` → TMDb (авто-подтверждение)

**`storeShared()`:**
- Валидация: `source` (default `'kinopoisk'`), `kinopoisk_id` / `tmdb_id` (mutually exclusive)
- Выбор сервиса по `source` для `fetchById()`
- `custom_metadata` включает `source`
- `link_url` = `kp_url` или `tmdb_url`

### 1.4. Обратная совместимость

Старые записи без `source` → считаются `kinopoisk`.  
Старые `POST { kinopoisk_id: N }` без `source` → работают (source=kinopoisk по умолчанию).

---

## 2. Фронтенд Angular

### 2.1. `api.models.ts`

Расширить `MovieMetadata`:

```ts
export interface MovieMetadata {
  source?: 'kinopoisk' | 'tmdb';
  kinopoisk_id: number | null;
  tmdb_id: number | null;
  title: string | null;
  year: number | null;
  poster_url: string | null;
  rating_kp: number | null;
  rating_tmdb: number | null;
  genres: string[];
  director: string | null;
  description: string | null;
  kp_url: string | null;
  tmdb_url: string | null;
  watched?: boolean | null;
  personal_rating?: number | null;
}
```

### 2.2. `shared-folders-api.service.ts`

```ts
searchMovies(folderId, input, source = 'kinopoisk')
  → POST { input, source }

addMovie(folderId, source, sourceId)
  → POST { source, kinopoisk_id: source === 'kinopoisk' ? sourceId : undefined, tmdb_id: source === 'tmdb' ? sourceId : undefined }
```

### 2.3. `add-movie-dialog.component.ts`

Шаблон:
```
[🎬 Кинопоиск] [☆ TMDb]     ← переключатель
[  Название...          ] [Найти]
```

- `source` — сигнал `'kinopoisk' | 'tmdb'`
- `isUrl()` — проверяет оба URL-шаблона
- `search()` передаёт `source` в API
- `add(movie)` передаёт `source` + соответствующий ID
- Бейдж на карточке результата: «Кинопоиск» / «TMDb»

### 2.4. `movie-view.component.ts`

- Показывать оба рейтинга, если есть
- Сортировка: добавить «Рейтинг TMDb»

### 2.5. `file-detail.component.html`

- Для `source === 'tmdb'` ссылка «Открыть на TMDb →»
- Показывать `rating_tmdb`

---

## 3. Фронтенд Mobile (React Native)

### 3.1. `types/file.ts`

Расширить `MovieMetadata` (аналогично п. 2.1).

### 3.2. `shared-folders.ts`

Обновить API-вызовы.

### 3.3. `AddMovieModal.tsx`

Переключатель источника + логика как в Angular.

### 3.4. MovieCard / `[id].tsx`

Показывать рейтинг/ссылку по `source`.

---

## 4. Порядок реализации

1. `TmdbService.php` + конфиг
2. `MovieController` — доработка search + store
3. Angular: модель → API → диалог → карточка → деталка
4. Mobile: модель → API → модалка → карточка → деталка
