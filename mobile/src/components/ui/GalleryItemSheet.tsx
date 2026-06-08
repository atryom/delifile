import { useState, useRef } from 'react';
import {
  Dimensions, Modal, SafeAreaView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Image } from 'expo-image';
import { ResizeMode, Video } from 'expo-av';
import { router } from 'expo-router';
import type { FileListItem } from '@/types';
import { filesApi } from '@/api/files';
import { formatDateTime } from '@/utils/format';

const { width: W } = Dimensions.get('window');
const MEDIA_HEIGHT = Math.min(Math.round(Dimensions.get('window').height * 0.52), W);
const DOUBLE_TAP_DELAY = 300;

interface Props {
  files: FileListItem[];
  initialIndex: number;
  onClose: () => void;
  folderId?: string;
  onRemoved?: (fileId: string) => void;
}

export function GalleryItemSheet({ files, initialIndex, onClose, folderId, onRemoved }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const [fullscreen, setFullscreen] = useState(false);
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [likesMap, setLikesMap] = useState<Record<string, number>>({});
  const lastTapRef = useRef<number>(0);

  const file = files[index];
  if (!file) return null;

  const isVideo = file.mime_type?.startsWith('video/');
  const isLiked = likedMap[file.id] ?? file.is_liked ?? false;
  const likesCount = likesMap[file.id] ?? file.likes_count ?? 0;

  async function toggleLike() {
    const newLiked = !isLiked;
    const newCount = likesCount + (newLiked ? 1 : -1);
    setLikedMap((m) => ({ ...m, [file.id]: newLiked }));
    setLikesMap((m) => ({ ...m, [file.id]: newCount }));
    try {
      if (newLiked) await filesApi.like(file.id);
      else await filesApi.unlike(file.id);
    } catch {
      setLikedMap((m) => ({ ...m, [file.id]: isLiked }));
      setLikesMap((m) => ({ ...m, [file.id]: likesCount }));
    }
  }

  function handleMediaTap() {
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // double tap — toggle fullscreen
      setFullscreen((f) => !f);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  }

  function goComments() {
    onClose();
    router.push({
      pathname: '/(app)/files/comments',
      params: { targetType: 'file', targetId: file.id, targetName: file.display_name ?? file.original_name },
    } as any);
  }

  function goDetails() {
    onClose();
    router.push(`/(app)/files/${file.id}` as any);
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        {/* Header — hidden in fullscreen */}
        {!fullscreen && (
          <View style={styles.header}>
            <Text style={styles.counter}>{index + 1} / {files.length}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Media — double-tap toggles fullscreen */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={handleMediaTap}
          style={[styles.mediaBox, fullscreen && styles.mediaBoxFull]}
        >
          {isVideo ? (
            <Video
              source={{ uri: file.view_url ?? file.preview_url ?? '' }}
              style={styles.media}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
            />
          ) : (
            <Image
              source={{ uri: file.view_url ?? file.preview_url ?? undefined }}
              style={styles.media}
              contentFit={fullscreen ? 'contain' : 'contain'}
              transition={100}
            />
          )}

          {index > 0 && (
            <TouchableOpacity style={[styles.navBtn, styles.navLeft]} onPress={() => setIndex((i) => i - 1)}>
              <Text style={styles.navText}>‹</Text>
            </TouchableOpacity>
          )}
          {index < files.length - 1 && (
            <TouchableOpacity style={[styles.navBtn, styles.navRight]} onPress={() => setIndex((i) => i + 1)}>
              <Text style={styles.navText}>›</Text>
            </TouchableOpacity>
          )}

          {/* Fullscreen close hint */}
          {fullscreen && (
            <TouchableOpacity style={styles.fullscreenClose} onPress={() => setFullscreen(false)}>
              <Text style={styles.fullscreenCloseText}>✕</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* Info panel — compact two-row layout, hidden in fullscreen */}
        {!fullscreen && (
          <View style={styles.info}>
            {/* Row 1: name + date + like */}
            <View style={styles.infoRow}>
              <View style={styles.infoTexts}>
                <Text style={styles.fileName} numberOfLines={1}>{file.display_name ?? file.original_name}</Text>
                {file.uploaded_at && (
                  <Text style={styles.fileMeta}>{formatDateTime(file.uploaded_at)}</Text>
                )}
              </View>
              <TouchableOpacity style={styles.likeBtn} onPress={toggleLike} activeOpacity={0.7}>
                <Text style={[styles.likeHeart, isLiked && styles.likeHeartActive]}>
                  {isLiked ? '♥' : '♡'}
                </Text>
                {likesCount > 0 && (
                  <Text style={[styles.likeCount, isLiked && styles.likeCountActive]}>{likesCount}</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Row 2: action buttons */}
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={goComments} activeOpacity={0.8}>
                <Text style={styles.actionBtnText}>
                  💬{(file.comments_count ?? 0) > 0 ? ` ${file.comments_count}` : ' Комментарии'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionBtn} onPress={goDetails} activeOpacity={0.8}>
                <Text style={styles.actionBtnText}>Детали →</Text>
              </TouchableOpacity>

              {onRemoved && folderId && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnDanger]}
                  onPress={() => { onClose(); onRemoved(file.id); }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionBtnDangerText}>Убрать</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  counter: { fontSize: 13, color: '#94A3B8' },
  closeBtn: { fontSize: 20, color: '#64748B', paddingHorizontal: 4 },

  mediaBox: {
    backgroundColor: '#000',
    width: W,
    height: MEDIA_HEIGHT,
    position: 'relative',
  },
  mediaBoxFull: {
    flex: 1,
    height: undefined,
  },
  media: { width: '100%', height: '100%' },

  navBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLeft: { left: 8 },
  navRight: { right: 8 },
  navText: { color: '#fff', fontSize: 28, lineHeight: 32, fontWeight: '300' },

  fullscreenClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 18,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenCloseText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  info: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoTexts: { flex: 1 },
  fileName: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  fileMeta: { fontSize: 12, color: '#94A3B8', marginTop: 1 },

  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  likeHeart: { fontSize: 22, color: '#CBD5E1' },
  likeHeartActive: { color: '#EF4444' },
  likeCount: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  likeCountActive: { color: '#EF4444' },

  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  actionBtnText: { fontSize: 13, color: '#2563EB', fontWeight: '500' },
  actionBtnDanger: { borderColor: '#FCA5A5', backgroundColor: '#FFF5F5' },
  actionBtnDangerText: { fontSize: 13, color: '#EF4444', fontWeight: '500' },
});
