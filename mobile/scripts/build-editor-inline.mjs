// Generates assets/editor/editor-inline.html from editor.html + editor-bundle.js.
//
// iOS loads the editor inside a WebView from a file:// origin where the
// ReactNativeWebView bridge is unavailable, so the TipTap bundle must be
// INLINED into a single self-contained HTML file (editor.html references the
// bundle via an external <script src> tag, which only works on Android where it
// is served from android_asset).
//
// IMPORTANT: the inlining uses a replacement FUNCTION, not a replacement string.
// String.prototype.replace interprets "$&", "$$", "$`", "$'" and "$n" inside a
// replacement *string*. The minified tiptap-markdown bundle contains escapeRegExp
// helpers like `.replace(/.../, "\\$&")`; if the bundle were passed as a
// replacement string, every "$&" would be expanded to the matched <script> tag,
// corrupting the bundle into invalid JS (this previously broke the iOS editor:
// window.TipTap was never defined and the editor hung on "Загрузка редактора...").
// A function replacement inserts the bundle verbatim.

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const editorDir = join(dir, '..', 'assets', 'editor');

const htmlPath = join(editorDir, 'editor.html');
const bundlePath = join(editorDir, 'editor-bundle.js');
const outPath = join(editorDir, 'editor-inline.html');

const html = readFileSync(htmlPath, 'utf8');
const bundle = readFileSync(bundlePath, 'utf8');

const tag = '<script src="editor-bundle.js"></script>';
if (!html.includes(tag)) {
  throw new Error(`Expected external bundle tag not found in editor.html: ${tag}`);
}

// Function replacement → "$&" etc. inside `bundle` are inserted literally.
const out = html.replace(tag, () => `<script>\n${bundle}\n</script>`);

if (out.includes(tag)) {
  throw new Error('editor-inline.html still references the external bundle after inlining');
}

writeFileSync(outPath, out);
console.log(`editor-inline.html generated: ${out.length} bytes`);
