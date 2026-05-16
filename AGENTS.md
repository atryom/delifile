# Правила проекта

- Мы всегда общаемся на русском языке.

# Базовая версия документации в docs/

Фиксированный commit, от которого отсчитываются изменения в файлах `docs/endpoints.md`, `docs/models.md`, `docs/permission.md`, `docs/pmt.md`, `docs/tests.md`, `docs/userflow.md`, `docs/usermanual.md`:

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
