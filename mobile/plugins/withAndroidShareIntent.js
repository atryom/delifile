// @ts-check
const { withMainActivity, withMainApplication, withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

module.exports = function withAndroidShareIntent(config) {
  config = copyKotlinSources(config);
  config = patchMainApplication(config);
  config = patchMainActivity(config);
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
    const MARKER = '// [withAndroidShareIntent] package registered';
    if (content.includes(MARKER)) return c;

    // Add import
    if (!content.includes('import com.delifile.app.ShareIntentPackage')) {
      content = content.replace(
        /^(package com\.delifile\.app)/m,
        '$1\n\nimport com.delifile.app.ShareIntentPackage'
      );
    }

    // Inject package into getPackages()
    content = content.replace(
      /(val packages = PackageList\(this\)\.packages)/,
      `$1\n          packages.add(ShareIntentPackage()) ${ MARKER }`
    );

    c.modResults.contents = content;
    return c;
  });
}

// Patch MainActivity.kt — call extractFromIntent on create and new intent
function patchMainActivity(config) {
  return withMainActivity(config, (c) => {
    let content = c.modResults.contents;
    const MARKER = '// [withAndroidShareIntent] extract';
    if (content.includes(MARKER)) return c;

    // Add imports
    const importBlock = [
      'import android.content.Intent',
      'import com.delifile.app.ShareIntentModule',
    ];
    for (const imp of importBlock) {
      if (!content.includes(imp)) {
        content = content.replace(
          /^(import com\.facebook\.react\.ReactActivity)/m,
          `${imp}\n$1`
        );
      }
    }

    // Add onNewIntent override before onCreate
    if (!content.includes('onNewIntent')) {
      content = content.replace(
        /(override fun onCreate\()/,
        `override fun onNewIntent(intent: Intent?) {\n    super.onNewIntent(intent)\n    ShareIntentModule.extractFromIntent(intent, applicationContext) ${MARKER}\n  }\n\n  $1`
      );
    }

    // Patch onCreate — add extractFromIntent after super.onCreate
    content = content.replace(
      /(super\.onCreate\(savedInstanceState\))/,
      `$1\n    ShareIntentModule.extractFromIntent(intent, applicationContext) ${MARKER}`
    );

    c.modResults.contents = content;
    return c;
  });
}
