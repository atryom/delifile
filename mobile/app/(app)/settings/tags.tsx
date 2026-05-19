import { useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View, Modal } from 'react-native';
import { Stack } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tagsApi } from '@/api/tags';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import type { Tag } from '@/types';

export default function TagsScreen() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; tag?: Tag } | null>(null);
  const [name, setName] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list().then((r) => r.data.data.items),
  });

  const createTag = useMutation({
    mutationFn: (n: string) => tagsApi.create(n),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tags'] }); closeModal(); },
  });

  const updateTag = useMutation({
    mutationFn: ({ id, n }: { id: string; n: string }) => tagsApi.update(id, n),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tags'] }); closeModal(); },
  });

  const removeTag = useMutation({
    mutationFn: (id: string) => tagsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  });

  function openCreate() {
    setName('');
    setModal({ mode: 'create' });
  }

  function openEdit(tag: Tag) {
    setName(tag.name);
    setModal({ mode: 'edit', tag });
  }

  function closeModal() {
    setModal(null);
    setName('');
  }

  async function handleSave() {
    if (!name.trim()) return;
    if (modal?.mode === 'create') {
      createTag.mutate(name.trim());
    } else if (modal?.mode === 'edit' && modal.tag) {
      updateTag.mutate({ id: modal.tag.id, n: name.trim() });
    }
  }

  function confirmDelete(tag: Tag) {
    Alert.alert('Удалить тег', `Удалить тег «${tag.name}»?`, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: () => removeTag.mutate(tag.id) },
    ]);
  }

  return (
    <View style={styles.flex}>
      <Stack.Screen
        options={{
          title: 'Теги',
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
          ListEmptyComponent={<Text style={styles.empty}>Нет тегов</Text>}
          renderItem={({ item }) => (
            <View style={styles.tagRow}>
              <View style={styles.tagBadge}>
                <Text style={styles.tagName}>{item.name}</Text>
              </View>
              <Text style={styles.tagCount}>{item.files_count ?? 0} файлов</Text>
              <View style={styles.rowActions}>
                <TouchableOpacity onPress={() => openEdit(item)} style={styles.editBtn}>
                  <Text style={styles.editText}>✎</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmDelete(item)} style={styles.deleteBtn}>
                  <Text style={styles.deleteText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={!!modal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {modal?.mode === 'create' ? 'Новый тег' : 'Изменить тег'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Название тега"
              value={name}
              onChangeText={setName}
              autoFocus
            />
            <Button
              title="Сохранить"
              onPress={handleSave}
              loading={createTag.isPending || updateTag.isPending}
            />
            <TouchableOpacity onPress={closeModal} style={styles.cancelBtn}>
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
  tagRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 10 },
  tagBadge: { backgroundColor: '#EFF6FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  tagName: { fontSize: 14, color: '#2563EB', fontWeight: '500' },
  tagCount: { flex: 1, fontSize: 13, color: '#94A3B8' },
  rowActions: { flexDirection: 'row', gap: 6 },
  editBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  editText: { fontSize: 16, color: '#64748B' },
  deleteBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  deleteText: { fontSize: 13, color: '#EF4444', fontWeight: '700' },
  empty: { textAlign: 'center', color: '#94A3B8', fontSize: 15, marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 12 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  input: { height: 48, backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 14, fontSize: 16, color: '#1E293B', borderWidth: 1, borderColor: '#E2E8F0' },
  cancelBtn: { alignItems: 'center', paddingVertical: 8 },
  cancelText: { fontSize: 15, color: '#94A3B8' },
});
