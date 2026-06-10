// @ts-check
// Ensures MainActivity.onNewIntent calls setIntent() so currentActivity.intent
// is always up-to-date when ShareIntentModule.getSharedData() reads it.
// The actual module registration is handled by the Expo Module auto-linking
// via the local 'share-intent' package in node_modules.
const { withMainActivity } = require('@expo/config-plugins');

module.exports = function withAndroidShareIntent(config) {
  return withMainActivity(config, (c) => {
    let content = c.modResults.contents;
    const MARKER = '// [withAndroidShareIntent]';
    if (content.includes(MARKER)) return c;

    // Remove stale ShareIntentModule/Package imports from previous approach
    content = content.replace(/\nimport com\.delifile\.app\.ShareIntent(?:Module|Package)\n?/g, '\n');

    // Ensure android.content.Intent is imported
    if (!content.includes('import android.content.Intent')) {
      content = content.replace(
        /^(import com\.facebook\.react\.ReactActivity)/m,
        `import android.content.Intent\n$1`
      );
    }

    if (content.includes('onNewIntent') && content.includes('setIntent')) {
      // Already correct — just mark as processed
      content = content.replace(
        /(override fun onNewIntent\(intent: Intent\?\))/,
        `$1 ${ MARKER }`
      );
    } else if (content.includes('onNewIntent') && !content.includes('setIntent')) {
      content = content.replace(
        /(override fun onNewIntent\(intent: Intent\?\)\s*\{\s*super\.onNewIntent\(intent\))/,
        `$1\n    setIntent(intent) ${ MARKER }`
      );
    } else {
      content = content.replace(
        /(override fun onCreate\()/,
        `override fun onNewIntent(intent: Intent?) ${ MARKER } {\n    super.onNewIntent(intent)\n    setIntent(intent)\n  }\n\n  $1`
      );
    }

    c.modResults.contents = content;
    return c;
  });
};
