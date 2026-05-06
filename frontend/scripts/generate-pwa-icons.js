#!/usr/bin/env node
/**
 * Generates minimal PNG icons for PWA installability.
 * Solid #6366f1 square with a white DeliFile "D" mark.
 * Run once: node scripts/generate-pwa-icons.js
 */
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

function u32BE(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0, 0);
  return b;
}

function crc32(data) {
  const t = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  let crc = 0xFFFFFFFF;
  for (const b of data) crc = (t[(crc ^ b) & 0xFF] ^ (crc >>> 8)) >>> 0;
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const tb = Buffer.from(type, 'ascii');
  const cd = Buffer.concat([tb, data]);
  return Buffer.concat([u32BE(data.length), tb, data, u32BE(crc32(cd))]);
}

function makePNG(size, bg, draw) {
  const sig  = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB

  const row = size * 3 + 1;
  const raw = Buffer.alloc(size * row);
  for (let y = 0; y < size; y++) {
    raw[y * row] = 0; // filter None
    for (let x = 0; x < size; x++) {
      const [r, g, b] = draw(x, y, size) ?? bg;
      const off = y * row + 1 + x * 3;
      raw[off] = r; raw[off+1] = g; raw[off+2] = b;
    }
  }

  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function deliDraw(x, y, size) {
  const cx = size / 2, cy = size / 2;
  // Rounded rect background: #6366f1
  const bg  = [99, 102, 241];
  const fg  = [255, 255, 255];
  const r   = size * 0.12; // corner radius
  const pad = size * 0.12;
  const inX = x - pad, inY = y - pad, w = size - pad * 2, h = size - pad * 2;
  if (inX < 0 || inY < 0 || inX >= w || inY >= h) return bg;

  // Simple "D" letterform
  const lx = (inX - w * 0.28) / (w * 0.44);
  const ly = (inY - h * 0.2) / (h * 0.6);
  if (lx >= 0 && lx <= 1 && ly >= 0 && ly <= 1) {
    const stem = lx < 0.18;
    const dx = lx - 0.5, dy = ly - 0.5;
    const inArc = (dx * dx * 4 + dy * dy) < 0.9 && (dx * dx * 4 + dy * dy) > 0.45;
    const inTop = ly < 0.12 && lx < 0.9;
    const inBot = ly > 0.88 && lx < 0.9;
    if (stem || inArc || inTop || inBot) return fg;
  }

  return bg;
}

const out = path.join(__dirname, '../src/assets/icons');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'icon-192.png'), makePNG(192, [99,102,241], deliDraw));
fs.writeFileSync(path.join(out, 'icon-512.png'), makePNG(512, [99,102,241], deliDraw));
console.log('PWA icons generated → src/assets/icons/icon-192.png, icon-512.png');
