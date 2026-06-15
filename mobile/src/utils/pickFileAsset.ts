import { Platform, ActionSheetIOS, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

export interface FileAsset {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
}

async function fromDocumentPicker(): Promise<FileAsset | null> {
  const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.name,
    size: asset.size ?? 0,
    mimeType: asset.mimeType ?? 'application/octet-stream',
  };
}

async function fromImageLibrary(): Promise<FileAsset | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      'Нет доступа к медиатеке',
      'Разрешите доступ к Фото в Настройках → Конфиденциальность → Фото',
      [{ text: 'OK' }],
    );
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.All,
    allowsMultipleSelection: false,
    quality: 1,
    exif: false,
  });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  const name = asset.fileName ?? asset.uri.split('/').pop() ?? 'media';
  const mimeType = asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
  return {
    uri: asset.uri,
    name,
    size: asset.fileSize ?? 0,
    mimeType,
  };
}

export function pickFileAsset(): Promise<FileAsset | null> {
  if (Platform.OS !== 'ios') {
    return fromDocumentPicker();
  }

  return new Promise((resolve) => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Медиатека', 'Файлы', 'Отмена'],
        cancelButtonIndex: 2,
      },
      async (index) => {
        if (index === 2) { resolve(null); return; }
        if (index === 0) {
          resolve(await fromImageLibrary());
        } else {
          resolve(await fromDocumentPicker());
        }
      },
    );
  });
}
