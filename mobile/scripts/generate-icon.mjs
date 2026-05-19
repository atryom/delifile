import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'fs';
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

const files = [
  { out: '../assets/icon.png',          size: 1024, radius: 180, padding: 212 },
  { out: '../assets/adaptive-icon.png', size: 1024, radius: 0,   padding: 212 },
  { out: '../assets/splash-icon.png',   size: 200,  radius: 36,  padding: 40  },
  { out: '../assets/favicon.png',       size: 48,   radius: 8,   padding: 10  },
  { out: '../assets/images/logo.png',   size: 200,  radius: 40,  padding: 40  },
];

for (const { out, size, radius, padding } of files) {
  const svg = makeSvg(size, radius, padding);
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size } });
  const pngData = resvg.render().asPng();
  const outPath = resolve(__dirname, out);
  writeFileSync(outPath, pngData);
  console.log(`✓ ${outPath} (${size}x${size})`);
}
