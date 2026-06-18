// @ts-check
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withAppDelegateRCTBridgeFix(config) {
  return withDangerousMod(config, [
    'ios',
    (c) => {
      const appDelegatePath = path.join(
        c.modRequest.platformProjectRoot,
        c.modRequest.projectName,
        'AppDelegate.swift'
      );
      if (!fs.existsSync(appDelegatePath)) return c;

      let src = fs.readFileSync(appDelegatePath, 'utf8');

      const MARKER = '/* [withAppDelegateRCTBridgeFix] patched */';
      if (src.includes(MARKER)) return c;

      src = src.replace(
        /\n  override func sourceURL\(for bridge: RCTBridge\) -> URL\? \{\s*\n\s*\/\/ needed to return the correct URL for expo-dev-client\.\s*\n\s*bridge\.bundleURL \?\? bundleURL\(\)\s*\n\s*\}\s*\n/m,
        '\n'
      );

      src = src.replace(
        /(class ReactNativeDelegate: ExpoReactNativeFactoryDelegate \{)/,
        `$1\n  ${MARKER}`
      );

      fs.writeFileSync(appDelegatePath, src);
      return c;
    },
  ]);
};