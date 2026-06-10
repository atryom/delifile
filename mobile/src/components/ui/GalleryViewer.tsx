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
import { Audio, ResizeMode, Video } from 'expo-av';
import type { FileListItem } from '@/types';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface Props {
  files: FileListItem[];
  initialIndex: number;
  onClose: () => void;
}

// Only renders the video when this slide is active — avoids multiple players competing
function VideoSlide({ uri, isActive }: { uri: string; isActive: boolean }) {
  useEffect(() => {
    if (isActive && uri) {
      Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false }).catch(() => {});
    }
  }, [isActive, uri]);

  if (!uri || !isActive) {
    return <View style={styles.media} />;
  }
  return (
    <Video
      source={{ uri }}
      style={styles.media}
      resizeMode={ResizeMode.CONTAIN}
      useNativeControls
    />
  );
}

export function GalleryViewer({ files, initialIndex, onClose }: Props) {
  const listRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    // Scroll to initial index after mount with a small delay
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({ index: initialIndex, animated: false });
    }, 50);
    return () => clearTimeout(timer);
  }, [initialIndex]);

  const isVideo = (f: FileListItem) => !!f.mime_type?.startsWith('video/');

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
          // Keep fewer items in memory to avoid multiple video players
          windowSize={3}
          maxToRenderPerBatch={1}
          renderItem={({ item, index }) => (
            <View style={styles.page}>
              {isVideo(item) ? (
                <VideoSlide
                  uri={item.view_url ?? item.preview_url ?? ''}
                  isActive={index === currentIndex}
                />
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
        <View style={styles.counter} pointerEvents="none">
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
