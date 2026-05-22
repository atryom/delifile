import { useRef, useState } from 'react';
import { Alert, FlatList, Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sharedFoldersApi } from '@/api/shared-folders';
import { Spinner } from '@/components/ui/Spinner';
import { formatDateTime } from '@/utils/format';
import type { FileListItem, SharedFolder } from '@/types';

export default function SharedFolderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  const [folderTitle, setFolderTitle] = useState('Общая папка');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const renameInputRef = useRef<TextInput>(null);

  const { data: folderData, isLoading, refetch } = useQuery({
    queryKey: ['shared-folders', id],
    queryFn: async () => {
      const [filesRes, subfoldersRes] = await Promise.all([
        sharedFoldersApi.files(id),
        sharedFoldersApi.subfolders(id),
      ]);
      return {
        files: filesRes.data.data.items,
        subfolders: subfoldersRes.data.data.items,
      };
    },
    staleTime: 0,
  });

  const renameSubfolder = useMutation({
    mutationFn: ({ subfolderId, name }: { subfolderId: string; name: string }) =>
      sharedFoldersApi.rename(subfolderId, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shared-folders', id] });
      setRenamingId(null);
    },
    onError: () => Alert.alert('Ошибка', 'Не удалось переименовать папку'),
  });

  const deleteSubfolder = useMutation({
    mutationFn: (subfolderId: string) => sharedFoldersApi.delete(subfolderId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shared-folders', id] }),
    onError: () => Alert.alert('Ошибка', 'Не удалось удалить папку'),
  });

  const leaveSubfolder = useMutation({
    mutationFn: (subfolderId: string) => sharedFoldersApi.leave(subfolderId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shared-folders', id] }),
    onError: () => Alert.alert('Ошибка', 'Не удалось покинуть папку'),
  });

  function startRename(subfolder: SharedFolder) {
    setRenamingId(subfolder.id);
    setRenameText(subfolder.name);
    setTimeout(() => renameInputRef.current?.focus(), 50);
  }

  function cancelRename() {
    Keyboard.dismiss();
    setRenamingId(null);
    setRenameText('');
  }

  function saveRename() {
    if (!renamingId || !renameText.trim()) { cancelRename(); return; }
    renameSubfolder.mutate({ subfolderId: renamingId, name: renameText.trim() });
  }

  function handleSubfolderMenu(subfolder: SharedFolder) {
    if (subfolder.is_owner) {
      Alert.alert(subfolder.name, undefined, [
        { text: 'Переименовать', onPress: () => startRename(subfolder) },
        {
          text: 'Удалить папку',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Удалить подпапку?', `«${subfolder.name}» и всё её содержимое будут удалены.`, [
              { text: 'Отмена', style: 'cancel' },
              { text: 'Удалить', style: 'destructive', onPress: () => deleteSubfolder.mutate(subfolder.id) },
            ]),
        },
        { text: 'Отмена', style: 'cancel' },
      ]);
    } else {
      Alert.alert(subfolder.name, undefined, [
        {
          text: 'Покинуть папку',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Покинуть подпапку?', `Вы потеряете доступ к «${subfolder.name}».`, [
              { text: 'Отмена', style: 'cancel' },
              { text: 'Покинуть', style: 'destructive', onPress: () => leaveSubfolder.mutate(subfolder.id) },
            ]),
        },
        { text: 'Отмена', style: 'cancel' },
      ]);
    }
  }

  const files = folderData?.files ?? [];
  const subfolders = folderData?.subfolders ?? [];

  type ListItem =
    | { kind: 'header'; text: string }
    | { kind: 'subfolder'; data: SharedFolder }
    | { kind: 'file'; data: FileListItem };

  const listData: ListItem[] = [];
  if (subfolders.length > 0) {
    listData.push({ kind: 'header', text: 'Подпапки' });
    subfolders.forEach((sf) => listData.push({ kind: 'subfolder', data: sf }));
  }
  if (files.length > 0) {
    if (subfolders.length > 0) listData.push({ kind: 'header', text: 'Файлы' });
    files.forEach((f) => listData.push({ kind: 'file', data: f }));
  }

  if (isLoading) return <Spinner />;

  return (
    <View style={styles.flex}>
      <Stack.Screen
        options={{
          title: folderTitle,
          headerRight: () => (
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: '/(app)/files/shared-folders/add' as any,
                  params: { shared_folder_id: id, folder_name: folderTitle },
                })
              }
              style={styles.addBtn}
            >
              <Text style={styles.addBtnText}>＋</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <FlatList
        data={listData}
        keyExtractor={(item, i) =>
          item.kind === 'header' ? `h-${i}` :
          item.kind === 'subfolder' ? `sf-${item.data.id}` :
          `f-${item.data.id}`
        }
        onRefresh={refetch}
        refreshing={isLoading}
        ListHeaderComponent={
          <TouchableOpacity
            style={styles.commentsEntry}
            onPress={() => router.push({
              pathname: '/(app)/files/comments',
              params: { targetType: 'shared_folder', targetId: id, targetName: folderTitle },
            } as any)}
          >
            <Text style={styles.commentsEntryText}>💬 Комментарии к папке</Text>
            <Text style={styles.commentsChevron}>›</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Папка пуста</Text>
            <Text style={styles.emptySub}>Нажмите «＋» чтобы добавить файл или ссылку</Text>
          </View>
        }
        renderItem={({ item }) => {
          if (item.kind === 'header') {
            return <Text style={styles.sectionHeader}>{item.text}</Text>;
          }

          if (item.kind === 'subfolder') {
            if (renamingId === item.data.id) {
              return (
                <View style={styles.row}>
                  <Text style={styles.fileIcon}>🗂</Text>
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
                onPress={() =>
                  router.push({
                    pathname: '/(app)/files/shared-folders/[id]' as any,
                    params: { id: item.data.id },
                  })
                }
              >
                <Text style={styles.fileIcon}>🗂</Text>
                <View style={styles.rowInfo}>
                  <Text style={styles.fileName} numberOfLines={1}>{item.data.name}</Text>
                  <Text style={styles.fileMeta}>{item.data.files_count} файлов</Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleSubfolderMenu(item.data)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.menuBtn}
                >
                  <Text style={styles.menuBtnText}>⋯</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }

          return <FileRow file={item.data} />;
        }}
      />
    </View>
  );
}

