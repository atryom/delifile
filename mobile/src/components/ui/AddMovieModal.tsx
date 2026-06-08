import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { sharedFoldersApi } from '@/api/shared-folders';
import type { MovieMetadata } from '@/types';

interface Props {
  folderId: string;
  onAdded: () => void;
  onClose: () => void;
}

export function AddMovieModal({ folderId, onAdded, onClose }: Props) {
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [results, setResults]   = useState<MovieMetadata[] | null>(null);
  const [adding, setAdding]     = useState<number | null>(null);

  const isUrl = input.trim().includes('kinopoisk.ru');

  async function handleSearch() {
    const q = input.trim();
    if (!q) return;
    setLoading(true);
    setResults(null);
    try {
      const res = await sharedFoldersApi.searchMovie(folderId, q);
      const data = res.data.data;

      if (data.auto_confirm && data.movie) {
        await addMovie(data.movie.kinopoisk_id!);
        return;
      }
      setResults(data.results ?? []);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Не удалось найти фильм. Проверьте запрос.';
      Alert.alert('Ошибка', msg);
    } finally {
      setLoading(false);
    }
  }

  async function addMovie(kinopoiskId: number) {
    setAdding(kinopoiskId);
    try {
      await sharedFoldersApi.addMovie(folderId, kinopoiskId);
      onAdded();
      onClose();
    } catch {
      Alert.alert('Ошибка', 'Не удалось добавить фильм');
    } finally {
      setAdding(null);
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Добавить фильм</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Название или ссылка kinopoisk.ru"
              value={input}
              onChangeText={setInput}
              autoFocus
              returnKeyType="search"
              onSubmitEditing={handleSearch}
              autoCapitalize="sentences"
            />
            <TouchableOpacity
              style={[styles.searchBtn, !input.trim() && styles.searchBtnDisabled]}
              onPress={handleSearch}
              disabled={!input.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.searchBtnText}>{isUrl ? 'Добавить' : 'Найти'}</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.hint}>
            {isUrl ? 'Ссылка будет добавлена автоматически' : 'Или вставьте ссылку на kinopoisk.ru'}
          </Text>

          {results !== null && results.length === 0 && (
            <Text style={styles.empty}>Ничего не найдено. Попробуйте другой запрос.</Text>
          )}

          {results !== null && results.length > 0 && (
            <FlatList
              data={results}
              keyExtractor={(item) => String(item.kinopoisk_id)}
              style={styles.list}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.resultRow}
                  onPress={() => item.kinopoisk_id && addMovie(item.kinopoisk_id)}
                  disabled={adding !== null}
                  activeOpacity={0.7}
                >
                  <Image
                    source={{ uri: item.poster_url ?? undefined }}
                    style={styles.thumb}
                    contentFit="cover"
                    placeholderContentFit="cover"
                  />
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultTitle} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.resultMeta}>
                      {item.year ?? ''}
                      {item.year && item.rating_kp ? '  ·  ' : ''}
                      {item.rating_kp ? `★ ${item.rating_kp}` : ''}
                    </Text>
                    {item.genres && item.genres.length > 0 && (
                      <Text style={styles.resultGenres} numberOfLines={1}>
                        {item.genres.slice(0, 3).join(', ')}
                      </Text>
                    )}
                  </View>
                  {adding === item.kinopoisk_id ? (
                    <ActivityIndicator size="small" color="#6366f1" />
                  ) : (
                    <Text style={styles.addBtn}>＋</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flex: 1, paddingTop: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#1E293B' },
  close: { fontSize: 18, color: '#94A3B8' },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  input: {
    flex: 1,
    height: 46,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#1E293B',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 76,
  },
  searchBtnDisabled: { opacity: 0.5 },
  searchBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  hint: { paddingHorizontal: 20, fontSize: 12, color: '#94A3B8', marginBottom: 16 },
  empty: { textAlign: 'center', color: '#94A3B8', marginTop: 32, fontSize: 15 },
  list: { flex: 1 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  thumb: {
    width: 52,
    height: 76,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
  },
  resultInfo: { flex: 1, gap: 3 },
  resultTitle: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
  resultMeta: { fontSize: 13, color: '#64748B' },
  resultGenres: { fontSize: 12, color: '#94A3B8' },
  addBtn: { fontSize: 22, color: '#6366f1', fontWeight: '600', paddingHorizontal: 4 },
});
