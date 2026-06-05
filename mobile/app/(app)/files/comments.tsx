import { useEffect, useRef, useState } from 'react';
import {
  Alert, FlatList, Keyboard, StyleSheet, Text, TextInput,
  TouchableOpacity, View, Animated,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { commentsApi } from '@/api/comments';
import type {
  Comment, CommentScope, CommentTargetType,
  CommentThread, CommentThreadsResult,
} from '@/types/comment';
import { Spinner } from '@/components/ui/Spinner';
import { formatDateTime } from '@/utils/format';
import { getApiError } from '@/utils/error';

type Tab = 'shared' | 'private';

export default function CommentsScreen() {
  const params = useLocalSearchParams<{
    targetType: string;
    targetId: string;
    targetName?: string;
    contextSharedFolderId?: string;
  }>();

  const targetType = params.targetType as CommentTargetType;
  const targetId = params.targetId;
  const targetName = params.targetName ?? 'Комментарии';
  const contextSharedFolderId = params.contextSharedFolderId;

  const [threadsInfo, setThreadsInfo] = useState<CommentThreadsResult | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('shared');
  const [thread, setThread] = useState<CommentThread | null>(null);
  const [loadingPhase, setLoadingPhase] = useState<'init' | 'thread' | 'ready' | 'error'>('init');

  // Input
  const [inputText, setInputText] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; authorName: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const kbOffset = useRef(new Animated.Value(0)).current;

  // Refs for stable access inside Alert/async callbacks — avoids stale closures
  const threadsInfoRef = useRef(threadsInfo);
  const activeTabRef = useRef(activeTab);
  threadsInfoRef.current = threadsInfo;
  activeTabRef.current = activeTab;

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      kbOffset.setValue(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      kbOffset.setValue(0);
    });
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Load thread info
  useEffect(() => {
    setLoadingPhase('init');
    commentsApi.getThreads(targetType, targetId, contextSharedFolderId)
      .then((res) => {
        const info = res.data.data;
        setThreadsInfo(info);
        // Default to shared if available, otherwise private
        const defaultTab: Tab = info.policy.shared_comments_allowed ? 'shared' : 'private';
        setActiveTab(defaultTab);
        setLoadingPhase('thread');
        return loadThread(defaultTab, info);
      })
      .catch(() => setLoadingPhase('error'));
  }, [targetId]);

  async function loadThread(tab: Tab, info?: CommentThreadsResult) {
    const src = info ?? threadsInfoRef.current;
    if (!src) return;
    setLoadingPhase('thread');
    const summary = tab === 'shared' ? src.threads.shared : src.threads.private;
    if (!summary) {
      setThread(null);
      setLoadingPhase('ready');
      return;
    }
    try {
      const res = await commentsApi.getThread(summary.id);
      setThread(res.data.data.thread);
      // Mark as read
      commentsApi.markRead(summary.id).catch(() => {});
    } catch {
      setThread(null);
    }
    setLoadingPhase('ready');
  }

  function switchTab(tab: Tab) {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setReplyTo(null);
    setInputText('');
    setEditingId(null);
    loadThread(tab);
  }

  async function handleSend() {
    const body = inputText.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      if (thread) {
        await commentsApi.addComment({
          threadId: thread.id,
          body,
          parentCommentId: replyTo?.id,
        });
      } else {
        // First comment — auto-create thread
        const scope: CommentScope = activeTab;
        await commentsApi.addComment({
          targetType,
          targetId,
          scope,
          body,
          contextSharedFolderId,
        });
      }
      setInputText('');
      setReplyTo(null);
      // Refresh threads info so the newly created thread ID is known, then load it
      const infoRes = await commentsApi.getThreads(targetType, targetId, contextSharedFolderId);
      const freshInfo = infoRes.data.data;
      setThreadsInfo(freshInfo);
      await loadThread(activeTabRef.current, freshInfo);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      Alert.alert('Ошибка', getApiError(e, 'Не удалось отправить комментарий'));
    } finally {
      setSending(false);
    }
  }

  async function handleEditSave(id: string) {
    const body = editText.trim();
    if (!body) return;
    try {
      await commentsApi.editComment(id, body);
      setEditingId(null);
      setEditText('');
      loadThread(activeTabRef.current);
    } catch {
      Alert.alert('Ошибка', 'Не удалось сохранить изменения');
    }
  }

  async function doDeleteComment(id: string) {
    setDeletingId(id);
    setDeleteError(null);
    try {
      await commentsApi.deleteComment(id);
      // Update local state directly — remove the deleted comment (or reply) immediately
      setThread((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items
            .filter((c) => c.id !== id)
            .map((c) => ({
              ...c,
              replies: (c.replies ?? []).filter((r) => r.id !== id),
            })),
        };
      });
    } catch (e) {
      setDeleteError(getApiError(e, 'Не удалось удалить комментарий'));
    } finally {
      setDeletingId(null);
    }
  }

  function handleDeleteComment(id: string) {
    Alert.alert('Удалить комментарий?', 'Это действие нельзя отменить.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: () => doDeleteComment(id) },
    ]);
  }

  // Flatten comments + replies into a single list for FlatList
  function buildFlatList(items: Comment[]): Array<{ comment: Comment; isReply: boolean }> {
    const flat: Array<{ comment: Comment; isReply: boolean }> = [];
    for (const c of items) {
      if (c.is_deleted) continue;
      flat.push({ comment: c, isReply: false });
      for (const r of c.replies ?? []) {
        if (!r.is_deleted) flat.push({ comment: r, isReply: true });
      }
    }
    return flat;
  }

  const canWrite = activeTab === 'private'
    || (threadsInfo?.policy.can_write_shared ?? false);

  const showSharedTab = threadsInfo?.policy.shared_comments_allowed ?? false;
  const sharedUnread = threadsInfo?.threads.shared?.unread_count ?? 0;
  const privateUnread = threadsInfo?.threads.private?.unread_count ?? 0;

  const flatItems = thread ? buildFlatList(thread.items) : [];

  function renderComment({ item }: { item: { comment: Comment; isReply: boolean } }) {
    const { comment, isReply } = item;

    if (editingId === comment.id) {
      return (
        <View style={[styles.commentCard, isReply && styles.replyCard]}>
          <TextInput
            style={styles.editInput}
            value={editText}
            onChangeText={setEditText}
            multiline
            autoFocus
          />
          <View style={styles.editActions}>
            <TouchableOpacity onPress={() => handleEditSave(comment.id)} style={styles.editSaveBtn}>
              <Text style={styles.editSaveText}>Сохранить</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setEditingId(null); setEditText(''); }} style={styles.editCancelBtn}>
              <Text style={styles.editCancelText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.commentCard, isReply && styles.replyCard]}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentAuthor}>{comment.author?.name ?? '—'}</Text>
          {comment.edited_at && <Text style={styles.commentEdited}>изменён</Text>}
          <Text style={styles.commentTime}>{comment.created_at ? formatDateTime(comment.created_at) : ''}</Text>
        </View>
        {comment.is_deleted ? (
          <Text style={styles.deletedText}>Комментарий удалён</Text>
        ) : (
          <Text style={styles.commentBody}>{comment.body}</Text>
        )}
        {!comment.is_deleted && (
          <View style={styles.commentActions}>
            {canWrite && !isReply && (
              <TouchableOpacity onPress={() => setReplyTo({ id: comment.id, authorName: comment.author?.name ?? '—' })}>
                <Text style={styles.replyBtn}>Ответить</Text>
              </TouchableOpacity>
            )}
            {comment.can_edit && (
              <TouchableOpacity onPress={() => { setEditingId(comment.id); setEditText(comment.body ?? ''); }}>
                <Text style={styles.editBtn}>Изменить</Text>
              </TouchableOpacity>
            )}
            {comment.can_delete && (
              deletingId === comment.id
                ? <Text style={styles.deletingText}>Удаление...</Text>
                : <TouchableOpacity onPress={() => handleDeleteComment(comment.id)}>
                    <Text style={styles.deleteBtn}>Удалить</Text>
                  </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: targetName }} />

      {/* Tabs */}
      {showSharedTab && (
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'shared' && styles.tabActive]}
            onPress={() => switchTab('shared')}
          >
            <Text style={[styles.tabText, activeTab === 'shared' && styles.tabTextActive]}>
              Общие{sharedUnread > 0 ? ` (${sharedUnread})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'private' && styles.tabActive]}
            onPress={() => switchTab('private')}
          >
            <Text style={[styles.tabText, activeTab === 'private' && styles.tabTextActive]}>
              Личные{privateUnread > 0 ? ` (${privateUnread})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Delete error banner */}
      {deleteError && (
        <TouchableOpacity style={styles.deleteErrorBanner} onPress={() => setDeleteError(null)}>
          <Text style={styles.deleteErrorText}>{deleteError}</Text>
        </TouchableOpacity>
      )}

      {/* Content */}
      {(loadingPhase === 'init' || loadingPhase === 'thread') ? (
        <View style={styles.center}><Spinner /></View>
      ) : loadingPhase === 'error' ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>Не удалось загрузить комментарии</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={flatItems}
          keyExtractor={(item) => item.comment.id}
          renderItem={renderComment}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>Нет комментариев</Text>
              {canWrite && <Text style={styles.emptyHint}>Оставьте первый комментарий</Text>}
            </View>
          }
        />
      )}

      {/* Input */}
      {canWrite && loadingPhase === 'ready' && (
        <Animated.View style={[styles.inputBar, { bottom: kbOffset }]}>
          {replyTo && (
            <View style={styles.replyHint}>
              <Text style={styles.replyHintText} numberOfLines={1}>
                ↩ Ответ на: {replyTo.authorName}
              </Text>
              <TouchableOpacity onPress={() => setReplyTo(null)}>
                <Text style={styles.replyHintClose}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Написать комментарий..."
              placeholderTextColor="#94A3B8"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={5000}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!inputText.trim() || sending}
            >
              <Text style={styles.sendIcon}>{sending ? '...' : '↑'}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 15, color: '#EF4444' },

  // Tabs
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#E2E8F0' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#2563EB' },
  tabText: { fontSize: 14, color: '#94A3B8', fontWeight: '500' },
  tabTextActive: { color: '#2563EB', fontWeight: '700' },

  // List
  listContent: { padding: 14, paddingBottom: 80 },
  emptyWrap: { paddingTop: 48, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 15, color: '#94A3B8' },
  emptyHint: { fontSize: 13, color: '#CBD5E1' },

  // Comment card
  commentCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 12,
    marginBottom: 8, gap: 6,
  },
  replyCard: {
    marginLeft: 24, backgroundColor: '#F8FAFC',
    borderLeftWidth: 3, borderLeftColor: '#E2E8F0',
    borderRadius: 8, paddingLeft: 10,
  },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  commentAuthor: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  commentEdited: { fontSize: 11, color: '#94A3B8', fontStyle: 'italic' },
  commentTime: { fontSize: 11, color: '#94A3B8', marginLeft: 'auto' },
  commentBody: { fontSize: 14, color: '#374151', lineHeight: 20 },
  deletedText: { fontSize: 13, color: '#94A3B8', fontStyle: 'italic' },

  // Comment actions
  commentActions: { flexDirection: 'row', gap: 12, marginTop: 2 },
  replyBtn: { fontSize: 12, color: '#2563EB' },
  editBtn: { fontSize: 12, color: '#64748B' },
  deleteBtn: { fontSize: 12, color: '#EF4444' },

  // Inline edit
  editInput: {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8,
    padding: 8, fontSize: 14, color: '#1E293B', minHeight: 60,
  },
  editActions: { flexDirection: 'row', gap: 8 },
  editSaveBtn: { paddingVertical: 6, paddingHorizontal: 14, backgroundColor: '#2563EB', borderRadius: 8 },
  editSaveText: { fontSize: 13, color: '#fff', fontWeight: '600' },
  editCancelBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  editCancelText: { fontSize: 13, color: '#64748B' },

  // Input bar
  inputBar: {
    position: 'absolute', left: 0, right: 0,
    backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#E2E8F0',
  },
  replyHint: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingTop: 8,
  },
  replyHintText: { fontSize: 12, color: '#2563EB', flex: 1 },
  replyHintClose: { fontSize: 14, color: '#94A3B8', paddingLeft: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 10, gap: 8 },
  input: {
    flex: 1, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    fontSize: 15, color: '#1E293B', maxHeight: 100,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#2563EB',
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#CBD5E1' },
  sendIcon: { fontSize: 18, color: '#fff', fontWeight: '700' },
  deletingText: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic' },
  deleteErrorBanner: {
    backgroundColor: '#FEF2F2', borderBottomWidth: 1, borderBottomColor: '#FECACA',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  deleteErrorText: { fontSize: 13, color: '#DC2626' },
});
