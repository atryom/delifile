import { useEffect, useState } from 'react';
import { NativeModules, Platform } from 'react-native';

export interface ShareIntentData {
  type: 'text' | 'file';
  // text share
  text?: string;
  // file share
  uri?: string;
  mimeType?: string;
  fileName?: string;
}

export function useShareIntent(onData: (data: ShareIntentData) => void) {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const mod = NativeModules.ShareIntent;
    if (!mod) return;

    mod.getSharedData().then((data: ShareIntentData | null) => {
      if (!data) return;
      mod.clearSharedData().catch(() => {});
      onData(data);
    }).catch(() => {});
  }, []);
}
