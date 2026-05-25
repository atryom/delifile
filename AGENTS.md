# Правила проекта

- Мы всегда общаемся на русском языке.

# Базовая версия документации в docs/

Фиксированный commit, от которого отсчитываются изменения в файлах `docs/endpoints.md`, `docs/models.md`, `docs/permission.md`, `docs/pmi.md`, `docs/tests.md`, `docs/userflow.md`, `docs/usermanual.md`:

**`14bb624`** — 16 мая 2026, "+корректировка документации"

При работе с doc-файлами:
- сверяйся с этим baseline-commit
- используй `git diff 14bb624 -- docs/<file>` чтобы увидеть накопившиеся изменения
- если нужно обновить baseline — я скажу «обнови baseline»

# Генерация PDF из Markdown

Для генерации PDF из Markdown-файлов используется wkhtmltopdf:

1. Установить wkhtmltopdf (если ещё не установлен):
   ```
   curl -sL "https://github.com/wkhtmltopdf/packaging/releases/download/0.12.6.1-2/wkhtmltox_0.12.6.1-2.jammy_amd64.deb" -o /tmp/wkhtml.deb
   dpkg -x /tmp/wkhtml.deb /tmp/wkhtml
   ```

2. Конвертировать Markdown → HTML → PDF:
   ```bash
   # Конвертация Markdown в HTML
   node -e "
   const marked = require('marked');
   const fs = require('fs');
   const md = fs.readFileSync('docs/usermanual.md', 'utf-8');
   const html = marked.parse(md);
   const fullHtml = '<!DOCTYPE html><html><head><meta charset=\"utf-8\"><style>body{font-family:sans-serif;line-height:1.6;margin:2cm;font-size:11pt}a{color:#0366d6}code{background:#f0f0f0;padding:2px 4px;border-radius:3px}pre{background:#f6f8fa;padding:12px;border-radius:4px;overflow-x:auto}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px;text-align:left}h1{font-size:20pt;border-bottom:2px solid #333;padding-bottom:8px}h2{font-size:16pt;border-bottom:1px solid #ccc;padding-bottom:4px;margin-top:24px}h3{font-size:13pt;margin-top:18px}</style></head><body>' + html + '</body></html>';
   fs.writeFileSync('/tmp/output.html', fullHtml);
   "
   
   # Генерация PDF
   /tmp/wkhtml/usr/local/bin/wkhtmltopdf --enable-local-file-access /tmp/output.html docs/usermanual.pdf
   ```

3. `marked` должен быть установлен: `npm install marked` (в /tmp или в проекте).

# Состояние рефакторинга (3 раунда аудита, спринты 1–22)

Проведено 3 полных цикла аудит→фикс→верификация.
Документы: `docs/refactoring/audit-01–04.md`, `re-audit-01–04.md`, `re-audit2-01–04.md`.
План: `docs/refactoring/execute_plan.md` — 22 спринта.

## Спринты 18–22 (финальный раунд, re-audit2) — верифицированы ✅

Все 31 пункт проверены по коду:

| Спринт | Тема | Пунктов |
|--------|------|---------|
| 18 | P0 Security (owner-only, cascade, optimistic lock) | 6 ✅ |
| 19 | Validation/Models (folder_id, tag ownership, contact rules) | 5 ✅ |
| 20 | N+1 и batch (CleanExpiredFiles, inbox, admin stats, индексы) | 7 ✅ |
| 21 | S3 надёжность (try/catch + rollback, expires_at) | 6 ✅ |
| 22 | Enum строк (FileStatus, AccessType, SharedFolderAccessType, CommentScope) | 7 ✅ |

Подробности — в `docs/refactoring/execute_plan.md` (секции Спринт 18–22).

## re-audit3 (4-й раунд) — завершён 🔍

Проведён полный 4-й цикл аудита по 4 доменам. Документы: `docs/refactoring/re-audit3-01–04.md`.

| Файл | Тема | Находок |
|------|------|---------|
| `re-audit3-01-security.md` | Security / Access Control / Mass Assignment | 25 (3 🔴, 6 🟠, 10 🟡, 6 🔵) |
| `re-audit3-02-queries.md` | N+1 / Performance | 12 (6 🔴, 3 🟠, 3 🔵) |
| `re-audit3-03-s3.md` | S3 / Storage Reliability | 9 (3 🟠, 3 🟡, 3 🔵) |
| `re-audit3-04-logic.md` | Validation / Logic / Edge Cases | 22 (1 🔴, 3 🟠, 12 🟡, 6 🔵) |

**Всего: 68 находок** (4 CRITICAL, 12 HIGH, 25 MEDIUM, 15 LOW + 12 deferred/discussed)

### Ключевые CRITICAL находки
1. `User::$fillable` содержит `is_superuser` — privilege escalation
2. `ContactController::store()` — else-if вместо OR в проверке дубликатов (email+phone)
3. `InvitationService::accept()` — не проверяет email получателя → любой может принять приглашение
4. `InvitationController::reject()` — полное отсутствие авторизации

## re-audit4 (5-й раунд) — завершён 🔍

Проведён финальный регрессионный аудит после спринтов 22–28.

| Проверка | Результат |
|----------|-----------|
| Regression существующих enum'ов | **0** находок ✅ |
| Regression CRITICAL фиксов | **4/4 PASS** ✅ |
| Deferred exceptions — поменяли статус | **2 исправлено**, **2 остаётся** |

**Документ:** `docs/refactoring/re-audit4.md`

## Оставшиеся deferred исключения
- **`SharedFolderService` глубокий рефакторинг** — не создан, код не написан
- **6 enum-классов для доменов без enum** — `InvitationStatus`, `SupportTicketStatus`, `ContactRequestStatus`, `SuggestionTicketStatus`, `UserAccountStatus`, `CommentAuditAction` (~41 raw-строка в коде)
