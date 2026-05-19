import { useState } from 'react';
import { Alert, FlatList, SectionList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { useFileList } from '@/hooks/useFiles';
import { useFolderList, useCreateFolder } from '@/hooks/useFolders';
import { Spinner } from '@/components/ui/Spinner';
import type { FileListItem } from '@/types';
import type { Folder } from '@/types';

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

function FolderRow({ folder }: { folder: Folder }) {
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
      <Text style={styles.chevron}>›</Text>
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

  const { data: allFolders, isLoading: foldersLoading } = useFolderList();
  const { data: filesData, isLoading: filesLoading, isError, refetch } = useFileList({
    folder_id: folderId ?? null,
    search: search || undefined,
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
              <FolderRow folder={item as Folder} />
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
  sectionHeader: { backgroundColor: '#F8FAFC', paddingHorizontal: 16, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },
  folderRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 12 },
  folderIcon: { fontSize: 20 },
  folderName: { fontSize: 15, color: '#1E293B', fontWeight: '500' },
  folderMeta: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  chevron: { fontSize: 20, color: '#CBD5E1' },
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
});
