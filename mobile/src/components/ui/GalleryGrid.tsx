import { useState } from 'react';
import { Alert, Dimensions, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { FileListItem } from '@/types';
import { GalleryItemSheet } from './GalleryItemSheet';

const COLUMNS = 3;
const GAP = 2;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CELL_SIZE = (SCREEN_WIDTH - GAP * (COLUMNS + 1)) / COLUMNS;

export type LikesMap = Record<string, { liked: boolean; count: number }>;

interface Props {
  files: FileListItem[];
  folderId?: string;
  onRemoved?: (fileId: string) => void;
}

export function GalleryGrid({ files, folderId, onRemoved }: Props) {
  const [sheetIndex, setSheetIndex] = useState<number | null>(null);
  // Persists like state across sheet open/close within this gallery session
  const [localLikes, setLocalLikes] = useState<LikesMap>({});

  const media = files.filter(
    (f) => f.content_kind === 'binary_file' && f.mime_type &&
           (f.mime_type.startsWith('image/') || f.mime_type.startsWith('video/'))
  );

  function onLikeChange(fileId: string, liked: boolean, count: number) {
    setLocalLikes((prev) => ({ ...prev, [fileId]: { liked, count } }));
  }

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
        renderItem={({ item, index }) => {
          const likeCount = localLikes[item.id]?.count ?? item.likes_count ?? 0;
          const commentCount = item.comments_count ?? 0;
          const showOverlay = likeCount > 0 || commentCount > 0;

          return (
            <Pressable
              style={styles.cell}
              onPress={() => setSheetIndex(index)}
              onLongPress={() => handleLongPress(item)}
              delayLongPress={500}
              android_ripple={{ color: 'rgba(0,0,0,0.2)', borderless: false }}
            >
              <Image
                source={{ uri: item.preview_url ?? undefined }}
                style={styles.thumbnail}
                contentFit="cover"
                transition={0}
                recyclingKey={item.id}
                placeholderContentFit="cover"
              />

              {/* Video badge */}
              {item.mime_type?.startsWith('video/') && (
                <View style={styles.videoBadge}>
                  <View style={styles.playTriangle} />
                </View>
              )}

              {/* Stats overlay: only shown when there's something to display */}
              {showOverlay && (
                <View style={styles.statsOverlay}>
                  {likeCount > 0 && (
                    <View style={styles.stat}>
                      <Text style={styles.statText}>♥ {likeCount}</Text>
                    </View>
                  )}
                  {commentCount > 0 && (
                    <View style={styles.stat}>
                      <Text style={styles.statText}>💬 {commentCount}</Text>
                    </View>
                  )}
                </View>
              )}
            </Pressable>
          );
        }}
      />

      {sheetIndex !== null && (
        <GalleryItemSheet
          files={media}
          initialIndex={sheetIndex}
          onClose={() => setSheetIndex(null)}
          folderId={folderId}
          onRemoved={onRemoved}
          localLikes={localLikes}
          onLikeChange={onLikeChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  grid: { paddingBottom: 8 },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    margin: GAP / 2,
    backgroundColor: '#111',
    overflow: 'hidden',
  },
  thumbnail: { width: '100%', height: '100%' },

  videoBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
  },
  playTriangle: {
    width: 0,
    height: 0,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderLeftWidth: 12,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'rgba(255,255,255,0.9)',
  },

  statsOverlay: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    right: 5,
    flexDirection: 'row',
    gap: 8,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
