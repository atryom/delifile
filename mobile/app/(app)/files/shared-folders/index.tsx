import { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sharedFoldersApi } from '@/api/shared-folders';
import { Spinner } from '@/components/ui/Spinner';
import { pluralFiles } from '@/utils/format';
import type { SharedFolder } from '@/types';

export default function SharedFoldersScreen() {
  const qc = useQueryClient();

  // Create form
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const createInputRef = useRef<TextInput>(null);

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const renameInputRef = useRef<TextInput>(null);

  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['shared-folders'],
    queryFn: () => sharedFoldersApi.list().then((r) => r.data.data.items),
    staleTime: 0,
  });

  const createFolder = useMutation({
    mutationFn: (n: string) => sharedFoldersApi.create(n),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shared-folders'] });
      closeCreate();
    },
    onError: () => Alert.alert('Ошибка', 'Не удалось создать папку'),
  });

  const renameFolder = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => sharedFoldersApi.rename(id, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shared-folders'] });
      setRenamingId(null);
    },
    onError: () => Alert.alert('Ошибка', 'Не удалось переименовать папку'),
  });

  const deleteFolder = useMutation({
    mutationFn: (id: string) => sharedFoldersApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shared-folders'] }),
    onError: () => Alert.alert('Ошибка', 'Не удалось удалить папку'),
  });

  const leaveFolder = useMutation({
    mutationFn: (id: string) => sharedFoldersApi.leave(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shared-folders'] }),
    onError: () => Alert.alert('Ошибка', 'Не удалось покинуть папку'),
  });

  function openCreate() {
    setNewName('');
    setCreating(true);
    setTimeout(() => createInputRef.current?.focus(), 50);
  }

  function closeCreate() {
    Keyboard.dismiss();
    setCreating(false);
    setNewName('');
  }

  function handleCreate() {
    const n = newName.trim();
    if (!n || createFolder.isPending) return;
    createFolder.mutate(n);
  }

  function startRename(folder: SharedFolder) {
    setRenamingId(folder.id);
    setRenameText(folder.name);
    setTimeout(() => renameInputRef.current?.focus(), 50);
  }

  function cancelRename() {
    Keyboard.dismiss();
    setRenamingId(null);
    setRenameText('');
  }

  async function saveRename() {
    if (!renamingId || !renameText.trim()) { cancelRename(); return; }
    renameFolder.mutate({ id: renamingId, name: renameText.trim() });
  }

  function handleMenu(folder: SharedFolder) {
    if (folder.is_owner) {
      Alert.alert(folder.name, undefined, [
        { text: 'Переименовать', onPress: () => startRename(folder) },
        {
          text: 'Удалить папку',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Удалить папку?', `Папка «${folder.name}» и всё её содержимое будут удалены.`, [
              { text: 'Отмена', style: 'cancel' },
              { text: 'Удалить', style: 'destructive', onPress: () => deleteFolder.mutate(folder.id) },
            ]),
        },
        { text: 'Отмена', style: 'cancel' },
      ]);
    } else {
      Alert.alert(folder.name, undefined, [
        {
          text: 'Покинуть папку',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Покинуть папку?', `Вы потеряете доступ к «${folder.name}».`, [
              { text: 'Отмена', style: 'cancel' },
              { text: 'Покинуть', style: 'destructive', onPress: () => leaveFolder.mutate(folder.id) },
            ]),
        },
        { text: 'Отмена', style: 'cancel' },
      ]);
    }
  }

  if (isLoading) return <Spinner />;

  return (
    <View style={styles.flex}>
      <Stack.Screen
        options={{
          title: 'Общие папки',
          headerRight: () => (
            <TouchableOpacity onPress={openCreate} style={styles.addBtn}>
              <Text style={styles.addBtnText}>＋</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <FlatList
        data={data ?? []}
        keyExtractor={(f) => f.id}
        onRefresh={refetch}
        refreshing={isLoading}
        contentContainerStyle={creating ? { paddingBottom: 200 } : undefined}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Нет общих папок</Text>
            <Text style={styles.emptySub}>Нажмите «＋» чтобы создать общую папку</Text>
          </View>
        }
        renderItem={({ item }) => {
          if (renamingId === item.id) {
            return (
              <View style={styles.row}>
                <Text style={styles.folderIcon}>🗂</Text>
                <TextInput
                  ref={renameInputRef}
                  style={styles.renameInput}
                  value={renameText}
                  onChangeText={setRenameText}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={saveRename}
                  selectTextOnFocus
                />
                <TouchableOpacity onPress={saveRename} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.menuBtn}>
                  <Text style={styles.renameConfirm}>✓</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={cancelRename} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.menuBtn}>
                  <Text style={styles.menuBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            );
          }
          return (
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => router.push({ pathname: '/(app)/files/shared-folders/[id]' as any, params: { id: item.id, folder_name: item.name } })}
            >
              <Text style={styles.folderIcon}>🗂</Text>
              <View style={styles.rowInfo}>
                <Text style={styles.folderName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.folderMeta}>
                  {item.files_count} файл{pluralFiles(item.files_count)}
                  {item.children_count > 0 ? ` · ${item.children_count} подпапок` : ''}
                  {' · '}
                  {item.is_owner ? 'Владелец' : item.my_access_type === 'edit' ? 'Редактор' : 'Просмотр'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleMenu(item)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.menuBtn}
              >
                <Text style={styles.menuBtnText}>⋯</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
      />

      {creating && (
        <View style={[styles.inputBar, { bottom: kbHeight }]}>
          <Text style={styles.barTitle}>Новая общая папка</Text>
          <TextInput
            ref={createInputRef}
            style={styles.textInput}
            placeholder="Название папки..."
            placeholderTextColor="#94A3B8"
            value={newName}
            onChangeText={setNewName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
          <View style={styles.barButtons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={closeCreate}>
              <Text style={styles.cancelText}>Отмена</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createBtn, (!newName.trim() || createFolder.isPending) && styles.createBtnDisabled]}
              onPress={handleCreate}
              disabled={!newName.trim() || createFolder.isPending}
            >
              <Text style={styles.createText}>{createFolder.isPending ? '...' : 'Создать'}</Text>
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
  emptyContainer: { alignItems: 'center', marginTop: 60, gap: 8, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#1E293B' },
  emptySub: { fontSize: 14, color: '#94A3B8', textAlign: 'center' },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  folderIcon: { fontSize: 22 },
  rowInfo: { flex: 1, gap: 2 },
  folderName: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
  folderMeta: { fontSize: 13, color: '#94A3B8' },
  menuBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  menuBtnText: { fontSize: 18, color: '#94A3B8' },
  renameInput: {
    flex: 1, backgroundColor: '#F1F5F9', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 15, color: '#1E293B', borderWidth: 1, borderColor: '#2563EB',
  },
  renameConfirm: { fontSize: 18, color: '#2563EB', fontWeight: '700' },

  inputBar: {
    position: 'absolute', left: 0, right: 0,
    backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
    borderTopWidth: 1, borderTopColor: '#E2E8F0', gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 8,
  },
  barTitle: { fontSize: 16, fontWeight: '600', color: '#1E293B' },
  textInput: {
    height: 44, backgroundColor: '#F8FAFC', borderRadius: 10,
    paddingHorizontal: 14, fontSize: 15, color: '#1E293B',
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  barButtons: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, height: 44, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0',
    alignItems: 'center', justifyContent: 'center',
  },
  cancelText: { fontSize: 15, color: '#64748B' },
  createBtn: { flex: 1, height: 44, borderRadius: 10, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  createBtnDisabled: { opacity: 0.5 },
  createText: { fontSize: 15, color: '#fff', fontWeight: '600' },
});
