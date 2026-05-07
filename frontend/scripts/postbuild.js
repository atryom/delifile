#!/usr/bin/env node
/**
 * Postbuild script.
 * Runs after `ng build` and stamps every artifact with a build hash so that
 * the VersionCheckService can detect stale bundles and reload automatically.
 *
 * What it does:
 *  1. Generates a short build hash (base-36 timestamp).
 *  2. Injects  <script>window.__BUILD_HASH__='…';</script>  into index.html
 *     (so the running app always knows its own version).
 *  3. Prepends a  // @build-version …  comment to sw.js
 *     (changing sw.js forces the browser to install a new Service Worker on
 *     every deploy, which in turn posts SW_UPDATED to all open clients).
 *  4. Writes version.json  { "hash": "…" }  that the server always serves
 *     fresh (no-cache).  Angular checks this file on visibility-change and
 *     reloads when the hash differs from the embedded __BUILD_HASH__.
 */

const fs   = require('fs');
const path = require('path');

const distDir     = path.join(__dirname, '../dist/delifile/browser');
const indexPath   = path.join(distDir, 'index.html');
const swPath      = path.join(distDir, 'sw.js');
const versionPath = path.join(distDir, 'version.json');

if (!fs.existsSync(indexPath)) {
  console.error('[postbuild] index.html not found – did the build succeed?');
  process.exit(1);
}

const hash = Date.now().toString(36);

// 1. Patch index.html
let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(
  '</head>',
  `<script>window.__BUILD_HASH__='${hash}';</script></head>`
);
fs.writeFileSync(indexPath, html);

// 2. Patch sw.js (stamp version so browser detects a new SW on every deploy)
if (fs.existsSync(swPath)) {
  const sw = fs.readFileSync(swPath, 'utf8');
  fs.writeFileSync(swPath, `// @build-version ${hash}\n` + sw);
}

// 3. Write version.json
fs.writeFileSync(versionPath, JSON.stringify({ hash }));

console.log(`[postbuild] Build version stamped: ${hash}`);
