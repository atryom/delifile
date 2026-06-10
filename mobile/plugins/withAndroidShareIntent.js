// @ts-check
const { withMainActivity, withMainApplication, withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

module.exports = function withAndroidShareIntent(config) {
  config = copyKotlinSources(config);
  config = patchMainApplication(config);
  config = ensureOnNewIntent(config);
  return config;
};

// Copy ShareIntentModule.kt and ShareIntentPackage.kt into the Android source tree
function copyKotlinSources(config) {
  return withDangerousMod(config, [
    'android',
    (c) => {
      const srcDir = path.join(
        c.modRequest.platformProjectRoot,
        'app/src/main/java/com/delifile/app'
      );
      fs.mkdirSync(srcDir, { recursive: true });
      const pluginSrc = path.join(c.modRequest.projectRoot, 'plugins', 'share-extension');
      for (const f of ['ShareIntentModule.kt', 'ShareIntentPackage.kt']) {
        const src = path.join(pluginSrc, f);
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(srcDir, f));
      }
      return c;
    },
  ]);
}

// Register ShareIntentPackage in MainApplication.kt
function patchMainApplication(config) {
  return withMainApplication(config, (c) => {
    let content = c.modResults.contents;
    const MARKER = '// [withAndroidShareIntent]';
    if (content.includes(MARKER)) return c;

    // Add import after package declaration
    if (!content.includes('import com.delifile.app.ShareIntentPackage')) {
      content = content.replace(
        /^(package com\.delifile\.app\n)/m,
        `$1\nimport com.delifile.app.ShareIntentPackage ${ MARKER }\n`
      );
    }

    // Works whether getPackages() returns directly or uses a val
    if (!content.includes('ShareIntentPackage')) {
      // Style 1: PackageList(this).packages.apply { ... }
      content = content.replace(
        /(PackageList\(this\)\.packages\.apply\s*\{)/,
        `$1\n              add(ShareIntentPackage()) ${ MARKER }`
      );
      // Style 2: val packages = PackageList(this).packages; return packages
      if (!content.includes('ShareIntentPackage')) {
        content = content.replace(
          /(val packages = PackageList\(this\)\.packages)/,
          `$1\n          packages.add(ShareIntentPackage()) ${ MARKER }`
        );
      }
    }

    c.modResults.contents = content;
    return c;
  });
}

// Ensure onNewIntent calls setIntent() so currentActivity.intent is always fresh.
// getSharedData() reads intent directly — no extractFromIntent needed.
function ensureOnNewIntent(config) {
  return withMainActivity(config, (c) => {
    let content = c.modResults.contents;
    const MARKER = '// [withAndroidShareIntent-onNewIntent]';
    if (content.includes(MARKER)) return c;

    // If onNewIntent already exists and already calls setIntent, we're good
    if (content.includes('onNewIntent') && content.includes('setIntent')) return c;

    // Remove stale ShareIntentModule import (leftover from old approach)
    content = content.replace(/\nimport com\.delifile\.app\.ShareIntentModule\n?/g, '\n');

    // If onNewIntent exists but doesn't call setIntent, add it
    if (content.includes('onNewIntent') && !content.includes('setIntent')) {
      content = content.replace(
        /(override fun onNewIntent\(intent: Intent\?\)\s*\{[^}]*super\.onNewIntent\(intent\))/,
        `$1\n    setIntent(intent) ${ MARKER }`
      );
      c.modResults.contents = content;
      return c;
    }

    // No onNewIntent at all — add one before onCreate
    if (!content.includes('import android.content.Intent')) {
      content = content.replace(
        /^(import com\.facebook\.react\.ReactActivity)/m,
        `import android.content.Intent\n$1`
      );
    }
    content = content.replace(
      /(override fun onCreate\()/,
      `override fun onNewIntent(intent: Intent?) {\n    super.onNewIntent(intent)\n    setIntent(intent) ${ MARKER }\n  }\n\n  $1`
    );
    c.modResults.contents = content;
    return c;
  });
}
