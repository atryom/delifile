import { useRef, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useQueryClient } from '@tanstack/react-query';
import { sharedFoldersApi } from '@/api/shared-folders';
import { documentsApi } from '@/api/documents';
import { Button } from '@/components/ui/Button';

type Mode = 'menu' | 'link' | 'subfolder' | 'uploading' | 'document';

export default function SharedFolderAddScreen() {
  const params = useLocalSearchParams<{ shared_folder_id: string; folder_name?: string }>();
  const folderId = params.shared_folder_id;
  const qc = useQueryClient();

  const [mode, setMode] = useState<Mode>('menu');
  const [subfolderName, setSubfolderName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [savingLink, setSavingLink] = useState(false);

  const [docName, setDocName] = useState('');
  const [creatingDoc, setCreatingDoc] = useState(false);

  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadTaskRef = useRef<FileSystem.UploadTask | null>(null);
  const pendingFileIdRef = useRef<string | null>(null);

  async function handleCreateDocument() {
    const name = docName.trim() || 'Новый документ';
    setCreatingDoc(true);
    try {
      const res = await documentsApi.create(name);
      const docId = res.data.data.document.id;
      await sharedFoldersApi.addFile(folderId, docId).catch(() => {});
      qc.invalidateQueries({ queryKey: ['shared-folders', folderId] });
      router.back();
      setTimeout(() => router.push(`/(app)/files/edit/${docId}` as any), 300);
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message ?? 'Не удалось создать документ');
    } finally {
      setCreatingDoc(false);
    }
  }

  async function handleCreateSubfolder() {
    if (!subfolderName.trim()) return;
    try {
      await sharedFoldersApi.createSubfolder(folderId, subfolderName.trim());
      qc.invalidateQueries({ queryKey: ['shared-folders', folderId] });
      router.back();
    } catch {
      Alert.alert('Ошибка', 'Не удалось создать подпапку');
    }
  }

  async function handleAddLink() {
    const raw = linkUrl.trim();
    if (!raw) return;
    let url = raw;
    try { url = encodeURI(decodeURI(raw)); } catch { url = raw; }
    setSavingLink(true);
    try {
      await sharedFoldersApi.addUrlFile(folderId, url);
      qc.invalidateQueries({ queryKey: ['shared-folders', folderId] });
      router.back();
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message ?? 'Не удалось добавить ссылку');
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

      setUploadFileName(name);
      setUploadProgress(0);
      setUploadError(null);
      setMode('uploading');

      let fileId: string;
      let putUrl: string;
      let putHeaders: Record<string, string>;
      try {
        const initRes = await sharedFoldersApi.initUpload(folderId, {
          original_name: name,
          size,
          mime_type: mimeType,
        });
        fileId = initRes.data.data.file.id;
        putUrl = initRes.data.data.upload.url;
        putHeaders = initRes.data.data.upload.headers;
      } catch (e: any) {
        setUploadError(e.response?.data?.message ?? 'Не удалось инициализировать загрузку');
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
          // no cancel endpoint for shared folder uploads — file will expire
          pendingFileIdRef.current = null;
        }
        setMode('menu');
        return;
      }
      uploadTaskRef.current = null;

      if (!uploadResult || uploadResult.status < 200 || uploadResult.status >= 300) {
        setUploadError(`Ошибка загрузки на сервер (${uploadResult?.status ?? '?'})`);
        return;
      }

      try {
        await sharedFoldersApi.completeUpload(folderId, fileId);
      } catch {
        setUploadError('Файл загружен, но не удалось подтвердить. Попробуйте снова.');
        return;
      }

      pendingFileIdRef.current = null;
      qc.invalidateQueries({ queryKey: ['shared-folders', folderId] });
      router.back();
    } catch {
      setUploadError('Произошла ошибка. Попробуйте снова.');
    }
  }

  function handleCancelUpload() {
    uploadTaskRef.current?.cancelAsync().catch(() => {});
    uploadTaskRef.current = null;
    pendingFileIdRef.current = null;
    setMode('menu');
  }

  const parentName = params.folder_name ?? 'папку';

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

            <TouchableOpacity style={styles.menuItem} onPress={() => setMode('subfolder')}>
              <Text style={styles.menuIcon}>🗂</Text>
              <View>
                <Text style={styles.menuTitle}>Создать подпапку</Text>
                <Text style={styles.menuSub}>Внутри «{parentName}»</Text>
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

        {mode === 'subfolder' && (
          <View style={styles.form}>
            <TouchableOpacity onPress={() => setMode('menu')} style={styles.back}>
              <Text style={styles.backText}>← Назад</Text>
            </TouchableOpacity>
            <Text style={styles.formTitle}>Создать подпапку</Text>
            <TextInput
              style={styles.input}
              placeholder="Название подпапки"
              value={subfolderName}
              onChangeText={setSubfolderName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreateSubfolder}
            />
            <Button title="Создать" onPress={handleCreateSubfolder} />
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
            <Button title="Создать и открыть" onPress={handleCreateDocument} loading={creatingDoc} />
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
});
