import { useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFileList } from '@/hooks/useFiles';
import { useDebounce } from '@/hooks/useDebounce';
import { useEnsurePersonalRoot } from '@/hooks/useSharedFolders';
import { sharedFoldersApi } from '@/api/shared-folders';
import { filesApi } from '@/api/files';
import { Spinner } from '@/components/ui/Spinner';
import { formatFileSize, pluralFiles } from '@/utils/format';
import { getFolderHasFilesCount } from '@/utils/error';
import type { FileListItem, FileFilter } from '@/types';
import type { SharedFolder } from '@/types';

const FILTERS: { key: FileFilter; label: string }[] = [
  { key: 'all',       label: 'Все'        },
  { key: 'mine',      label: 'Мои'        },
  { key: 'received',  label: 'Полученные' },
  { key: 'favorites', label: 'Избранное'  },
];

function formatDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

interface FolderRowProps {
  folder: SharedFolder;
  onMenu: () => void;
  isRenaming: boolean;
  renameText: string;
  onRenameChange: (v: string) => void;
  onRenameSave: () => void;
  onRenameCancel: () => void;
}

function FolderRow({ folder, onMenu, isRenaming, renameText, onRenameChange, onRenameSave, onRenameCancel }: FolderRowProps) {
  const icon = folder.is_personal_root
    ? '🏠'
    : folder.folder_type === 'gallery'
    ? '🖼'
    : folder.folder_type === 'movies'
    ? '🎬'
    : folder.is_private
    ? '🔒'
    : '🗂';

  if (isRenaming) {
    return (
      <View style={styles.folderRow}>
        <Text style={styles.folderIcon}>{icon}</Text>
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
      onPress={() => router.push(`/(app)/files/shared-folders/${folder.id}` as any)}
      activeOpacity={0.7}
    >
      <Text style={styles.folderIcon}>{icon}</Text>
      <View style={styles.rowMain}>
        <View style={styles.folderNameRow}>
          <Text style={styles.folderName} numberOfLines={1}>{folder.name}</Text>
          {folder.has_shared_access && <Text style={styles.sharedBadge}>👥</Text>}
        </View>
        <Text style={styles.folderMeta}>
          {folder.files_count} файл{pluralFiles(folder.files_count)}
          {!folder.is_owner ? (folder.my_access_type === 'edit' ? ' · Редактор' : ' · Просмотр') : ''}
        </Text>
      </View>
      <TouchableOpacity onPress={onMenu} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.menuBtn}>
        <Text style={styles.menuBtnText}>⋯</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function FileRow({
  item, isSelectMode, isSelected, onSelect, onLongPress,
}: {
  item: FileListItem;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  onLongPress?: () => void;
}) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handlePressIn() {
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      onLongPress?.();
    }, 400);
  }

  function handlePressOut() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.fileRow, isSelected && styles.fileRowSelected, pressed && { opacity: 0.7 }]}
      onPress={() => {
        if (isSelectMode) { onSelect?.(); return; }
        router.push(`/(app)/files/${item.id}`);
      }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      {isSelectMode && (
        <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
          {isSelected && <Text style={styles.checkmark}>✓</Text>}
        </View>
      )}
      <View style={styles.rowMain}>
        <Text style={styles.fileName} numberOfLines={1}>{item.display_name ?? item.original_name}</Text>
        <Text style={styles.fileMeta}>
          {item.content_kind === 'url_file' ? 'Ссылка' : formatFileSize(item.size)}
          {item.uploaded_at ? ` · ${formatDate(item.uploaded_at)}` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

function buildFolderHierarchy(folders: SharedFolder[]): { folder: SharedFolder; depth: number }[] {
  const idSet = new Set(folders.map((f) => f.id));
  const result: { folder: SharedFolder; depth: number }[] = [];
  const added = new Set<string>();

  function addChildren(parentId: string | null, depth: number) {
    folders
      .filter((f) => {
        const effectiveParent = f.parent_id && idSet.has(f.parent_id) ? f.parent_id : null;
        return effectiveParent === parentId && !added.has(f.id);
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((f) => {
        result.push({ folder: f, depth });
        added.add(f.id);
        addChildren(f.id, depth + 1);
      });
  }

  addChildren(null, 0);
  return result;
}

function FolderPickerModal({
  onMove,
  onClose,
}: {
  onMove: (targetId: string) => void;
  onClose: () => void;
}) {
  const { data: folders = [], isLoading } = useQuery({
    queryKey: ['shared-folders-all-flat'],
    queryFn: () => sharedFoldersApi.allFlat().then((r) => r.data.data.items),
    staleTime: 1000 * 60,
  });

  const filtered = folders.filter((f) => !f.is_personal_root);
  const hierarchyItems = buildFolderHierarchy(filtered);

  function getFolderTypeIcon(type?: string | null) {
    if (type === 'gallery') return '🖼';
    if (type === 'movies') return '🎬';
    return '🗂';
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Переместить в папку</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>
        {isLoading && <Spinner />}
        <FlatList
          data={hierarchyItems}
          keyExtractor={(item) => item.folder.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.modalFolderRow, { paddingLeft: 16 + item.depth * 20 }]}
              activeOpacity={0.7}
              onPress={() => onMove(item.folder.id)}
            >
              <Text style={styles.modalFolderIcon}>{getFolderTypeIcon(item.folder.folder_type)}</Text>
              <Text style={styles.modalFolderName}>{item.folder.name}</Text>
              <Text style={styles.modalChevron}>›</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={!isLoading ? <Text style={styles.modalEmpty}>Нет доступных папок</Text> : null}
        />
      </View>
    </Modal>
  );
}

export default function FilesScreen() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [filter, setFilter] = useState<FileFilter>('all');

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  // Multi-select state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showMoveModal, setShowMoveModal] = useState(false);

  function enterSelectMode(fileId: string) {
    setIsSelectMode(true);
    setSelectedIds([fileId]);
  }

  function exitSelectMode() {
    setIsSelectMode(false);
    setSelectedIds([]);
  }

  function toggleSelect(fileId: string) {
    setSelectedIds((ids) => ids.includes(fileId) ? ids.filter((x) => x !== fileId) : [...ids, fileId]);
  }

  async function handleBulkDelete() {
    Alert.alert(`Удалить ${selectedIds.length} файл(а)?`, 'Файлы будут удалены безвозвратно.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          await Promise.allSettled(selectedIds.map((fid) => filesApi.delete(fid)));
          qc.invalidateQueries({ queryKey: ['files'] });
          exitSelectMode();
        },
      },
    ]);
  }

  async function handleBulkMove(targetFolderId: string) {
    await Promise.allSettled(selectedIds.map((fid) => sharedFoldersApi.addFile(targetFolderId, fid, true)));
    qc.invalidateQueries({ queryKey: ['files'] });
    setShowMoveModal(false);
    exitSelectMode();
  }

  const ensureRoot = useEnsurePersonalRoot();
  useEffect(() => {
    ensureRoot.mutate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: folders, isLoading: foldersLoading, refetch: refetchFolders } = useQuery({
    queryKey: ['shared-folders'],
    queryFn: () => sharedFoldersApi.list().then((r) => r.data.data.items),
    staleTime: 0,
  });

  const { data: filesData, isLoading: filesLoading, isError, refetch: refetchFiles } = useFileList({
    search: debouncedSearch || undefined,
    filter,
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
    mutationFn: ({ id, force = false }: { id: string; force?: boolean }) => sharedFoldersApi.delete(id, force),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shared-folders'] }),
    onError: (e, vars) => {
      const count = getFolderHasFilesCount(e);
      if (count !== null) {
        Alert.alert(
          'В папке есть файлы',
          `${count} ${count === 1 ? 'файл будет удалён' : 'файлов будут удалены'} безвозвратно.`,
          [
            { text: 'Отмена', style: 'cancel' },
            { text: 'Удалить с файлами', style: 'destructive', onPress: () => deleteFolder.mutate({ id: vars.id, force: true }) },
          ]
        );
      } else {
        Alert.alert('Ошибка', 'Не удалось удалить папку');
      }
    },
  });

  const leaveFolder = useMutation({
    mutationFn: (id: string) => sharedFoldersApi.leave(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shared-folders'] }),
    onError: () => Alert.alert('Ошибка', 'Не удалось покинуть папку'),
  });

  function handleFolderMenu(folder: SharedFolder) {
    if (folder.is_owner) {
      Alert.alert(folder.name, undefined, [
        { text: 'Переименовать', onPress: () => { setRenamingId(folder.id); setRenameText(folder.name); } },
        {
          text: 'Удалить папку',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Удалить папку?', `Папка «${folder.name}» и её содержимое будут удалены.`, [
              { text: 'Отмена', style: 'cancel' },
              { text: 'Удалить', style: 'destructive', onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); deleteFolder.mutate({ id: folder.id }); } },
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
              { text: 'Покинуть', style: 'destructive', onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); leaveFolder.mutate(folder.id); } },
            ]),
        },
        { text: 'Отмена', style: 'cancel' },
      ]);
    }
  }

  async function handleSaveRename() {
    if (!renamingId || !renameText.trim()) { setRenamingId(null); return; }
    renameFolder.mutate({ id: renamingId, name: renameText.trim() });
  }

  function refetch() {
    refetchFolders();
    refetchFiles();
  }

  const rootFolders = (folders ?? []).filter((f) => f.parent_id === null && !f.is_personal_root);
  const files = filesData?.items ?? [];
  const isLoading = foldersLoading || filesLoading;

  type ListItem =
    | { kind: 'folder'; data: SharedFolder }
    | { kind: 'file'; data: FileListItem }
    | { kind: 'header'; text: string };

  const listData: ListItem[] = [];
  if (rootFolders.length > 0) {
    if (files.length > 0) listData.push({ kind: 'header', text: 'Папки' });
    rootFolders.forEach((f) => listData.push({ kind: 'folder', data: f }));
  }
  if (files.length > 0) {
    if (rootFolders.length > 0) listData.push({ kind: 'header', text: 'Файлы' });
    files.forEach((f) => listData.push({ kind: 'file', data: f }));
  }

  return (
    <View style={styles.flex}>
      <Stack.Screen
        options={{
          title: 'Файлы',
          headerRight: () => (
            <TouchableOpacity onPress={() => router.push('/(app)/files/add' as any)} style={styles.addBtn}>
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

      {!search && (
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

      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Ошибка загрузки</Text>
          <TouchableOpacity onPress={refetch} style={styles.retryBtn}>
            <Text style={styles.retryText}>Повторить</Text>
          </TouchableOpacity>
        </View>
      ) : listData.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.empty}>Пусто</Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item, i) =>
            item.kind === 'header' ? `h-${i}` :
            item.kind === 'folder' ? `sf-${item.data.id}` :
            `f-${item.data.id}`
          }
          onRefresh={refetch}
          refreshing={isLoading}
          renderItem={({ item }) => {
            if (item.kind === 'header') {
              return (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{item.text}</Text>
                </View>
              );
            }
            if (item.kind === 'folder') {
              return (
                <FolderRow
                  folder={item.data}
                  onMenu={() => handleFolderMenu(item.data)}
                  isRenaming={renamingId === item.data.id}
                  renameText={renameText}
                  onRenameChange={setRenameText}
                  onRenameSave={handleSaveRename}
                  onRenameCancel={() => setRenamingId(null)}
                />
              );
            }
            return (
              <FileRow
                item={item.data}
                isSelectMode={isSelectMode}
                isSelected={selectedIds.includes(item.data.id)}
                onSelect={() => toggleSelect(item.data.id)}
                onLongPress={() => enterSelectMode(item.data.id)}
              />
            );
          }}
        />
      )}

      {/* Select mode info bar */}
      {isSelectMode && (
        <View style={styles.selectModeBar}>
          <Text style={styles.selectModeCount}>{selectedIds.length} выбрано</Text>
          <TouchableOpacity onPress={exitSelectMode} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.selectModeCancel}>Отмена</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bulk action bar */}
      {isSelectMode && selectedIds.length > 0 && (
        <View style={styles.selectBar}>
          <TouchableOpacity style={styles.selectBarBtn} onPress={() => setShowMoveModal(true)}>
            <Text style={styles.selectBarIcon}>📁</Text>
            <Text style={styles.selectBarText}>В папку</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.selectBarBtn, styles.selectBarBtnDanger]} onPress={handleBulkDelete}>
            <Text style={styles.selectBarIcon}>🗑</Text>
            <Text style={[styles.selectBarText, styles.selectBarTextDanger]}>Удалить</Text>
          </TouchableOpacity>
        </View>
      )}

      {showMoveModal && (
        <FolderPickerModal onMove={handleBulkMove} onClose={() => setShowMoveModal(false)} />
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
  folderNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  folderName: { fontSize: 15, color: '#1E293B', fontWeight: '500', flexShrink: 1 },
  sharedBadge: { fontSize: 14 },
  folderMeta: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  menuBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  menuBtnText: { fontSize: 18, color: '#94A3B8' },
  renameInput: { flex: 1, backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15, color: '#1E293B', borderWidth: 1, borderColor: '#2563EB' },
  renameConfirm: { fontSize: 18, color: '#2563EB', fontWeight: '700' },
  fileRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 10 },
  fileRowSelected: { backgroundColor: '#EFF6FF' },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { borderColor: '#6366F1', backgroundColor: '#6366F1' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
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

  selectModeBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#EFF6FF', borderTopWidth: 1, borderTopColor: '#BFDBFE' },
  selectModeCount: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  selectModeCancel: { fontSize: 14, color: '#2563EB', fontWeight: '500' },
  selectBar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#E2E8F0', backgroundColor: '#fff' },
  selectBarBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 4 },
  selectBarBtnDanger: { borderLeftWidth: 1, borderLeftColor: '#E2E8F0' },
  selectBarIcon: { fontSize: 20 },
  selectBarText: { fontSize: 12, color: '#475569', fontWeight: '500' },
  selectBarTextDanger: { color: '#EF4444' },

  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  modalClose: { fontSize: 18, color: '#64748B', paddingHorizontal: 4 },
  modalFolderRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 12 },
  modalFolderIcon: { fontSize: 20 },
  modalFolderName: { flex: 1, fontSize: 15, color: '#1E293B' },
  modalChevron: { fontSize: 18, color: '#94A3B8' },
  modalEmpty: { textAlign: 'center', color: '#94A3B8', fontSize: 14, padding: 32 },
});
