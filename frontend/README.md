# FileSpace — Frontend (Angular 21)

Single-page application built with Angular 21 standalone API.

## Stack

| Concern | Technology |
|---|---|
| Framework | Angular 21 (standalone components only) |
| State | Angular Signals (local UI state) |
| Async / HTTP | RxJS + Angular HttpClient |
| Forms | ReactiveFormsModule |
| Auth | Laravel Sanctum (cookie-based, `withCredentials: true`) |
| Routing | Angular Router with lazy-loaded pages |

---

## Quick Start

```bash
# Install deps
npm install

# Dev server (proxies /api → Laravel :8000)
npm start

# Production build
npm run build:prod
```

---

## Architecture

```
src/app/
├── core/
│   ├── api/
│   │   ├── api.service.ts           # Base HTTP service
│   │   ├── auth-api.service.ts      # Auth endpoints
│   │   ├── files-api.service.ts     # Files + sharing endpoints
│   │   └── domain-api.services.ts  # Contacts, Activity, Organization
│   ├── auth/
│   │   ├── auth-state.service.ts   # Signal-based auth state
│   │   └── auth.initializer.ts     # APP_INITIALIZER (restore session)
│   ├── guards/
│   │   ├── auth.guard.ts
│   │   └── guest.guard.ts
│   ├── interceptors/
│   │   ├── auth.interceptor.ts     # withCredentials + 401 redirect
│   │   └── error.interceptor.ts    # normalize API error shape
│   └── layout/
│       └── app-layout/             # App shell with sidebar nav
├── shared/
│   └── models/
│       └── api.models.ts           # Typed API response models
└── features/
    ├── auth/
    │   └── pages/
    │       ├── login/              # Phone + password login
    │       ├── register/           # Registration
    │       └── pin-setup/          # Optional PIN screen
    ├── files/
    │   ├── pages/
    │   │   ├── file-list/          # Main screen + upload
    │   │   ├── file-detail/        # File card with all actions
    │   │   └── public-link/        # Public link download (no auth)
    │   ├── dialogs/
    │   │   ├── share-contact/      # Modal: share to contact
    │   │   └── create-link/        # Modal: create public link
    │   └── services/
    │       └── file-upload.service.ts  # 3-step upload flow
    ├── contacts/
    │   └── pages/contacts/         # Address book management
    ├── activity/
    │   └── pages/activity/         # Event feed
    └── settings/
        └── pages/security/         # Password + sessions
```

---

## Upload Flow (3 steps, no backend bottleneck)

```
User selects file
    ↓
FileUploadService.upload(file)
    ↓
1. POST /api/v1/files/init-upload
   → creates DB record, returns { file_id, presigned_put_url }

2. PUT <presigned-url>  [direct browser → S3]
   → HttpClient with reportProgress, no auth headers
   → Progress tracked via HttpEventType.UploadProgress

3. POST /api/v1/files/complete-upload { file_id }
   → file.status: uploading → available
   → owner access record created
   → activity logged
```

---

## API Response Contract

All responses typed as `ApiResponse<T>`:

```typescript
interface ApiResponse<T> {
  result: 'success' | 'error';
  message: string;
  data: T;
}
```

Errors normalized by `error.interceptor.ts` — components receive the same shape always.

---

## Key Routes

| Path | Description | Auth |
|---|---|---|
| `/login` | Sign in | Guest |
| `/register` | Create account | Guest |
| `/pin-setup` | Optional PIN setup | — |
| `/files` | File list + upload | ✓ |
| `/files/:id` | File detail card | ✓ |
| `/contacts` | Contact book | ✓ |
| `/activity` | Activity feed | ✓ |
| `/settings/security` | Password + sessions | ✓ |
| `/link/:token` | Public link download | Public |

---

## Architecture Rules

- All feature components are **standalone** (no NgModule)
- **Signals** for local UI state; **RxJS** for HTTP and async flows
- **ReactiveFormsModule** for all forms (no template-driven)
- HTTP calls only through typed API services — never directly in components
- `FileUploadService` owns the full 3-step upload flow
- `APP_INITIALIZER` restores session on every page load via `/auth/me`
