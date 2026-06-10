import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { filesApi } from '@/api/files';

export default function PdfViewerScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    filesApi.download(id)
      .then((res) => setUrl(res.data.data.url))
      .catch(() => setError(true));
  }, [id]);

  return (
    <View style={styles.flex}>
      <Stack.Screen
        options={{
          title: name ?? 'PDF',
          presentation: 'modal',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>Закрыть</Text>
            </TouchableOpacity>
          ),
        }}
      />

      {!url && !error && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Загрузка...</Text>
        </View>
      )}

      {error && (
        <View style={styles.center}>
          <Text style={styles.errorText}>Не удалось открыть файл</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Назад</Text>
          </TouchableOpacity>
        </View>
      )}

      {url && (
        <WebView
          source={{ uri: url }}
          style={styles.flex}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#2563EB" />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { fontSize: 15, color: '#64748B' },
  errorText: { fontSize: 16, color: '#EF4444', fontWeight: '600' },
  closeBtn: { paddingHorizontal: 4 },
  closeBtnText: { fontSize: 16, color: '#2563EB' },
  backBtn: { paddingVertical: 10, paddingHorizontal: 24, backgroundColor: '#EFF6FF', borderRadius: 10 },
  backBtnText: { fontSize: 15, color: '#2563EB', fontWeight: '600' },
});
