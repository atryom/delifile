import { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { ResizeMode, Video } from 'expo-av';
import type { FileListItem } from '@/types';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface Props {
  files: FileListItem[];
  initialIndex: number;
  onClose: () => void;
}

function VideoItem({ uri }: { uri: string }) {
  if (!uri) return null;
  return (
    <Video
      source={{ uri }}
      style={styles.media}
      resizeMode={ResizeMode.CONTAIN}
      useNativeControls
      shouldPlay
    />
  );
}

export function GalleryViewer({ files, initialIndex, onClose }: Props) {
  const listRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    listRef.current?.scrollToIndex({ index: initialIndex, animated: false });
  }, [initialIndex]);

  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <StatusBar hidden />

        <FlatList
          ref={listRef}
          data={files}
          keyExtractor={(f) => f.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
            setCurrentIndex(idx);
          }}
          renderItem={({ item }) => (
            <View style={styles.page}>
              {item.mime_type?.startsWith('video/') ? (
                <VideoItem uri={item.view_url ?? item.preview_url ?? ''} />
              ) : (
                <Image
                  source={{ uri: item.view_url ?? item.preview_url ?? undefined }}
                  style={styles.media}
                  contentFit="contain"
                  transition={100}
                />
              )}
            </View>
          )}
        />

        {/* Counter */}
        <View style={styles.counter}>
          <Text style={styles.counterText}>{currentIndex + 1} / {files.length}</Text>
        </View>

        {/* Close button */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000',
  },
  page: {
    width: SCREEN_W,
    height: SCREEN_H,
    justifyContent: 'center',
    alignItems: 'center',
  },
  media: {
    width: SCREEN_W,
    height: SCREEN_H,
  },
  counter: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 48 : 24,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  counterText: {
    color: '#fff',
    fontSize: 14,
  },
  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 24,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