function FileRow({ file }: { file: FileListItem }) {
  const isUrl = file.content_kind === 'url_file';
  const icon = isUrl ? '🔗' : getFileIcon(file.mime_type);
  const name = file.display_name || file.original_name;

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={() => router.push(`/(app)/files/${file.id}` as any)}
    >
      <Text style={styles.fileIcon}>{icon}</Text>
      <View style={styles.rowInfo}>
        <Text style={styles.fileName} numberOfLines={1}>{name}</Text>
        {!isUrl && <Text style={styles.fileMeta}>{formatSize(file.size)}</Text>}
        {isUrl && file.link_title && (
          <Text style={styles.fileMeta} numberOfLines={1}>{file.link_title}</Text>
        )}
        {file.uploaded_at && (
          <Text style={styles.fileDate}>{formatDateTime(file.uploaded_at)}</Text>
        )}
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

function getFileIcon(mime: string | null) {
  if (!mime) return '📄';
  if (mime.startsWith('image/')) return '🖼';
  if (mime.startsWith('video/')) return '🎬';
  if (mime.startsWith('audio/')) return '🎵';
  if (mime.includes('pdf')) return '📕';
  if (mime.includes('zip') || mime.includes('rar')) return '🗜';
  if (mime.includes('word') || mime.includes('document')) return '📝';
  if (mime.includes('sheet') || mime.includes('excel')) return '📊';
  return '📄';
}

function formatSize(bytes: number) {
  if (!bytes) return '0 Б';
  const u = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F8FAFC' },
  addBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  addBtnText: { fontSize: 24, color: '#2563EB' },
  emptyContainer: { alignItems: 'center', marginTop: 60, gap: 8, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#1E293B' },
  emptySub: { fontSize: 14, color: '#94A3B8', textAlign: 'center' },

  sectionHeader: {
    fontSize: 12, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6, letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  fileIcon: { fontSize: 22 },
  rowInfo: { flex: 1, gap: 2 },
  fileName: { fontSize: 15, fontWeight: '500', color: '#1E293B' },
  fileMeta: { fontSize: 13, color: '#64748B' },
  fileDate: { fontSize: 11, color: '#94A3B8' },
  chevron: { fontSize: 20, color: '#CBD5E1' },
  menuBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  menuBtnText: { fontSize: 18, color: '#94A3B8' },
  renameInput: {
    flex: 1, backgroundColor: '#F1F5F9', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 15, color: '#1E293B', borderWidth: 1, borderColor: '#2563EB',
  },
  renameConfirm: { fontSize: 18, color: '#2563EB', fontWeight: '700' },
  commentsEntry: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#EFF6FF', marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14,
  },
  commentsEntryText: { fontSize: 15, color: '#2563EB', fontWeight: '500' },
  commentsChevron: { fontSize: 20, color: '#2563EB' },
});
