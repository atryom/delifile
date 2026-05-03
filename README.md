# FileSpace MVP

Personal file storage with fast access sharing.

> Backend: **Laravel 13 + PHP 8.3** · Frontend: **Angular 21 standalone**

---

## Project structure

```
project/
├── backend/       Laravel 13 REST API
└── frontend/      Angular 21 SPA
```

---

## Quick start

### 1. Backend

```bash
cd backend

# Copy and configure env
cp .env.example .env

# Edit .env — set DB credentials, AWS S3 keys, FRONTEND_URL

# Install dependencies
composer install

# Generate app key
php artisan key:generate

# Run migrations (creates all 10 tables)
php artisan migrate

# Start dev server
php artisan serve         # → http://localhost:8000

# Start queue worker (separate terminal)
php artisan queue:work

# Register scheduler (cron every minute, or run manually):
php artisan schedule:run
```

### 2. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start dev server (proxies /api → :8000)
npm start                 # → http://localhost:4200
```

---

## Architecture Overview

### Backend

```
Laravel 13
├── Routes            routes/api.php            — versioned /api/v1/...
├── Controllers       — thin: validate → service → respond
├── FormRequests      — all input validation
├── Services          AuthService, FileService, ActivityService
├── Models            User, File, FileUserAccess, ShareLink, Contact, ...
├── Policies          FilePolicy — centralized access control
├── Enums             FileStatus, AccessType, ShareLinkStatus, ActivityType
├── Jobs              CleanExpiredFilesJob, ExpireShareLinksJob
└── Exceptions        Handler — unified JSON error format
```

### Frontend

```
Angular 21 SPA
├── core/api          Typed HTTP services (one per domain)
├── core/auth         Signal-based auth state + APP_INITIALIZER
├── core/interceptors Auth cookie + error normalization
├── features/auth     Login, Register, PIN setup
├── features/files    File list, File card, Upload, Dialogs, Public link
├── features/contacts Address book
├── features/activity Event feed
└── features/settings Security (password + sessions)
```

---

## Unified API Response

Every backend endpoint returns:

```json
{ "result": "success", "message": "...", "data": { } }
{ "result": "error",   "message": "...", "data": { "code": "...", "errors": { } } }
```

---

## Upload Flow (3-step, direct-to-S3)

```
Browser                 Backend                 S3
  │                        │                    │
  ├─ POST /init-upload ────►│                    │
  │◄── presigned PUT URL ──┤                    │
  │                        │                    │
  ├─ PUT <presigned-url> ──────────────────────►│
  │◄────── 200 OK ─────────────────────────────┤
  │                        │                    │
  ├─ POST /complete-upload ►│                    │
  │◄── file.status=available┤                   │
```

---

## Security Design

- S3 bucket is **always private** — no public URLs
- Downloads require backend permission check → short-lived signed URL
- Auth via Laravel Sanctum SPA cookies (`withCredentials: true`)
- PIN is **local device only** — not a server-side login

---

## Scheduled Jobs

| Job | Frequency | Action |
|---|---|---|
| `ExpireShareLinksJob` | Every 30 min | Mark expired links |
| `CleanExpiredFilesJob` | Hourly | Delete expired S3 objects + DB records |

---

## Development Standards

1. **Laravel controller** contains no business logic
2. **Angular component** contains no direct HTTP calls or heavy logic
3. All API responses use `{result, message, data}` — no exceptions
4. File lifecycle: upload → available → (share/pin/link) → expire/delete
5. Physical file deduplication: `pin/save` = logical access record, not S3 copy
