import { useEffect, useRef, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { filesApi } from '@/api/files';
import { tariffsApi } from '@/api/tariffs';
import { sharedFoldersApi } from '@/api/shared-folders';
import { formatFileSize } from '@/utils/format';
import { documentsApi } from '@/api/documents';
import { Button } from '@/components/ui/Button';
import { getApiError } from '@/utils/error';

type Mode = 'menu' | 'link' | 'folder' | 'uploading' | 'document';

export default function AddScreen() {
  const params = useLocalSearchParams<{ folder_id?: string; folder_name?: string }>();
  const folderId = params.folder_id || null;
  const qc = useQueryClient();
  const { data: tariffUsage } = useQuery({
    queryKey: ['tariffs', 'usage'],
    queryFn: () => tariffsApi.usage().then((r) => r.data.data),
    staleTime: 1000 * 60 * 5,
  });

  const [mode, setMode] = useState<Mode>('menu');
  const [folderName, setFolderName] = useState('');
  const [folderType, setFolderType] = useState<'default' | 'gallery' | 'movies'>('default');

  // Link state
  const [linkUrl, setLinkUrl] = useState('');
  const [savingLink, setSavingLink] = useState(false);

  // Upload state
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadTaskRef = useRef<FileSystem.UploadTask | null>(null);
  const pendingFileIdRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      uploadTaskRef.current?.cancelAsync().catch(() => {});
      if (pendingFileIdRef.current) {
        filesApi.cancelUpload(pendingFileIdRef.current).catch(() => {});
      }
    };
  }, []);

  const createFolder = useMutation({
    mutationFn: ({ name, parent_id, folder_type }: { name: string; parent_id?: string | null; folder_type?: 'default' | 'gallery' | 'movies' }) =>
      sharedFoldersApi.create(name, parent_id, folder_type),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shared-folders'] }),
  });

  const [docName, setDocName] = useState('');
  const [docIsTask, setDocIsTask] = useState(false);
  const [creatingDoc, setCreatingDoc] = useState(false);

  async function handleCreateDocument() {
    const name = docName.trim() || 'Новый документ';
    setCreatingDoc(true);
    try {
      const res = await documentsApi.create(name);
      const docId = res.data.data.document.id;
      if (docIsTask) {
        await filesApi.updateTask(docId, { is_task: true, task_status: 'template' }).catch(() => {});
      }
      qc.invalidateQueries({ queryKey: ['files'] });
      router.back();
      setTimeout(() => router.push(`/(app)/files/edit/${docId}` as any), 300);
    } catch (e) {
      Alert.alert('Ошибка', getApiError(e, 'Не удалось создать документ'));
    } finally {
      setCreatingDoc(false);
    }
  }

  async function handleCreateFolder() {
    if (!folderName.trim()) return;
    try {
      await createFolder.mutateAsync({ name: folderName.trim(), parent_id: folderId, folder_type: folderType });
      router.back();
    } catch {
      Alert.alert('Ошибка', 'Не удалось создать папку');
    }
  }

  async function handleAddLink() {
    const raw = linkUrl.trim();
    if (!raw) return;
    // Normalize URL: decode then re-encode to make it RFC-3986 compliant
    // (pipe `|`, space, etc. fail PHP's FILTER_VALIDATE_URL otherwise)
    let url = raw;
    try { url = encodeURI(decodeURI(raw)); } catch { url = raw; }
    setSavingLink(true);
    try {
      const res = await filesApi.createUrlFile(url);
      const fileId = res.data.data.file.id;
      if (folderId) {
        await filesApi.moveFolder(fileId, folderId).catch(() => {});
      }
      qc.invalidateQueries({ queryKey: ['files'] });
      router.back();
    } catch (e) {
      Alert.alert('Ошибка', getApiError(e, 'Не удалось добавить ссылку'));
    } finally {
      setSavingLink(false);
    }
  }

  async function handlePickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const uri = asset.uri;
      const name = asset.name;
      const size = asset.size ?? 0;
      const mimeType = asset.mimeType ?? 'application/octet-stream';

      const limitBytes = tariffUsage?.file_size_limit_bytes;
      if (limitBytes && size > limitBytes) {
        Alert.alert('Файл слишком большой', `Максимальный размер файла: ${formatFileSize(limitBytes)}`);
        return;
      }

      setUploadFileName(name);
      setUploadProgress(0);
      setUploadError(null);
      setMode('uploading');

      let fileId: string;
      let putUrl: string;
      let putHeaders: Record<string, string>;
      try {
        const initRes = await filesApi.initUpload({ original_name: name, size, mime_type: mimeType });
        fileId = initRes.data.data.file.id;
        putUrl = initRes.data.data.upload.url;
        putHeaders = initRes.data.data.upload.headers;
      } catch (e) {
        setUploadError(getApiError(e, 'Не удалось инициализировать загрузку'));
        return;
      }

      pendingFileIdRef.current = fileId;

      const task = FileSystem.createUploadTask(
        putUrl,
        uri,
        {
          httpMethod: 'PUT',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: putHeaders,
        },
        (progress) => {
          if (progress.totalBytesExpectedToSend > 0) {
            setUploadProgress(progress.totalBytesSent / progress.totalBytesExpectedToSend);
          }
        },
      );
      uploadTaskRef.current = task;

      let uploadResult: FileSystem.FileSystemUploadResult | null | undefined;
      try {
        uploadResult = await task.uploadAsync();
      } catch {
        if (pendingFileIdRef.current) {
          filesApi.cancelUpload(pendingFileIdRef.current).catch(() => {});
          pendingFileIdRef.current = null;
        }
        setMode('menu');
        return;
      }
      uploadTaskRef.current = null;

      if (!uploadResult || uploadResult.status < 200 || uploadResult.status >= 300) {
        setUploadError(`Ошибка загрузки на сервер (${uploadResult?.status ?? '?'})`);
        filesApi.cancelUpload(fileId).catch(() => {});
        return;
      }

      try {
        await filesApi.completeUpload(fileId);
      } catch {
        setUploadError('Файл загружен, но не удалось подтвердить. Попробуйте снова.');
        return;
      }

      if (folderId) {
        await filesApi.moveFolder(fileId, folderId).catch(() => {});
      }

      pendingFileIdRef.current = null;
      qc.invalidateQueries({ queryKey: ['files'] });
      router.back();
    } catch {
      setUploadError('Произошла ошибка. Попробуйте снова.');
    }
  }

  function handleCancelUpload() {
    uploadTaskRef.current?.cancelAsync().catch(() => {});
    uploadTaskRef.current = null;
    if (pendingFileIdRef.current) {
      filesApi.cancelUpload(pendingFileIdRef.current).catch(() => {});
      pendingFileIdRef.current = null;
    }
    setMode('menu');
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <Stack.Screen options={{ title: 'Добавить', presentation: 'modal' }} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {mode === 'menu' && (
          <View style={styles.menu}>
            <TouchableOpacity style={styles.menuItem} onPress={handlePickFile}>
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

            <TouchableOpacity style={styles.menuItem} onPress={() => setMode('document')}>
              <Text style={styles.menuIcon}>📝</Text>
              <View>
                <Text style={styles.menuTitle}>Создать документ</Text>
                <Text style={styles.menuSub}>Markdown-документ для записей</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {mode === 'uploading' && (
          <View style={styles.uploadBox}>
            <Text style={styles.uploadTitle}>Загрузка файла</Text>
            <Text style={styles.uploadName} numberOfLines={2}>{uploadFileName}</Text>
            {!uploadError ? (
              <>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.round(uploadProgress * 100)}%` }]} />
                </View>
                <Text style={styles.progressLabel}>{Math.round(uploadProgress * 100)}%</Text>
                <TouchableOpacity style={styles.cancelUploadBtn} onPress={handleCancelUpload}>
                  <Text style={styles.cancelUploadText}>Отмена</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.uploadErrorText}>{uploadError}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={() => setMode('menu')}>
                  <Text style={styles.retryText}>Назад</Text>
                </TouchableOpacity>
              </>
            )}
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
              keyboardType="default"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleAddLink}
            />
            <Button title="Добавить" onPress={handleAddLink} loading={savingLink} />
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
              returnKeyType="done"
              onSubmitEditing={handleCreateFolder}
            />
            <Text style={styles.typeLabel}>Тип папки</Text>
            <View style={styles.typeRow}>
              {([
                { val: 'default' as const, icon: '🗂', label: 'Обычная' },
                { val: 'gallery' as const, icon: '🖼', label: 'Галерея' },
                { val: 'movies'  as const, icon: '🎬', label: 'Фильмы' },
              ]).map((t) => (
                <TouchableOpacity
                  key={t.val}
                  style={[styles.typeBtn, folderType === t.val && styles.typeBtnActive]}
                  onPress={() => setFolderType(t.val)}
                >
                  <Text style={styles.typeBtnIcon}>{t.icon}</Text>
                  <Text style={[styles.typeBtnText, folderType === t.val && styles.typeBtnTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Button
              title="Создать"
              onPress={handleCreateFolder}
              loading={createFolder.isPending}
            />
          </View>
        )}

        {mode === 'document' && (
          <View style={styles.form}>
            <TouchableOpacity onPress={() => setMode('menu')} style={styles.back}>
              <Text style={styles.backText}>← Назад</Text>
            </TouchableOpacity>
            <Text style={styles.formTitle}>Создать документ</Text>
            <TextInput
              style={styles.input}
              placeholder="Название документа"
              value={docName}
              onChangeText={setDocName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreateDocument}
            />
            <View style={styles.taskRow}>
              <View>
                <Text style={styles.taskRowLabel}>Создать как задачу</Text>
                <Text style={styles.taskRowSub}>Статус и исполнителя можно настроить позже</Text>
              </View>
              <Switch value={docIsTask} onValueChange={setDocIsTask} />
            </View>
            <Button
              title="Создать и открыть"
              onPress={handleCreateDocument}
              loading={creatingDoc}
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
  uploadBox: { backgroundColor: '#fff', borderRadius: 16, padding: 24, gap: 16, alignItems: 'center', marginTop: 20 },
  uploadTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  uploadName: { fontSize: 14, color: '#64748B', textAlign: 'center' },
  progressTrack: { width: '100%', height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#2563EB', borderRadius: 4 },
  progressLabel: { fontSize: 15, color: '#2563EB', fontWeight: '600' },
  cancelUploadBtn: { marginTop: 4, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  cancelUploadText: { fontSize: 15, color: '#64748B' },
  uploadErrorText: { fontSize: 14, color: '#EF4444', textAlign: 'center' },
  retryBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10, backgroundColor: '#EFF6FF' },
  retryText: { fontSize: 15, color: '#2563EB', fontWeight: '600' },
  taskRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  taskRowLabel: { fontSize: 15, color: '#1E293B', fontWeight: '500' },
  taskRowSub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  typeLabel: { fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 8 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', gap: 4 },
  typeBtnActive: { borderColor: '#6366F1', backgroundColor: '#EDE9FE' },
  typeBtnIcon: { fontSize: 22 },
  typeBtnText: { fontSize: 12, color: '#64748B' },
  typeBtnTextActive: { color: '#6366F1', fontWeight: '600' },
});
