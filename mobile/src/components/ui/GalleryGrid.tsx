import { useState } from 'react';
import { Dimensions, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import type { FileListItem } from '@/types';
import { GalleryViewer } from './GalleryViewer';

const COLUMNS = 3;
const GAP = 2;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CELL_SIZE = (SCREEN_WIDTH - GAP * (COLUMNS + 1)) / COLUMNS;

interface Props {
  files: FileListItem[];
}

export function GalleryGrid({ files }: Props) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const media = files.filter(
    (f) => f.content_kind === 'binary_file' && f.mime_type && (f.mime_type.startsWith('image/') || f.mime_type.startsWith('video/'))
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={media}
        keyExtractor={(item) => item.id}
        numColumns={COLUMNS}
        contentContainerStyle={styles.grid}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={styles.cell}
            onPress={() => setViewerIndex(index)}
            activeOpacity={0.85}
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
          </TouchableOpacity>
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
