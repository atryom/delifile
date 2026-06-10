import { Platform, NativeModules } from 'react-native';

// iOS: legacy NativeModule (@objc(ShareIntent) in Swift) — works via bridge interop
// Android: Expo Module — required for RN 0.76+ bridgeless new architecture
const ShareIntentModule: {
  getSharedData: () => Promise<any>;
  clearSharedData: () => Promise<void>;
} | null = (() => {
  if (Platform.OS === 'ios') {
    return NativeModules.ShareIntent ?? null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('share-intent').default;
  } catch {
    return null;
  }
})();

export default ShareIntentModule;
