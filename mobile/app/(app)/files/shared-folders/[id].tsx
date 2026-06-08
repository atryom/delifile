import { useRef, useState, useCallback } from 'react';
import { Alert, FlatList, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sharedFoldersApi } from '@/api/shared-folders';
import { filesApi } from '@/api/files';
import { useSharedFolderAccesses, useAddFolderMember, useRemoveFolderMember } from '@/hooks/useSharedFolders';
import { useContacts } from '@/hooks/useContacts';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { GalleryGrid } from '@/components/ui/GalleryGrid';
import { MovieCard } from '@/components/ui/MovieCard';
import { AddMovieModal } from '@/components/ui/AddMovieModal';
import { formatDateTime, formatFileSize } from '@/utils/format';
import type { FileListItem, SharedFolder } from '@/types';
import { getApiError } from '@/utils/error';

interface FileListItemWithPrivacy extends FileListItem {
  is_private?: boolean;
}

type MovieFilter = 'all' | 'watched' | 'unwatched';

function getFolderTypeIcon(type?: string | null): string {
  if (type === 'gallery') return '🖼';
  if (type === 'movies') return '🎬';
  return '🗂';
}

export default function SharedFolderScreen() {
  const { id, folder_name, folder_type: paramFolderType } = useLocalSearchParams<{ id: string; folder_name?: string; folder_type?: string }>();
  const qc = useQueryClient();

  // folder_name from nav params; fall back to cache from shared folders list
  const paramName = Array.isArray(folder_name) ? folder_name[0] : folder_name;
  const cachedFolders = qc.getQueryData<SharedFolder[]>(['shared-folders']);
  const cachedFolder = cachedFolders?.find((f) => f.id === id);
  const folderTitle = paramName || cachedFolder?.name || 'Общая папка';
  const resolvedParamType = Array.isArray(paramFolderType) ? paramFolderType[0] : paramFolderType;
  const folderType = (cachedFolder?.folder_type ?? resolvedParamType ?? 'default') as 'default' | 'gallery' | 'movies';
  const canEdit = cachedFolder ? (cachedFolder.is_owner || cachedFolder.my_access_type === 'edit') : false;
  const [showAddMovie, setShowAddMovie] = useState(false);

  // Movie filter state
  const [movieFilter, setMovieFilter] = useState<MovieFilter>('all');
  // Optimistic meta overrides keyed by file id
  const [localMovieMeta, setLocalMovieMeta] = useState<Record<string, { watched?: boolean | null; personal_rating?: number | null }>>({});

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const renameInputRef = useRef<TextInput>(null);

  // Members modal state
  const [showMembers, setShowMembers] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [newMemberContactId, setNewMemberContactId] = useState<string | null>(null);
  const [newMemberAccessType, setNewMemberAccessType] = useState<'view' | 'edit'>('view');

  const folderAccesses = useSharedFolderAccesses(id);
  const addFolderMember = useAddFolderMember(id);
  const removeFolderMember = useRemoveFolderMember(id);
  const { data: contacts } = useContacts();

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

  const setFolderPrivacy = useMutation({
    mutationFn: ({ subfolderId, isPrivate }: { subfolderId: string; isPrivate: boolean }) =>
      sharedFoldersApi.setFolderPrivacy(subfolderId, isPrivate),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shared-folders', id] }),
    onError: () => Alert.alert('Ошибка', 'Не удалось изменить приватность'),
  });

  const setFilePrivacy = useMutation({
    mutationFn: ({ fileId, isPrivate }: { fileId: string; isPrivate: boolean }) =>
      sharedFoldersApi.setFilePrivacy(id, fileId, isPrivate),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shared-folders', id] }),
    onError: () => Alert.alert('Ошибка', 'Не удалось изменить приватность'),
  });

  async function handleAddMember() {
    if (!newMemberContactId) return;
    try {
      await addFolderMember.mutateAsync({ contactId: newMemberContactId, accessType: newMemberAccessType });
      setAddingMember(false);
      setNewMemberContactId(null);
    } catch (e) {
      Alert.alert('Ошибка', getApiError(e, 'Не удалось добавить участника'));
    }
  }

  function handleRemoveMember(accessId: string, name: string) {
    Alert.alert(`Убрать ${name} из папки?`, undefined, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Убрать',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeFolderMember.mutateAsync(accessId);
          } catch (e) {
            Alert.alert('Ошибка', getApiError(e, 'Не удалось убрать участника'));
          }
        },
      },
    ]);
  }

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

  function handleFileMenu(file: FileListItemWithPrivacy) {
    Alert.alert(file.display_name ?? file.original_name, undefined, [
      {
        text: file.is_private ? 'Открыть доступ' : 'Сделать приватным',
        onPress: () => setFilePrivacy.mutate({ fileId: file.id, isPrivate: !file.is_private }),
      },
      { text: 'Отмена', style: 'cancel' },
    ]);
  }

  function handleSubfolderMenu(subfolder: SharedFolder) {
    if (subfolder.is_owner) {
      Alert.alert(subfolder.name, undefined, [
        { text: 'Переименовать', onPress: () => startRename(subfolder) },
        {
          text: subfolder.is_private ? 'Открыть доступ' : 'Сделать приватной',
          onPress: () => setFolderPrivacy.mutate({ subfolderId: subfolder.id, isPrivate: !subfolder.is_private }),
        },
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

  const handleMovieWatched = useCallback((fileId: string, watched: boolean) => {
    const prev = localMovieMeta[fileId]?.watched;
    setLocalMovieMeta(m => ({ ...m, [fileId]: { ...m[fileId], watched } }));
    filesApi.updateMovieMeta(fileId, { watched }).catch(() => {
      setLocalMovieMeta(m => ({ ...m, [fileId]: { ...m[fileId], watched: prev } }));
    });
  }, [localMovieMeta]);

  const handleMovieRating = useCallback((fileId: string, rating: number | null) => {
    const prev = localMovieMeta[fileId]?.personal_rating;
    setLocalMovieMeta(m => ({ ...m, [fileId]: { ...m[fileId], personal_rating: rating } }));
    filesApi.updateMovieMeta(fileId, { personal_rating: rating }).catch(() => {
      setLocalMovieMeta(m => ({ ...m, [fileId]: { ...m[fileId], personal_rating: prev } }));
    });
  }, [localMovieMeta]);

  const files = (folderData?.files ?? []) as FileListItemWithPrivacy[];
  const subfolders = folderData?.subfolders ?? [];

  type ListItem =
    | { kind: 'header'; text: string }
    | { kind: 'subfolder'; data: SharedFolder }
    | { kind: 'file'; data: FileListItemWithPrivacy };

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
            <View style={styles.headerBtns}>
              <TouchableOpacity
                onPress={() => setShowMembers(true)}
                style={styles.headerBtn}
              >
                <Text style={styles.headerBtnText}>👥</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (folderType === 'movies') {
                    setShowAddMovie(true);
                  } else {
                    router.push({
                      pathname: '/(app)/files/shared-folders/add' as any,
                      params: { shared_folder_id: id, folder_name: folderTitle, folder_type: folderType },
                    });
                  }
                }}
                style={styles.addBtn}
              >
                <Text style={styles.addBtnText}>＋</Text>
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      {/* Members modal */}
      <Modal visible={showMembers} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowMembers(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Участники папки</Text>
            <TouchableOpacity onPress={() => { setShowMembers(false); setAddingMember(false); }}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {folderAccesses.isLoading && <Spinner />}

          {(folderAccesses.data ?? []).map((acc) => {
            const displayName = acc.user?.name ?? acc.user?.email ?? 'Неизвестный';
            return (
              <View key={acc.id} style={styles.memberRow}>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{displayName}</Text>
                  <View style={[styles.accessTypeBadge, acc.access_type === 'edit' && styles.accessTypeBadgeEdit]}>
                    <Text style={styles.accessTypeBadgeText}>{acc.access_type === 'edit' ? 'Редактор' : 'Просмотр'}</Text>
                  </View>
                </View>
                {acc.contact_id && (
                  <TouchableOpacity
                    style={styles.memberRemoveBtn}
                    onPress={() => handleRemoveMember(acc.id, displayName)}
                    disabled={removeFolderMember.isPending}
                  >
                    <Text style={styles.memberRemoveBtnText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}

          {(folderAccesses.data ?? []).length === 0 && !folderAccesses.isLoading && (
            <Text style={styles.emptyMembers}>Нет участников кроме вас.</Text>
          )}

          {!addingMember ? (
            <TouchableOpacity style={styles.inviteBtn} onPress={() => { setAddingMember(true); setNewMemberContactId(null); setNewMemberAccessType('view'); }}>
              <Text style={styles.inviteBtnText}>+ Пригласить участника</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.inviteForm}>
              <Text style={styles.inviteFormTitle}>Выберите контакт</Text>
              {(contacts ?? []).map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.contactRow}
                  onPress={() => setNewMemberContactId(c.id)}
                >
                  <View style={[styles.radio, newMemberContactId === c.id && styles.radioActive]} />
                  <View>
                    <Text style={styles.contactName}>{c.name}</Text>
                    {c.email && <Text style={styles.contactEmail}>{c.email}</Text>}
                  </View>
                </TouchableOpacity>
              ))}
              <Text style={styles.inviteFormTitle}>Уровень доступа</Text>
              <View style={styles.accessTypeRow}>
                {(['view', 'edit'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.accessTypeBtn, newMemberAccessType === type && styles.accessTypeBtnActive]}
                    onPress={() => setNewMemberAccessType(type)}
                  >
                    <Text style={[styles.accessTypeBtnText, newMemberAccessType === type && styles.accessTypeBtnTextActive]}>
                      {type === 'view' ? 'Просмотр' : 'Редактор'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Button title="Добавить" onPress={handleAddMember} loading={addFolderMember.isPending} disabled={!newMemberContactId} style={styles.inviteSubmitBtn} />
              <Button title="Отмена" variant="secondary" onPress={() => setAddingMember(false)} style={{ marginTop: 4 }} />
            </View>
          )}
        </View>
      </Modal>

      {showAddMovie && (
        <AddMovieModal
          folderId={id}
          onAdded={() => qc.invalidateQueries({ queryKey: ['shared-folders', id] })}
          onClose={() => setShowAddMovie(false)}
        />
      )}

      {/* Gallery view */}
      {folderType === 'gallery' && (
        <GalleryGrid
          files={files}
          folderId={id}
          onRemoved={(fileId) => {
            sharedFoldersApi.removeFile(id, fileId)
              .then(() => qc.invalidateQueries({ queryKey: ['shared-folders', id] }))
              .catch(() => Alert.alert('Ошибка', 'Не удалось убрать файл из папки'));
          }}
        />
      )}

      {/* Movies view */}
      {folderType === 'movies' && (
        <View style={styles.flex}>
          {/* Filter chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterBar}>
            {([
              { val: 'all' as MovieFilter, label: 'Все' },
              { val: 'watched' as MovieFilter, label: 'Смотрел' },
              { val: 'unwatched' as MovieFilter, label: 'Не смотрел' },
            ]).map((chip) => (
              <Pressable
                key={chip.val}
                style={[styles.filterChip, movieFilter === chip.val && styles.filterChipActive]}
                onPress={() => setMovieFilter(chip.val)}
                accessibilityRole="button"
              >
                <Text style={[styles.filterChipText, movieFilter === chip.val && styles.filterChipTextActive]}>
                  {chip.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <FlatList
            data={files.filter((f) => {
              if (movieFilter === 'all') return true;
              const localW = localMovieMeta[f.id]?.watched;
              const watched = localW !== undefined ? localW : !!(f.custom_metadata as any)?.watched;
              return movieFilter === 'watched' ? !!watched : !watched;
            })}
            keyExtractor={(f) => f.id}
            onRefresh={refetch}
            refreshing={isLoading}
            contentContainerStyle={styles.moviesList}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>{movieFilter === 'all' ? 'Фильмов нет' : 'Нет фильмов с таким фильтром'}</Text>
                {movieFilter === 'all' && <Text style={styles.emptySub}>Нажмите «＋» чтобы добавить фильм</Text>}
              </View>
            }
            renderItem={({ item }) => {
              const localMeta = localMovieMeta[item.id];
              const mergedItem = localMeta
                ? { ...item, custom_metadata: { ...(item.custom_metadata ?? {}), ...localMeta } as any }
                : item;
              return (
                <MovieCard
                  item={mergedItem}
                  onDelete={canEdit ? () => {
                    sharedFoldersApi.removeFile(id, item.id)
                      .then(() => qc.invalidateQueries({ queryKey: ['shared-folders', id] }))
                      .catch(() => Alert.alert('Ошибка', 'Не удалось убрать фильм из списка'));
                  } : undefined}
                  onWatchedToggle={(watched) => handleMovieWatched(item.id, watched)}
                  onRatingChange={(rating) => handleMovieRating(item.id, rating)}
                />
              );
            }}
          />
        </View>
      )}

      {/* Default view */}
      {folderType === 'default' && (
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
                      params: { id: item.data.id, folder_name: item.data.name, folder_type: item.data.folder_type ?? 'default' },
                    })
                  }
                >
                  <Text style={styles.fileIcon}>{item.data.is_private ? '🔒' : getFolderTypeIcon(item.data.folder_type)}</Text>
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

            return <FileRow file={item.data} folderId={id} onMenu={() => handleFileMenu(item.data)} />;
          }}
        />
      )}
    </View>
  );
}

function FileRow({ file, folderId, onMenu }: { file: FileListItemWithPrivacy; folderId: string; onMenu: () => void }) {
  const isUrl = file.content_kind === 'url_file';
  const icon = file.is_private ? '🔒' : isUrl ? '🔗' : getFileIcon(file.mime_type);
  const name = file.display_name || file.original_name;

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={() => router.push({
        pathname: '/(app)/files/[id]' as any,
        params: { id: file.id, ctx_folder_id: folderId },
      })}
    >
      <Text style={styles.fileIcon}>{icon}</Text>
      <View style={styles.rowInfo}>
        <Text style={styles.fileName} numberOfLines={1}>{name}</Text>
        {!isUrl && <Text style={styles.fileMeta}>{formatFileSize(file.size)}</Text>}
        {isUrl && file.link_title && (
          <Text style={styles.fileMeta} numberOfLines={1}>{file.link_title}</Text>
        )}
        {file.uploaded_at && (
          <Text style={styles.fileDate}>{formatDateTime(file.uploaded_at)}</Text>
        )}
      </View>
      <TouchableOpacity onPress={onMenu} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.menuBtn}>
        <Text style={styles.menuBtnText}>⋯</Text>
      </TouchableOpacity>
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

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F8FAFC' },
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  headerBtnText: { fontSize: 20 },
  addBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  addBtnText: { fontSize: 24, color: '#2563EB' },
  emptyContainer: { alignItems: 'center', marginTop: 60, gap: 8, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#1E293B' },
  emptySub: { fontSize: 14, color: '#94A3B8', textAlign: 'center' },
  moviesList: { paddingVertical: 8 },
  filterBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  filterChip: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, backgroundColor: '#F8FAFC' },
  filterChipActive: { borderColor: '#6366F1', backgroundColor: '#EDE9FE' },
  filterChipText: { fontSize: 13, color: '#64748B' },
  filterChipTextActive: { color: '#6366F1', fontWeight: '600' },

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
  // Members modal
  modalContainer: { flex: 1, backgroundColor: '#fff', padding: 20, gap: 12 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  modalClose: { fontSize: 20, color: '#94A3B8', padding: 4 },
  memberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  memberInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberName: { fontSize: 15, color: '#1E293B', flex: 1 },
  accessTypeBadge: { backgroundColor: '#F1F5F9', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  accessTypeBadgeEdit: { backgroundColor: '#EFF6FF' },
  accessTypeBadgeText: { fontSize: 12, color: '#374151', fontWeight: '500' },
  memberRemoveBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  memberRemoveBtnText: { fontSize: 14, color: '#EF4444', fontWeight: '700' },
  emptyMembers: { fontSize: 14, color: '#94A3B8', textAlign: 'center', paddingVertical: 16 },
  inviteBtn: { marginTop: 8, paddingVertical: 14, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  inviteBtnText: { fontSize: 15, color: '#2563EB', fontWeight: '600' },
  inviteForm: { gap: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 },
  inviteFormTitle: { fontSize: 14, color: '#64748B', fontWeight: '600' },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  contactName: { fontSize: 15, color: '#1E293B' },
  contactEmail: { fontSize: 12, color: '#94A3B8' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#CBD5E1' },
  radioActive: { borderColor: '#2563EB', backgroundColor: '#2563EB' },
  accessTypeRow: { flexDirection: 'row', gap: 8 },
  accessTypeBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  accessTypeBtnActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  accessTypeBtnText: { fontSize: 14, color: '#64748B' },
  accessTypeBtnTextActive: { color: '#2563EB', fontWeight: '600' },
  inviteSubmitBtn: { marginTop: 4 },

  commentsEntry: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#EFF6FF', marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14,
  },
  commentsEntryText: { fontSize: 15, color: '#2563EB', fontWeight: '500' },
  commentsChevron: { fontSize: 20, color: '#2563EB' },
});
