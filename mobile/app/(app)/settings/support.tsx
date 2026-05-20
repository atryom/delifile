import { useRef, useEffect, useState } from 'react';
import { Alert, FlatList, Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Stack } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supportApi } from '@/api/support';
import { Spinner } from '@/components/ui/Spinner';
import type { SupportTicketStatus } from '@/types';

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

export default function SupportScreen() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [body, setBody] = useState('');
  const [kbHeight, setKbHeight] = useState(0);
  const textRef = useRef<TextInput>(null);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['support', 'tickets'],
    queryFn: () => supportApi.listTickets().then((r) => r.data.data.items),
  });

  const createTicket = useMutation({
    mutationFn: (b: string) => supportApi.createTicket(b),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support'] });
      setBody('');
      close();
      Alert.alert('Готово', 'Обращение отправлено. Мы ответим в ближайшее время.');
    },
    onError: () => Alert.alert('Ошибка', 'Не удалось создать обращение'),
  });

  function openCreate() {
    setBody('');
    setCreating(true);
    textRef.current?.focus();
  }

  function close() {
    Keyboard.dismiss();
    setCreating(false);
    setBody('');
  }

  function formatDate(iso: string | null) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <View style={styles.flex}>
      <Stack.Screen
        options={{
          title: 'Техподдержка',
          headerRight: () => (
            <TouchableOpacity onPress={openCreate} style={styles.addBtn}>
              <Text style={styles.addBtnText}>＋</Text>
            </TouchableOpacity>
          ),
        }}
      />

      {isLoading ? (
        <Spinner />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(t) => t.id}
          contentContainerStyle={creating ? { paddingBottom: 200 } : undefined}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>Нет обращений</Text>
              <Text style={styles.emptySub}>Нажмите «＋» чтобы создать обращение</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.ticketRow} activeOpacity={0.7}>
              <View style={styles.ticketMain}>
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[item.status] }]} />
                  <Text style={[styles.statusText, { color: STATUS_COLOR[item.status] }]}>
                    {STATUS_LABEL[item.status]}
                  </Text>
                  {item.unread_count > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{item.unread_count}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.ticketDate}>{formatDate(item.last_event_at ?? item.created_at)}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {creating && (
        <View style={[styles.inputBar, { bottom: kbHeight }]}>
          <Text style={styles.barTitle}>Новое обращение</Text>
          <TextInput
            ref={textRef}
            style={styles.textArea}
            placeholder="Опишите проблему или вопрос..."
            placeholderTextColor="#94A3B8"
            value={body}
            onChangeText={setBody}
            autoFocus
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <View style={styles.barButtons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={close}>
              <Text style={styles.cancelText}>Отмена</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sendBtn, createTicket.isPending && styles.sendBtnDisabled]}
              onPress={() => { if (body.trim()) createTicket.mutate(body.trim()); }}
              disabled={createTicket.isPending}
            >
              <Text style={styles.sendText}>Отправить</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F8FAFC' },
  addBtn: { paddingHorizontal: 8 },
  addBtnText: { fontSize: 24, color: '#2563EB' },
  ticketRow: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingHorizontal: 16, paddingVertical: 14 },
  ticketMain: { gap: 6 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 14, fontWeight: '600' },
  unreadBadge: { backgroundColor: '#EF4444', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  ticketDate: { fontSize: 13, color: '#94A3B8' },
  emptyContainer: { alignItems: 'center', marginTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#1E293B' },
  emptySub: { fontSize: 14, color: '#94A3B8' },
  inputBar: { position: 'absolute', left: 0, right: 0, backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderTopWidth: 1, borderTopColor: '#E2E8F0', gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 8 },
  barTitle: { fontSize: 16, fontWeight: '600', color: '#1E293B' },
  textArea: { height: 100, backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#1E293B', borderWidth: 1, borderColor: '#E2E8F0' },
  barButtons: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, height: 44, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 15, color: '#64748B' },
  sendBtn: { flex: 1, height: 44, borderRadius: 10, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.6 },
  sendText: { fontSize: 15, color: '#fff', fontWeight: '600' },
});
