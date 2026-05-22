import { useState } from 'react';
import { Alert, SectionList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { useFileList } from '@/hooks/useFiles';
import { useFolderList, useDeleteFolder, useRenameFolder } from '@/hooks/useFolders';
import { Spinner } from '@/components/ui/Spinner';
import type { FileListItem, FileFilter } from '@/types';
import type { Folder } from '@/types';

const FILTERS: { key: FileFilter; label: string }[] = [
  { key: 'all',       label: 'Все'        },
  { key: 'mine',      label: 'Мои'        },
  { key: 'received',  label: 'Полученные' },
  { key: 'favorites', label: 'Избранное'  },
];

function formatSize(bytes: number) {
  if (!bytes || bytes === 0) return '0 Б';
  const u = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

function formatDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

interface FolderRowProps {
  folder: Folder;
  onMenu: () => void;
  isRenaming: boolean;
  renameText: string;
  onRenameChange: (v: string) => void;
  onRenameSave: () => void;
  onRenameCancel: () => void;
}

function FolderRow({ folder, onMenu, isRenaming, renameText, onRenameChange, onRenameSave, onRenameCancel }: FolderRowProps) {
  if (isRenaming) {
    return (
      <View style={styles.folderRow}>
        <Text style={styles.folderIcon}>📁</Text>
        <TextInput
          style={styles.renameInput}
          value={renameText}
          onChangeText={onRenameChange}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={onRenameSave}
          selectTextOnFocus
        />
        <TouchableOpacity onPress={onRenameSave} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.menuBtn}>
          <Text style={styles.renameConfirm}>✓</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onRenameCancel} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.menuBtn}>
          <Text style={styles.menuBtnText}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.folderRow}
      onPress={() =>
        router.push({
          pathname: '/(app)/files',
          params: { folder_id: folder.id, folder_name: folder.name },
        })
      }
      activeOpacity={0.7}
    >
      <Text style={styles.folderIcon}>📁</Text>
      <View style={styles.rowMain}>
        <Text style={styles.folderName}>{folder.name}</Text>
        <Text style={styles.folderMeta}>{folder.files_count} файлов</Text>
      </View>
      <TouchableOpacity onPress={onMenu} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.menuBtn}>
        <Text style={styles.menuBtnText}>⋯</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function FileRow({ item }: { item: FileListItem }) {
  return (
    <TouchableOpacity
      style={styles.fileRow}
      onPress={() => router.push(`/(app)/files/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.rowMain}>
        <Text style={styles.fileName} numberOfLines={1}>{item.display_name ?? item.original_name}</Text>
        <Text style={styles.fileMeta}>
          {item.content_kind === 'url_file' ? 'Ссылка' : formatSize(item.size)}
          {item.uploaded_at ? ` · ${formatDate(item.uploaded_at)}` : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function FilesScreen() {
  const params = useLocalSearchParams<{ folder_id?: string; folder_name?: string }>();
  const folderId = params.folder_id || undefined;
  const folderName = params.folder_name || 'Файлы';

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FileFilter>('all');
  const deleteFolder = useDeleteFolder();
  const renameFolder = useRenameFolder();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  function handleFolderMenu(folder: Folder) {
    Alert.alert(folder.name, undefined, [
      { text: 'Переименовать', onPress: () => { setRenamingId(folder.id); setRenameText(folder.name); } },
      { text: 'Удалить папку', style: 'destructive', onPress: () => confirmDeleteFolder(folder) },
      { text: 'Отмена', style: 'cancel' },
    ]);
  }

  async function handleSaveRename() {
    if (!renamingId || !renameText.trim()) { setRenamingId(null); return; }
    try {
      await renameFolder.mutateAsync({ id: renamingId, name: renameText.trim() });
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message ?? 'Не удалось переименовать папку');
    } finally {
      setRenamingId(null);
    }
  }

  function confirmDeleteFolder(folder: Folder) {
    Alert.alert(
      'Удалить папку?',
      `Папка «${folder.name}» будет удалена.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => doDeleteFolder(folder, false),
        },
      ],
    );
  }

  async function doDeleteFolder(folder: Folder, force: boolean) {
    try {
      await deleteFolder.mutateAsync({ id: folder.id, force });
    } catch (e: any) {
      const code = e.response?.data?.error_code ?? e.response?.data?.code;
      if (code === 'HAS_CHILDREN') {
        Alert.alert('Нельзя удалить', 'Сначала удалите или переместите вложенные папки.');
        return;
      }
      if (code === 'HAS_FILES') {
        const count = e.response?.data?.data?.files_count ?? '';
        Alert.alert(
          'В папке есть файлы',
          `${count ? `${count} файлов` : 'Файлы'} будут перемещены в корень. Продолжить?`,
          [
            { text: 'Отмена', style: 'cancel' },
            { text: 'Удалить', style: 'destructive', onPress: () => doDeleteFolder(folder, true) },
          ],
        );
        return;
      }
      Alert.alert('Ошибка', e.response?.data?.message ?? 'Не удалось удалить папку');
    }
  }

  const { data: allFolders, isLoading: foldersLoading } = useFolderList();
  // folder_id='' → backend treats as NULL → root-only files
  // folder_id=undefined → Axios omits param → backend returns ALL files (wrong)
  // filter inside folder must be 'all' (same as web) — backend default is 'mine' which hides received files
  const { data: filesData, isLoading: filesLoading, isError, refetch } = useFileList({
    folder_id: folderId !== undefined ? folderId : '',
    search: search || undefined,
    filter: folderId ? 'all' : filter,
  });

  const subFolders = (allFolders ?? []).filter(
    (f) => (folderId ? f.parent_id === folderId : f.parent_id === null)
  );
  const files = filesData?.items ?? [];
  const isLoading = foldersLoading || filesLoading;

  return (
    <View style={styles.flex}>
      <Stack.Screen
        options={{
          title: folderName,
          headerRight: () => (
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: '/(app)/files/add' as any,
                  params: { folder_id: folderId ?? '', folder_name: folderName },
                })
              }
              style={styles.addBtn}
            >
              <Text style={styles.addBtnText}>＋</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.searchBar}>
        <TextInput
          style={styles.search}
          placeholder="Поиск..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#94A3B8"
          clearButtonMode="while-editing"
        />
      </View>

      {!folderId && (
        <View style={styles.filtersBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersContent}>
            {FILTERS.map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
                onPress={() => setFilter(f.key)}
              >
                <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {!folderId && !search && (
        <TouchableOpacity
          style={styles.sharedFoldersEntry}
          activeOpacity={0.7}
          onPress={() => router.push('/(app)/files/shared-folders' as any)}
        >
          <Text style={styles.sharedFoldersIcon}>🗂</Text>
          <Text style={styles.sharedFoldersText}>Общие папки</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      )}

      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Ошибка загрузки</Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Повторить</Text>
          </TouchableOpacity>
        </View>
      ) : subFolders.length === 0 && files.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.empty}>Пусто</Text>
        </View>
      ) : (
        <SectionList
          sections={[
            ...(subFolders.length > 0 ? [{ title: 'Папки', data: subFolders as any[] }] : []),
            ...(files.length > 0 ? [{ title: 'Файлы', data: files as any[] }] : []),
          ]}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section }) =>
            subFolders.length > 0 && files.length > 0 ? (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
              </View>
            ) : null
          }
          renderItem={({ item, section }) =>
            section.title === 'Папки' ? (
              <FolderRow
                folder={item as Folder}
                onMenu={() => handleFolderMenu(item as Folder)}
                isRenaming={renamingId === item.id}
                renameText={renameText}
                onRenameChange={setRenameText}
                onRenameSave={handleSaveRename}
                onRenameCancel={() => setRenamingId(null)}
              />
            ) : (
              <FileRow item={item as FileListItem} />
            )
          }
          onRefresh={refetch}
          refreshing={isLoading}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F8FAFC' },
  searchBar: { padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  search: { height: 40, backgroundColor: '#F1F5F9', borderRadius: 10, paddingHorizontal: 14, fontSize: 15, color: '#1E293B' },
  filtersBar: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingVertical: 9 },
  filtersContent: { paddingHorizontal: 12, gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9' },
  filterChipActive: { backgroundColor: '#EFF6FF' },
  filterText: { fontSize: 13, fontWeight: '500', color: '#64748B' },
  filterTextActive: { color: '#2563EB', fontWeight: '600' },
  sectionHeader: { backgroundColor: '#F8FAFC', paddingHorizontal: 16, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },
  folderRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 12 },
  folderIcon: { fontSize: 20 },
  folderName: { fontSize: 15, color: '#1E293B', fontWeight: '500' },
  folderMeta: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  chevron: { fontSize: 20, color: '#CBD5E1' },
  menuBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  menuBtnText: { fontSize: 18, color: '#94A3B8' },
  renameInput: { flex: 1, backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15, color: '#1E293B', borderWidth: 1, borderColor: '#2563EB' },
  renameConfirm: { fontSize: 18, color: '#2563EB', fontWeight: '700' },
  fileRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  rowMain: { flex: 1 },
  fileName: { fontSize: 15, color: '#1E293B', fontWeight: '500' },
  fileMeta: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  addBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  addBtnText: { fontSize: 24, color: '#2563EB', lineHeight: 28 },
  empty: { textAlign: 'center', color: '#94A3B8', fontSize: 15 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  errorText: { fontSize: 16, fontWeight: '600', color: '#EF4444' },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, backgroundColor: '#2563EB', borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600' },
  sharedFoldersEntry: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#EFF6FF', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#DBEAFE',
  },
  sharedFoldersIcon: { fontSize: 20 },
  sharedFoldersText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#2563EB' },
});
