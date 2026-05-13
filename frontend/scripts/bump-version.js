#!/usr/bin/env node
const fs   = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '../package.json');
const pkg     = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const parts = pkg.version.split('.').map(Number);
parts[2]++;
const newVersion = parts.join('.');
pkg.version = newVersion;

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

const envFiles = [
  path.join(__dirname, '../src/environments/environment.ts'),
  path.join(__dirname, '../src/environments/environment.production.ts'),
];

for (const envFile of envFiles) {
  if (!fs.existsSync(envFile)) continue;
  let content = fs.readFileSync(envFile, 'utf8');
  content = content.replace(/version:\s*'[^']+'/, `version: '${newVersion}'`);
  fs.writeFileSync(envFile, content);
}

console.log(`[bump-version] ${pkg.version.replace(/\d+$/, parts[2] - 1)} → ${newVersion}`);