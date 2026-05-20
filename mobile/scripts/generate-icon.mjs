import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Логотип: синий скруглённый квадрат + белая иконка folder-symlink
function makeSvg(size, cornerRadius, iconPadding) {
  const iconSize = size - iconPadding * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${cornerRadius}" fill="#2563EB"/>
  <svg x="${iconPadding}" y="${iconPadding}" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 9.35V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h7"/>
    <path d="m8 16 3-3-3-3"/>
  </svg>
</svg>`;
}

// Для adaptive-icon foreground: прозрачный фон, белый символ по центру
function makeForegroundSvg(size) {
  const padding = Math.round(size * 0.28);
  const iconSize = size - padding * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <svg x="${padding}" y="${padding}" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 9.35V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h7"/>
    <path d="m8 16 3-3-3-3"/>
  </svg>
</svg>`;
}

function writePng(outPath, svg, size) {
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size } });
  const pngData = resvg.render().asPng();
  writeFileSync(outPath, pngData);
  console.log(`✓ ${outPath} (${size}x${size})`);
}

function removeWebp(dir, name) {
  const webpPath = resolve(dir, `${name}.webp`);
  if (existsSync(webpPath)) {
    unlinkSync(webpPath);
    console.log(`  removed ${webpPath}`);
  }
}

// ─── Assets ──────────────────────────────────────────────────────────────────

const assetFiles = [
  { out: '../assets/icon.png',          size: 1024, radius: 180, padding: 212 },
  { out: '../assets/adaptive-icon.png', size: 1024, radius: 0,   padding: 212 },
  { out: '../assets/splash-icon.png',   size: 200,  radius: 36,  padding: 40  },
  { out: '../assets/favicon.png',       size: 48,   radius: 8,   padding: 10  },
  { out: '../assets/images/logo.png',   size: 200,  radius: 40,  padding: 40  },
];

for (const { out, size, radius, padding } of assetFiles) {
  const svg = makeSvg(size, radius, padding);
  writePng(resolve(__dirname, out), svg, size);
}

// ─── Android mipmap PNG ───────────────────────────────────────────────────────

const RES_BASE = resolve(__dirname, '../android/app/src/main/res');

const densities = [
  { dir: 'mipmap-mdpi',    launcherSize: 48,  foregroundSize: 108 },
  { dir: 'mipmap-hdpi',    launcherSize: 72,  foregroundSize: 162 },
  { dir: 'mipmap-xhdpi',   launcherSize: 96,  foregroundSize: 216 },
  { dir: 'mipmap-xxhdpi',  launcherSize: 144, foregroundSize: 324 },
  { dir: 'mipmap-xxxhdpi', launcherSize: 192, foregroundSize: 432 },
];

for (const { dir, launcherSize, foregroundSize } of densities) {
  const dirPath = resolve(RES_BASE, dir);
  const launcherSvg = makeSvg(launcherSize, Math.round(launcherSize * 0.18), Math.round(launcherSize * 0.21));

  // ic_launcher.png — flat icon
  removeWebp(dirPath, 'ic_launcher');
  writePng(resolve(dirPath, 'ic_launcher.png'), launcherSvg, launcherSize);

  // ic_launcher_round.png — same as flat icon (circle mask applied by OS)
  removeWebp(dirPath, 'ic_launcher_round');
  writePng(resolve(dirPath, 'ic_launcher_round.png'), launcherSvg, launcherSize);

  // ic_launcher_foreground.png — transparent bg + white symbol for adaptive icon
  removeWebp(dirPath, 'ic_launcher_foreground');
  writePng(resolve(dirPath, 'ic_launcher_foreground.png'), makeForegroundSvg(foregroundSize), foregroundSize);
}
