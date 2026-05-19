import { useEffect, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { linksApi } from '@/api/links';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { formatFileSize, formatDate } from '@/utils/format';
import type { LinkMeta } from '@/api/links';

export default function PublicLinkScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [meta, setMeta] = useState<LinkMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    linksApi.resolve(token)
      .then((r) => setMeta(r.data.data))
      .catch(() => Alert.alert('Ошибка', 'Ссылка недействительна или истекла'))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleDownload() {
    setDownloading(true);
    try {
      const { data } = await linksApi.download(token);
      await Linking.openURL(data.data.url);
    } catch {
      Alert.alert('Ошибка', 'Не удалось скачать файл');
    } finally {
      setDownloading(false);
    }
  }

  if (loading) return <Spinner />;
  if (!meta) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Ссылка недействительна</Text>
        <Button title="На главную" onPress={() => router.replace('/(app)/files')} style={styles.btn} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{meta.file_name}</Text>
      <Text style={styles.meta}>
        {meta.content_kind === 'url_file' ? 'Ссылка' : formatFileSize(meta.file_size)}
        {meta.expires_at ? ` · до ${formatDate(meta.expires_at)}` : ''}
      </Text>
      {meta.owner_name && <Text style={styles.owner}>Отправитель: {meta.owner_name}</Text>}

      <Button title="Скачать" onPress={handleDownload} loading={downloading} style={styles.btn} />
      <Button title="Закрыть" variant="secondary" onPress={() => router.back()} style={styles.btn} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24, justifyContent: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#1E293B' },
  meta: { fontSize: 14, color: '#64748B' },
  owner: { fontSize: 14, color: '#64748B' },
  btn: { marginTop: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16, backgroundColor: '#fff' },
  errorTitle: { fontSize: 18, color: '#1E293B', fontWeight: '600' },
});
