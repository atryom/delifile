// @ts-check
const { withXcodeProject, withEntitlementsPlist, withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs   = require('fs');

const APP_GROUP_ID       = 'group.com.delifile.app';
const EXTENSION_NAME     = 'ShareExtension';
const EXTENSION_BUNDLEID = 'com.delifile.app.ShareExtension';
const DEPLOYMENT_TARGET  = '15.1';
const SWIFT_VERSION      = '5.0';

// addTarget stores the target name quoted: '"ShareExtension"'
// updateBuildProperty searches by comment, so we need the quoted form too.
const EXTENSION_NAME_QUOTED = `"${EXTENSION_NAME}"`;

// ─── Entry point ─────────────────────────────────────────────────────────────
module.exports = function withShareExtension(config) {
  config = fixResourceBundleSigning(config);
  config = addAppGroupToMainApp(config);
  config = addShareExtensionTarget(config);
  config = syncShareExtensionVersion(config);
  return config;
};

// ─── 0. Podfile: disable code-signing for resource bundle targets ────────────
// Xcode 14+ signs resource bundles by default. CocoaPods pod dependencies
// often create .bundle targets without a development team, breaking the build.
// Inserted inside react_native_post_install's post_install block to avoid
// the CocoaPods multiple-hook ordering issues on EAS servers.
function fixResourceBundleSigning(config) {
  return withDangerousMod(config, [
    'ios',
    (c) => {
      const podfilePath = path.join(c.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) return c;
      let podfile = fs.readFileSync(podfilePath, 'utf8');
      const MARKER = '# [withShareExtension] CODE_SIGNING_ALLOWED';
      if (podfile.includes(MARKER)) return c;
      // Insert before the closing 'end' of the react_native_post_install call block.
      // The template always ends the post_install block with exactly this pattern.
      const insertBefore = '  end\nend\n';
      const insertIdx = podfile.lastIndexOf(insertBefore);
      if (insertIdx === -1) return c;
      const fix = `    ${MARKER}
    installer.pods_project.targets.each do |target|
      if target.respond_to?(:product_type) && target.product_type == "com.apple.product-type.bundle"
        target.build_configurations.each do |cfg|
          cfg.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
        end
      end
    end
`;
      podfile = podfile.slice(0, insertIdx) + fix + podfile.slice(insertIdx);
      fs.writeFileSync(podfilePath, podfile);
      return c;
    },
  ]);
}

// ─── 1. App Group entitlement for the main app ───────────────────────────────
function addAppGroupToMainApp(config) {
  return withEntitlementsPlist(config, (c) => {
    const key      = 'com.apple.security.application-groups';
    const existing = c.modResults[key] || [];
    if (!existing.includes(APP_GROUP_ID)) {
      c.modResults[key] = [...existing, APP_GROUP_ID];
    }
    return c;
  });
}

// ─── 2. Share Extension Xcode target ─────────────────────────────────────────
function addShareExtensionTarget(config) {
  return withXcodeProject(config, (c) => {
    const project     = c.modResults;
    const projectRoot = c.modRequest.projectRoot;
    const projectName = c.modRequest.projectName;
    const iosRoot     = path.join(projectRoot, 'ios');
    const pluginSrc   = path.join(projectRoot, 'plugins', 'share-extension');

    // ── Idempotency ──────────────────────────────────────────────────────────
    const targets = project.pbxNativeTargetSection();
    const alreadyAdded = Object.values(targets).some(
      (t) => t && (t.name === EXTENSION_NAME || t.name === EXTENSION_NAME_QUOTED)
    );
    if (alreadyAdded) return c;

    // ── Copy files ───────────────────────────────────────────────────────────
    const extDir = path.join(iosRoot, EXTENSION_NAME);
    fs.mkdirSync(extDir, { recursive: true });
    for (const f of ['ShareViewController.swift', 'Info.plist', 'ShareExtension.entitlements']) {
      const src = path.join(pluginSrc, f);
      if (fs.existsSync(src)) fs.copyFileSync(src, path.join(extDir, f));
    }

    const mainAppDir = path.join(iosRoot, projectName);
    for (const f of ['ShareIntentModule.swift', 'ShareIntentModule.m']) {
      const src = path.join(pluginSrc, f);
      if (fs.existsSync(src)) fs.copyFileSync(src, path.join(mainAppDir, f));
    }

    // ── Group for the extension ───────────────────────────────────────────────
    // NOTE: do NOT pass empty string as path — it serializes as "path = ;" (invalid pbxproj).
    // The group gets path = "ShareExtension"; file refs added below are therefore
    // group-relative (basename only) so Xcode resolves ShareExtension/<file>.
    const extGroup = project.addPbxGroup([], EXTENSION_NAME, EXTENSION_NAME, '"<group>"');

    // Attach extension group to the project root main group
    const pbxProjSection = project.pbxProjectSection();
    const rootProjKey    = Object.keys(pbxProjSection).find((k) => !k.endsWith('_comment'));
    if (rootProjKey) {
      const rootMainGroupUUID = pbxProjSection[rootProjKey].mainGroup;
      project.addToPbxGroup({ fileRef: extGroup.uuid, basename: EXTENSION_NAME }, rootMainGroupUUID);
    }

    // ── Main app group key (for native-module files) ─────────────────────────
    const mainGroupKey = project.findPBXGroupKey({ name: projectName });
    const mainTarget   = project.getFirstTarget();

    // addSourceFile with a group key uses addFile() internally — avoids the
    // addPluginFile → correctForPluginsPath → crash on missing Plugins group.
    project.addSourceFile(
      `${projectName}/ShareIntentModule.swift`,
      { target: mainTarget.uuid },
      mainGroupKey
    );
    project.addSourceFile(
      `${projectName}/ShareIntentModule.m`,
      { target: mainTarget.uuid },
      mainGroupKey
    );

    // ── Extension target ──────────────────────────────────────────────────────
    const extTarget = project.addTarget(
      EXTENSION_NAME,
      'app_extension',
      EXTENSION_NAME,
      EXTENSION_BUNDLEID
    );

    // ── Build phases ──────────────────────────────────────────────────────────
    project.addBuildPhase([], 'PBXSourcesBuildPhase',    'Sources',    extTarget.uuid);
    project.addBuildPhase([], 'PBXResourcesBuildPhase',  'Resources',  extTarget.uuid);
    project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', extTarget.uuid);

    // Swift source — group key bypasses addPluginFile crash.
    // The extGroup already carries path = "ShareExtension" (see addPbxGroup above),
    // so file refs inside it must be group-relative (basename only). Passing the
    // full "ShareExtension/…" path here doubles it → Xcode resolves
    // ShareExtension/ShareExtension/ShareViewController.swift and fails with
    // "Build input file cannot be found".
    project.addSourceFile(
      'ShareViewController.swift',
      { target: extTarget.uuid },
      extGroup.uuid
    );

    // Info.plist is handled via INFOPLIST_FILE build setting — do NOT add to
    // Resources build phase, or Xcode outputs the same file twice (duplicate
    // output for ProcessInfoPlistFile → archive fails with exit 65).
    // addFile only adds a navigator reference so the file is visible in Xcode.
    project.addFile(
      'Info.plist',
      extGroup.uuid,
      { lastKnownFileType: 'text.plist.xml' }
    );

    // ── Build settings ────────────────────────────────────────────────────────
    // addTarget stores name as '"ShareExtension"'; updateBuildProperty searches
    // by that exact comment string, so we must pass the quoted form.
    const setExt = (prop, value) =>
      project.updateBuildProperty(prop, value, null, EXTENSION_NAME_QUOTED);

    setExt('INFOPLIST_FILE',             `"${EXTENSION_NAME}/Info.plist"`);
    setExt('CODE_SIGN_ENTITLEMENTS',     `"${EXTENSION_NAME}/ShareExtension.entitlements"`);
    setExt('SWIFT_VERSION',              SWIFT_VERSION);
    setExt('IPHONEOS_DEPLOYMENT_TARGET', DEPLOYMENT_TARGET);
    setExt('TARGETED_DEVICE_FAMILY',     '"1"');
    setExt('SKIP_INSTALL',               'YES');
    setExt('LD_RUNPATH_SEARCH_PATHS',
      '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"');

    // EAS requires DEVELOPMENT_TEAM on every target (including extensions).
    // Without it, xcodebuild fails: "Signing for ShareExtension requires a development team".
    // Read from eas.json → submit.production.ios.appleTeamId.
    // CODE_SIGN_STYLE = Automatic lets EAS auto-provision the extension profile
    // (no separate eas credentials setup required for the extension bundle ID).
    try {
      const easJson = JSON.parse(
        fs.readFileSync(path.join(projectRoot, 'eas.json'), 'utf8')
      );
      const teamId = easJson?.submit?.production?.ios?.appleTeamId;
      if (teamId) setExt('DEVELOPMENT_TEAM', teamId);
    } catch (_) {}
    setExt('CODE_SIGN_STYLE', 'Manual');
    // Empty string overrides EAS's project-level PROVISIONING_PROFILE_SPECIFIER
    // (which would otherwise point to the main app's profile, missing App Groups).
    // With an empty specifier, Xcode auto-selects the matching profile from the keychain.
    setExt('PROVISIONING_PROFILE_SPECIFIER', '""');

    return c;
  });
}

// ─── 3. Sync ShareExtension version with main app ────────────────────────────
// EAS updates ios/DeliFile/Info.plist but not the extension's Info.plist.
// Mismatched CFBundleShortVersionString causes App Store rejection.
function syncShareExtensionVersion(config) {
  return withDangerousMod(config, [
    'ios',
    (c) => {
      const version = c.version;
      if (!version) return c;
      const plistPath = path.join(c.modRequest.platformProjectRoot, EXTENSION_NAME, 'Info.plist');
      if (!fs.existsSync(plistPath)) return c;
      let plist = fs.readFileSync(plistPath, 'utf8');
      plist = plist.replace(
        /(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]*(<\/string>)/,
        `$1${version}$2`
      );
      fs.writeFileSync(plistPath, plist);
      return c;
    },
  ]);
}