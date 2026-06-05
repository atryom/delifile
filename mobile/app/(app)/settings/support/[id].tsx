import { useEffect, useRef, useState } from 'react';
import {
  Alert, Animated, FlatList, Keyboard, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supportApi } from '@/api/support';
import { Spinner } from '@/components/ui/Spinner';
import { formatDateTime } from '@/utils/format';
import type { SupportMessageItem, SupportTicketStatus } from '@/types';

const STATUS_LABEL: Record<SupportTicketStatus, string> = {
  new: 'Новый',
  in_progress: 'В работе',
  awaiting_confirmation: 'Ожидает подтверждения',
  completed: 'Завершён',
};

const STATUS_COLOR: Record<SupportTicketStatus, string> = {
  new: '#F59E0B',
  in_progress: '#2563EB',
  awaiting_confirmation: '#7C3AED',
  completed: '#10B981',
};

export default function TicketChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const listRef = useRef<FlatList>(null);
  const [message, setMessage] = useState('');
  const kbOffset = useRef(new Animated.Value(0)).current;

  const { data: ticket, isLoading, isError } = useQuery({
    queryKey: ['support', 'ticket', id],
    queryFn: () => supportApi.getTicket(id).then((r) => r.data.data.ticket),
    refetchInterval: 30_000,
    staleTime: 0,
  });

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      kbOffset.setValue(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      kbOffset.setValue(0);
    });
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Mark admin messages as read whenever count changes
  useEffect(() => {
    if (ticket?.messages.some((m) => m.is_admin_message && !m.read_at)) {
      supportApi.markRead(id).catch(() => {});
      qc.invalidateQueries({ queryKey: ['support', 'tickets'] });
    }
  }, [ticket?.messages.length]);

  const sendMessage = useMutation({
    mutationFn: (body: string) => supportApi.sendMessage(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support', 'ticket', id] });
      qc.invalidateQueries({ queryKey: ['support', 'tickets'] });
      setMessage('');
      Keyboard.dismiss();
    },
    onError: (e: any) => {
      Alert.alert('Ошибка', e.response?.data?.message ?? 'Не удалось отправить сообщение');
    },
  });

  const confirmTicket = useMutation({
    mutationFn: () => supportApi.confirmTicket(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support', 'ticket', id] });
      qc.invalidateQueries({ queryKey: ['support', 'tickets'] });
    },
    onError: (e: any) => {
      Alert.alert('Ошибка', e.response?.data?.message ?? 'Не удалось подтвердить решение');
    },
  });

  function handleSend() {
    const text = message.trim();
    if (!text || sendMessage.isPending) return;
    sendMessage.mutate(text);
  }

  function handleConfirm() {
    Alert.alert(
      'Подтвердить решение?',
      'Обращение будет закрыто.',
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Подтвердить', onPress: () => confirmTicket.mutate() },
      ],
    );
  }

  if (isLoading) return <Spinner />;

  if (isError || !ticket) {
    return (
      <View style={styles.errorContainer}>
        <Stack.Screen options={{ title: 'Обращение' }} />
        <Text style={styles.errorText}>Не удалось загрузить обращение</Text>
      </View>
    );
  }

  const isClosed = ticket.status === 'completed';
  const awaitingConfirmation = ticket.status === 'awaiting_confirmation';

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: 'Обращение' }} />

      <View style={styles.statusBar}>
        <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[ticket.status] }]} />
        <Text style={[styles.statusText, { color: STATUS_COLOR[ticket.status] }]}>
          {STATUS_LABEL[ticket.status]}
        </Text>
      </View>

      {awaitingConfirmation && (
        <View style={styles.confirmBanner}>
          <Text style={styles.confirmBannerText}>Проблема решена? Подтвердите завершение.</Text>
          <TouchableOpacity
            style={[styles.confirmBtn, confirmTicket.isPending && { opacity: 0.6 }]}
            onPress={handleConfirm}
            disabled={confirmTicket.isPending}
          >
            <Text style={styles.confirmBtnText}>
              {confirmTicket.isPending ? '...' : 'Подтвердить'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        ref={listRef}
        data={ticket.messages}
        keyExtractor={(m) => m.id}
        style={styles.messageListFlex}
        contentContainerStyle={[styles.messageList, !isClosed && { paddingBottom: 76 }]}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={<Text style={styles.emptyText}>Нет сообщений</Text>}
        renderItem={({ item }) => <MessageBubble message={item} />}
      />

      {!isClosed && (
        <Animated.View style={[styles.inputBar, { bottom: kbOffset }]}>
          <TextInput
            style={styles.input}
            placeholder="Сообщение..."
            placeholderTextColor="#94A3B8"
            value={message}
            onChangeText={setMessage}
            multiline
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!message.trim() || sendMessage.isPending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!message.trim() || sendMessage.isPending}
          >
            <Text style={styles.sendBtnText}>▶</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

function MessageBubble({ message }: { message: SupportMessageItem }) {
  const isAdmin = message.is_admin_message;
  return (
    <View style={[styles.bubbleWrap, isAdmin ? styles.bubbleWrapLeft : styles.bubbleWrapRight]}>
      {isAdmin && <Text style={styles.senderLabel}>Поддержка</Text>}
      <View style={[styles.bubble, isAdmin ? styles.bubbleAdmin : styles.bubbleUser]}>
        <Text style={[styles.bubbleText, isAdmin ? styles.bubbleTextAdmin : styles.bubbleTextUser]}>
          {message.body}
        </Text>
      </View>
      {message.created_at && (
        <Text style={[styles.bubbleTime, !isAdmin && styles.bubbleTimeRight]}>
          {formatDateTime(message.created_at)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F8FAFC' },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 15, color: '#EF4444' },

  statusBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '600' },

  confirmBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F5F3FF', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#DDD6FE', gap: 12,
  },
  confirmBannerText: { flex: 1, fontSize: 13, color: '#5B21B6' },
  confirmBtn: { backgroundColor: '#7C3AED', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  confirmBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  messageListFlex: { flex: 1 },
  messageList: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 12 },
  emptyText: { textAlign: 'center', color: '#94A3B8', fontSize: 14, marginTop: 40 },

  bubbleWrap: { maxWidth: '80%', gap: 3 },
  bubbleWrapLeft: { alignSelf: 'flex-start' },
  bubbleWrapRight: { alignSelf: 'flex-end' },
  senderLabel: { fontSize: 11, color: '#94A3B8', marginLeft: 2 },
  bubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleAdmin: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', borderTopLeftRadius: 4 },
  bubbleUser: { backgroundColor: '#2563EB', borderTopRightRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  bubbleTextAdmin: { color: '#1E293B' },
  bubbleTextUser: { color: '#fff' },
  bubbleTime: { fontSize: 11, color: '#94A3B8', marginLeft: 2 },
  bubbleTimeRight: { textAlign: 'right', marginRight: 2 },

  inputBar: {
    position: 'absolute', left: 0, right: 0,
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: '#E2E8F0',
    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 6,
  },
  input: {
    flex: 1, minHeight: 40, maxHeight: 120,
    backgroundColor: '#F1F5F9', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 15, color: '#1E293B',
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#CBD5E1' },
  sendBtnText: { color: '#fff', fontSize: 20, lineHeight: 22, includeFontPadding: false, textAlignVertical: 'center' },
});
