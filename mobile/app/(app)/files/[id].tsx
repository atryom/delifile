import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useFile, useDownloadUrl, useToggleFavorite } from '@/hooks/useFiles';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { useNetworkStore } from '@/store/network';
import { formatFileSize, formatDateTime } from '@/utils/format';

export default function FileDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: file, isLoading, isError } = useFile(id);
  const downloadUrl = useDownloadUrl(id);
  const toggleFavorite = useToggleFavorite();
  const isOnline = useNetworkStore((s) => s.isOnline);

  async function handleDownload() {
    if (!isOnline) {
      Alert.alert('Нет подключения', 'Для скачивания необходимо подключение к сети.');
      return;
    }
    try {
      const url = await downloadUrl.mutateAsync();
      await Linking.openURL(url);
    } catch {
      Alert.alert('Ошибка', 'Не удалось получить ссылку для скачивания');
    }
  }

  if (isLoading) return <Spinner />;

  if (isError || !file) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Не удалось загрузить файл</Text>
        <Button title="Назад" variant="secondary" onPress={() => router.back()} style={styles.btn} />
      </View>
    );
  }

  const name = file.display_name ?? file.original_name;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: name }} />
      <View style={styles.header}>
        <Text style={styles.name}>{name}</Text>
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => toggleFavorite.mutate({ id: file.id, isFavorite: file.is_favorite })}
            style={styles.iconBtn}
          >
            <Text style={file.is_favorite ? styles.starActive : styles.star}>★</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.meta}>
        {file.content_kind === 'binary_file' && (
          <Row label="Размер" value={formatFileSize(file.size)} />
        )}
        {file.mime_type && <Row label="Тип" value={file.mime_type} />}
        {file.uploaded_at && <Row label="Загружен" value={formatDateTime(file.uploaded_at)} />}
        {file.owner && <Row label="Владелец" value={file.owner.name ?? file.owner.email} />}
        {file.description && <Row label="Описание" value={file.description} />}
        {file.tags.length > 0 && (
          <View style={styles.tags}>
            {file.tags.map((t) => (
              <View key={t.id} style={styles.tag}>
                <Text style={styles.tagText}>{t.name}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {file.content_kind === 'url_file' && file.link_url ? (
        <Button title="Открыть ссылку" onPress={() => Linking.openURL(file.link_url!)} style={styles.btn} />
      ) : (
        <Button title="Скачать" onPress={handleDownload} loading={downloadUrl.isPending} style={styles.btn} />
      )}

      <TouchableOpacity onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>← Назад</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, gap: 20 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  name: { flex: 1, fontSize: 20, fontWeight: '700', color: '#1E293B', lineHeight: 28 },
  actions: { flexDirection: 'row', gap: 4 },
  iconBtn: { padding: 8 },
  star: { fontSize: 22, color: '#CBD5E1' },
  starActive: { fontSize: 22, color: '#F59E0B' },
  meta: { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  rowLabel: { fontSize: 14, color: '#94A3B8', flex: 1 },
  rowValue: { fontSize: 14, color: '#1E293B', flex: 2, textAlign: 'right' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tag: { backgroundColor: '#EFF6FF', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 12, color: '#2563EB', fontWeight: '500' },
  btn: { marginTop: 4 },
  back: { paddingVertical: 8 },
  backText: { color: '#2563EB', fontSize: 15 },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  errorText: { fontSize: 16, color: '#EF4444', fontWeight: '600' },
});
