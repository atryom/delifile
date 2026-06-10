import { requireNativeModule } from 'expo-modules-core';

export interface ShareData {
  type: 'text' | 'file';
  text?: string;
  uri?: string;
  fileName?: string;
  mimeType?: string;
}

interface ShareIntentType {
  getSharedData(): Promise<ShareData | null>;
  clearSharedData(): Promise<void>;
}

export default requireNativeModule<ShareIntentType>('ShareIntent');
