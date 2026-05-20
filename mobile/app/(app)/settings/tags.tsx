import { useRef, useEffect, useState } from 'react';
import { Alert, FlatList, Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Stack } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tagsApi } from '@/api/tags';
import { Spinner } from '@/components/ui/Spinner';
import type { Tag } from '@/types';

type EditMode = { mode: 'create' } | { mode: 'edit'; tag: Tag } | null;

export default function TagsScreen() {
  const qc = useQueryClient();
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [name, setName] = useState('');
  const [kbHeight, setKbHeight] = useState(0);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list().then((r) => r.data.data.items),
  });

  const createTag = useMutation({
    mutationFn: (n: string) => tagsApi.create(n),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tags'] }); close(); },
    onError: (e: any) => Alert.alert('Ошибка', e.response?.data?.message ?? 'Не удалось создать тег'),
  });

  const updateTag = useMutation({
    mutationFn: ({ id, n }: { id: string; n: string }) => tagsApi.update(id, n),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tags'] }); close(); },
    onError: (e: any) => Alert.alert('Ошибка', e.response?.data?.message ?? 'Не удалось обновить тег'),
  });

  const removeTag = useMutation({
    mutationFn: (id: string) => tagsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  });

  function openCreate() {
    setName('');
    setEditMode({ mode: 'create' });
    inputRef.current?.focus();
  }

  function openEdit(tag: Tag) {
    setName(tag.name);
    setEditMode({ mode: 'edit', tag });
    inputRef.current?.focus();
  }

  function close() {
    Keyboard.dismiss();
    setEditMode(null);
    setName('');
  }

  function handleSave() {
    if (!name.trim()) return;
    if (editMode?.mode === 'create') {
      createTag.mutate(name.trim());
    } else if (editMode?.mode === 'edit') {
      updateTag.mutate({ id: editMode.tag.id, n: name.trim() });
    }
  }

  function confirmDelete(tag: Tag) {
    Alert.alert('Удалить тег', `Удалить тег «${tag.name}»?`, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: () => removeTag.mutate(tag.id) },
    ]);
  }

  const isPending = createTag.isPending || updateTag.isPending;

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
          contentContainerStyle={editMode ? { paddingBottom: 140 } : undefined}
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

      {editMode && (
        <View style={[styles.inputBar, { bottom: kbHeight }]}>
          <Text style={styles.barTitle}>
            {editMode.mode === 'create' ? 'Новый тег' : 'Изменить тег'}
          </Text>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Название тега"
            placeholderTextColor="#94A3B8"
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />
          <View style={styles.barButtons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={close}>
              <Text style={styles.cancelText}>Отмена</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, isPending && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={isPending}
            >
              <Text style={styles.saveText}>Сохранить</Text>
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
  inputBar: { position: 'absolute', left: 0, right: 0, backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderTopWidth: 1, borderTopColor: '#E2E8F0', gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 8 },
  barTitle: { fontSize: 16, fontWeight: '600', color: '#1E293B' },
  input: { height: 48, backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 14, fontSize: 16, color: '#1E293B', borderWidth: 1, borderColor: '#E2E8F0' },
  barButtons: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, height: 44, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 15, color: '#64748B' },
  saveBtn: { flex: 1, height: 44, borderRadius: 10, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: { fontSize: 15, color: '#fff', fontWeight: '600' },
});
