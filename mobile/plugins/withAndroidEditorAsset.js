// @ts-check
const { withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

module.exports = function withAndroidEditorAsset(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const src = path.resolve(__dirname, '../assets/editor/editor.html');
      const dest = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/assets/editor.html');
      const destDir = path.dirname(dest);
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(src, dest);
      return cfg;
    },
  ]);
};
