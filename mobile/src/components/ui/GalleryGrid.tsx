import { useState } from 'react';
import { Alert, Dimensions, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { FileListItem } from '@/types';
import { GalleryViewer } from './GalleryViewer';

const COLUMNS = 3;
const GAP = 2;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CELL_SIZE = (SCREEN_WIDTH - GAP * (COLUMNS + 1)) / COLUMNS;

interface Props {
  files: FileListItem[];
  folderId?: string;
  onRemoved?: (fileId: string) => void;
}

export function GalleryGrid({ files, folderId, onRemoved }: Props) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const media = files.filter(
    (f) => f.content_kind === 'binary_file' && f.mime_type &&
           (f.mime_type.startsWith('image/') || f.mime_type.startsWith('video/'))
  );

  function handleLongPress(file: FileListItem) {
    const name = file.display_name ?? file.original_name;
    const options: Array<{ text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }> = [
      {
        text: 'Открыть детали',
        onPress: () => router.push(`/(app)/files/${file.id}` as any),
      },
    ];

    if (onRemoved && folderId) {
      options.push({
        text: 'Убрать из папки',
        style: 'destructive',
        onPress: () => onRemoved(file.id),
      });
    }

    options.push({ text: 'Отмена', style: 'cancel' });

    Alert.alert(name, undefined, options);
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={media}
        keyExtractor={(item) => item.id}
        numColumns={COLUMNS}
        contentContainerStyle={styles.grid}
        renderItem={({ item, index }) => (
          <Pressable
            style={styles.cell}
            onPress={() => setViewerIndex(index)}
            onLongPress={() => handleLongPress(item)}
            delayLongPress={500}
            android_ripple={{ color: 'rgba(0,0,0,0.1)', borderless: false }}
          >
            <Image
              source={{ uri: item.preview_url ?? undefined }}
              style={styles.thumbnail}
              contentFit="cover"
              transition={150}
              placeholderContentFit="cover"
            />
            {item.mime_type?.startsWith('video/') && (
              <View style={styles.videoOverlay}>
                <View style={styles.playIcon} />
              </View>
            )}
          </Pressable>
        )}
      />

      {viewerIndex !== null && (
        <GalleryViewer
          files={media}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  grid: { padding: GAP },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    margin: GAP / 2,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  thumbnail: { width: '100%', height: '100%' },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  playIcon: {
    width: 0,
    height: 0,
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderLeftWidth: 18,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'rgba(255,255,255,0.9)',
    marginLeft: 4,
  },
});
