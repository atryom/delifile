#!/usr/bin/env node
// Increments patch version (1.1.0 → 1.1.1) and versionCode in:
//   app.json
//   android/app/build.gradle
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// --- app.json ---
const appJsonPath = resolve(root, 'app.json');
const appJson = JSON.parse(readFileSync(appJsonPath, 'utf8'));
const [major, minor, patch] = appJson.expo.version.split('.').map(Number);
const newPatch = patch + 1;
const newVersion = `${major}.${minor}.${newPatch}`;
appJson.expo.version = newVersion;
writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');

// --- android/app/build.gradle ---
const gradlePath = resolve(root, 'android/app/build.gradle');
let gradle = readFileSync(gradlePath, 'utf8');

const vcMatch = gradle.match(/versionCode\s+(\d+)/);
if (!vcMatch) { console.error('versionCode not found in build.gradle'); process.exit(1); }
const newVersionCode = parseInt(vcMatch[1], 10) + 1;

gradle = gradle
  .replace(/versionCode\s+\d+/, `versionCode ${newVersionCode}`)
  .replace(/versionName\s+"[^"]+"/, `versionName "${newVersion}"`);

writeFileSync(gradlePath, gradle);

console.log(`${major}.${minor}.${patch} (${vcMatch[1]})  →  ${newVersion} (${newVersionCode})`);
