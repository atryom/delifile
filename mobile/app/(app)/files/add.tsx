import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { useCreateFolder } from '@/hooks/useFolders';
import { Button } from '@/components/ui/Button';

type Mode = 'menu' | 'link' | 'folder';

export default function AddScreen() {
  const params = useLocalSearchParams<{ folder_id?: string; folder_name?: string }>();
  const folderId = params.folder_id || null;

  const [mode, setMode] = useState<Mode>('menu');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [folderName, setFolderName] = useState('');

  const createFolder = useCreateFolder();

  async function handleCreateFolder() {
    if (!folderName.trim()) return;
    try {
      await createFolder.mutateAsync({ name: folderName.trim(), parent_id: folderId });
      router.back();
    } catch {
      Alert.alert('Ошибка', 'Не удалось создать папку');
    }
  }

  function handleAddLink() {
    if (!linkUrl.trim()) return;
    // TODO: POST /url-files
    Alert.alert('Скоро', 'Добавление ссылок будет доступно в следующей версии');
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <Stack.Screen options={{ title: 'Добавить', presentation: 'modal' }} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {mode === 'menu' && (
          <View style={styles.menu}>
            <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('Скоро', 'Загрузка файлов будет доступна в следующей версии')}>
              <Text style={styles.menuIcon}>📤</Text>
              <View>
                <Text style={styles.menuTitle}>Загрузить файл</Text>
                <Text style={styles.menuSub}>Из хранилища телефона</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => setMode('link')}>
              <Text style={styles.menuIcon}>🔗</Text>
              <View>
                <Text style={styles.menuTitle}>Добавить ссылку</Text>
                <Text style={styles.menuSub}>URL на внешний ресурс</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => setMode('folder')}>
              <Text style={styles.menuIcon}>📁</Text>
              <View>
                <Text style={styles.menuTitle}>Создать папку</Text>
                <Text style={styles.menuSub}>{params.folder_name ? `Внутри «${params.folder_name}»` : 'В корне'}</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {mode === 'link' && (
          <View style={styles.form}>
            <TouchableOpacity onPress={() => setMode('menu')} style={styles.back}>
              <Text style={styles.backText}>← Назад</Text>
            </TouchableOpacity>
            <Text style={styles.formTitle}>Добавить ссылку</Text>
            <TextInput
              style={styles.input}
              placeholder="https://..."
              value={linkUrl}
              onChangeText={setLinkUrl}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={styles.input}
              placeholder="Название (необязательно)"
              value={linkTitle}
              onChangeText={setLinkTitle}
            />
            <Button title="Добавить" onPress={handleAddLink} />
          </View>
        )}

        {mode === 'folder' && (
          <View style={styles.form}>
            <TouchableOpacity onPress={() => setMode('menu')} style={styles.back}>
              <Text style={styles.backText}>← Назад</Text>
            </TouchableOpacity>
            <Text style={styles.formTitle}>Создать папку</Text>
            <TextInput
              style={styles.input}
              placeholder="Название папки"
              value={folderName}
              onChangeText={setFolderName}
              autoFocus
            />
            <Button
              title="Создать"
              onPress={handleCreateFolder}
              loading={createFolder.isPending}
            />
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { padding: 20, gap: 12 },
  menu: { gap: 2 },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 14, marginBottom: 10 },
  menuIcon: { fontSize: 28 },
  menuTitle: { fontSize: 16, fontWeight: '600', color: '#1E293B' },
  menuSub: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  form: { gap: 14 },
  formTitle: { fontSize: 20, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  input: { height: 48, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, fontSize: 16, color: '#1E293B', borderWidth: 1, borderColor: '#E2E8F0' },
  back: { paddingVertical: 4 },
  backText: { color: '#2563EB', fontSize: 15 },
});
