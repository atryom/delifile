import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = 'device_id';

function generateUuid(): string {
  return Crypto.randomUUID();
}

export async function getDeviceId(): Promise<string> {
  let id = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (!id) {
    id = generateUuid();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  }
  return id;
}

export function getDeviceType(): string {
  return Platform.OS; // 'android' | 'ios' | 'web'
}

export function getDeviceName(): string {
  const model = Device.modelName;
  if (model) return model;
  return Platform.OS === 'android' ? 'Android Device' : 'iOS Device';
}
