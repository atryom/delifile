import { useState } from 'react';
import { Alert, FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supportApi } from '@/api/support';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
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
  const [createModal, setCreateModal] = useState(false);
  const [body, setBody] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['support', 'tickets'],
    queryFn: () => supportApi.listTickets().then((r) => r.data.data.items),
  });

  const createTicket = useMutation({
    mutationFn: (b: string) => supportApi.createTicket(b),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support'] });
      setBody('');
      setCreateModal(false);
      Alert.alert('Готово', 'Обращение отправлено. Мы ответим в ближайшее время.');
    },
    onError: () => Alert.alert('Ошибка', 'Не удалось создать обращение'),
  });

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
            <TouchableOpacity onPress={() => setCreateModal(true)} style={styles.addBtn}>
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

      <Modal visible={createModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Новое обращение</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Опишите проблему или вопрос..."
              value={body}
              onChangeText={setBody}
              multiline
              numberOfLines={5}
              autoFocus
              textAlignVertical="top"
            />
            <Button
              title="Отправить"
              onPress={() => { if (body.trim()) createTicket.mutate(body.trim()); }}
              loading={createTicket.isPending}
            />
            <TouchableOpacity onPress={() => setCreateModal(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 12 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  textArea: { height: 120, backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1E293B', borderWidth: 1, borderColor: '#E2E8F0' },
  cancelBtn: { alignItems: 'center', paddingVertical: 8 },
  cancelText: { fontSize: 15, color: '#94A3B8' },
});
