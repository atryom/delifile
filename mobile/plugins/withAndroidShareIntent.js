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

    // Already processed (MARKER inside function body means it's been patched)
    if (content.includes(MARKER)) return c;

    // Remove stale imports left from legacy approach
    content = content.replace(/\nimport com\.delifile\.app\.ShareIntent(?:Module|Package)\n?/g, '\n');

    // Ensure android.content.Intent is imported
    if (!content.includes('import android.content.Intent')) {
      content = content.replace(
        /^(import com\.facebook\.react\.ReactActivity)/m,
        `import android.content.Intent\n$1`
      );
    }

    if (content.includes('setIntent(intent)')) {
      // Already has setIntent — just insert MARKER at end of that line
      content = content.replace(
        /(setIntent\(intent\))/,
        `$1 ${MARKER}`
      );
    } else if (content.includes('onNewIntent')) {
      // Has onNewIntent but no setIntent — inject it after super call
      content = content.replace(
        /(super\.onNewIntent\(intent\))/,
        `$1\n    setIntent(intent) ${MARKER}`
      );
    } else {
      // No onNewIntent at all — add before onCreate.
      // RN 0.79+ changed the signature from Intent? to Intent (non-nullable).
      content = content.replace(
        /(  override fun onCreate\()/,
        `  override fun onNewIntent(intent: Intent) {\n    super.onNewIntent(intent)\n    setIntent(intent) ${MARKER}\n  }\n\n  $1`
      );
    }

    c.modResults.contents = content;
    return c;
  });
};
