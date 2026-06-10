import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, router } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { useQueryClient } from '@tanstack/react-query';
import ShareIntentModule from '@/native/shareIntent';
import { filesApi } from '@/api/files';
import { Spinner } from '@/components/ui/Spinner';
import { getApiError } from '@/utils/error';

type Phase =
  | { kind: 'loading' }
  | { kind: 'uploading'; name: string; progress: number }
  | { kind: 'saving_url'; url: string }
  | { kind: 'error'; message: string }
  | { kind: 'done' };

export default function ShareScreen() {
  const qc = useQueryClient();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const uploadTaskRef = useRef<FileSystem.UploadTask | null>(null);
  const pendingFileId = useRef<string | null>(null);

  useEffect(() => {
    const mod = ShareIntentModule;
    if (!mod) { setPhase({ kind: 'error', message: 'Share Intent недоступен' }); return; }

    mod.getSharedData().then(async (data: any) => {
      if (!data) { router.back(); return; }

      if (data.type === 'text') {
        // Text/URL is already in memory — safe to clear the shared payload now.
        mod.clearSharedData().catch(() => {});
        const text: string = data.text ?? '';
        const isUrl = text.startsWith('http://') || text.startsWith('https://');
        if (isUrl) {
          await handleUrl(text.trim());
        } else {
          // Chrome shares as "Page title https://url" — extract URL from anywhere in text
          const urlMatch = text.match(/https?:\/\/[^\s]+/);
          if (urlMatch) {
            await handleUrl(urlMatch[0]);
          } else {
            setPhase({ kind: 'error', message: `Получен текст:\n"${text.slice(0, 120)}"\n\nDeliFile поддерживает только ссылки и файлы.` });
          }
        }
      } else if (data.type === 'file') {
        // Android: data.fileName  |  iOS extension: data.name (both stored by ShareViewController)
        const fileName = data.fileName ?? data.name ?? 'file';
        // NOTE: do NOT clear shared data here. On iOS clearSharedData() also wipes
        // the file from the App Group container, and handleFile reads it from there.
        // handleFile clears only after it has secured a local cache copy.
        await handleFile(data.uri, fileName, data.mimeType ?? 'application/octet-stream');
      } else {
        mod.clearSharedData().catch(() => {});
        router.back();
      }
    }).catch(() => {
      setPhase({ kind: 'error', message: 'Не удалось получить данные' });
    });

    return () => {
      uploadTaskRef.current?.cancelAsync().catch(() => {});
    };
  }, []);

  async function handleUrl(url: string) {
    setPhase({ kind: 'saving_url', url });
    try {
      let normalized = url;
      try { normalized = encodeURI(decodeURI(url)); } catch { normalized = url; }
      await filesApi.createUrlFile(normalized);
      qc.invalidateQueries({ queryKey: ['files'] });
      setPhase({ kind: 'done' });
      setTimeout(() => router.back(), 1000);
    } catch (e) {
      setPhase({ kind: 'error', message: getApiError(e, 'Не удалось сохранить ссылку') });
    }
  }

  async function handleFile(uri: string, name: string, mimeType: string) {
    setPhase({ kind: 'uploading', name, progress: 0 });

    // Always copy the shared source into the app cache first to obtain a stable
    // file:// copy we fully control, THEN clear the shared payload. This is
    // required on iOS, where the source lives in the App Group container and
    // clearSharedData() also wipes that container — reading it directly races
    // with the cleanup and aborts the upload. content:// (Android) likewise needs
    // a file:// copy because FileSystem.createUploadTask can't read content://.
    let localUri = uri;
    let cacheUri: string | null = null;
    try {
      cacheUri = (FileSystem.cacheDirectory ?? '') + name.replace(/[^a-zA-Z0-9._-]/g, '_');
      await FileSystem.copyAsync({ from: uri, to: cacheUri });
      localUri = cacheUri;
    } catch {
      ShareIntentModule?.clearSharedData?.().catch(() => {});
      setPhase({ kind: 'error', message: 'Не удалось прочитать файл. Возможно, приложение не имеет к нему доступа.' });
      return;
    }

    // Local copy secured — now safe to clear the shared payload / App Group file.
    ShareIntentModule?.clearSharedData?.().catch(() => {});

    let size = 0;
    try {
      const info = await FileSystem.getInfoAsync(localUri);
      if (info.exists) size = (info as any).size ?? 0;
    } catch { /* size stays 0 */ }

    let fileId: string;
    let putUrl: string;
    let putHeaders: Record<string, string>;
    try {
      const initRes = await filesApi.initUpload({ original_name: name, size, mime_type: mimeType });
      fileId = initRes.data.data.file.id;
      putUrl = initRes.data.data.upload.url;
      putHeaders = initRes.data.data.upload.headers;
    } catch (e) {
      if (cacheUri) FileSystem.deleteAsync(cacheUri, { idempotent: true }).catch(() => {});
      setPhase({ kind: 'error', message: getApiError(e, 'Не удалось начать загрузку') });
      return;
    }

    pendingFileId.current = fileId;

    const task = FileSystem.createUploadTask(
      putUrl, localUri,
      { httpMethod: 'PUT', uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT, headers: putHeaders },
      (p) => {
        if (p.totalBytesExpectedToSend > 0) {
          setPhase({ kind: 'uploading', name, progress: p.totalBytesSent / p.totalBytesExpectedToSend });
        }
      },
    );
    uploadTaskRef.current = task;

    let result: FileSystem.FileSystemUploadResult | null | undefined;
    try {
      result = await task.uploadAsync();
    } catch {
      filesApi.cancelUpload(fileId).catch(() => {});
      pendingFileId.current = null;
      if (cacheUri) FileSystem.deleteAsync(cacheUri, { idempotent: true }).catch(() => {});
      setPhase({ kind: 'error', message: 'Загрузка прервана' });
      return;
    }
    uploadTaskRef.current = null;
    if (cacheUri) FileSystem.deleteAsync(cacheUri, { idempotent: true }).catch(() => {});

    if (!result || result.status < 200 || result.status >= 300) {
      filesApi.cancelUpload(fileId).catch(() => {});
      setPhase({ kind: 'error', message: `Ошибка загрузки (${result?.status ?? '?'})` });
      return;
    }

    try {
      await filesApi.completeUpload(fileId);
    } catch {
      setPhase({ kind: 'error', message: 'Файл загружен, но не подтверждён. Проверьте в списке файлов.' });
      return;
    }

    pendingFileId.current = null;
    qc.invalidateQueries({ queryKey: ['files'] });
    setPhase({ kind: 'done' });
    setTimeout(() => router.back(), 1000);
  }

  function handleCancel() {
    uploadTaskRef.current?.cancelAsync().catch(() => {});
    if (pendingFileId.current) filesApi.cancelUpload(pendingFileId.current).catch(() => {});
    router.back();
  }

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: 'Сохранить в DeliFile', presentation: 'modal' }} />

      <View style={styles.card}>
        {phase.kind === 'loading' && (
          <>
            <Spinner />
            <Text style={styles.label}>Получение данных...</Text>
          </>
        )}

        {phase.kind === 'saving_url' && (
          <>
            <Spinner />
            <Text style={styles.label}>Сохраняю ссылку...</Text>
            <Text style={styles.sub} numberOfLines={2}>{phase.url}</Text>
          </>
        )}

        {phase.kind === 'uploading' && (
          <>
            <Text style={styles.title}>Загрузка файла</Text>
            <Text style={styles.sub} numberOfLines={2}>{phase.name}</Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round(phase.progress * 100)}%` }]} />
            </View>
            <Text style={styles.pct}>{Math.round(phase.progress * 100)}%</Text>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
              <Text style={styles.cancelText}>Отмена</Text>
            </TouchableOpacity>
          </>
        )}

        {phase.kind === 'done' && (
          <>
            <Text style={styles.doneIcon}>✅</Text>
            <Text style={styles.title}>Сохранено!</Text>
            <Text style={styles.sub}>Файл добавлен в DeliFile</Text>
          </>
        )}

        {phase.kind === 'error' && (
          <>
            <Text style={styles.doneIcon}>⚠️</Text>
            <Text style={styles.errorText}>{phase.message}</Text>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Text style={styles.backText}>Закрыть</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: {
    width: '100%', backgroundColor: '#fff', borderRadius: 20,
    padding: 28, alignItems: 'center', gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 8,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#1E293B', textAlign: 'center' },
  label: { fontSize: 15, color: '#64748B' },
  sub: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },
  track: { width: '100%', height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#2563EB', borderRadius: 4 },
  pct: { fontSize: 16, fontWeight: '600', color: '#2563EB' },
  doneIcon: { fontSize: 40 },
  errorText: { fontSize: 14, color: '#EF4444', textAlign: 'center', lineHeight: 20 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 28, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  cancelText: { fontSize: 15, color: '#64748B' },
  backBtn: { paddingVertical: 10, paddingHorizontal: 28, borderRadius: 10, backgroundColor: '#EFF6FF' },
  backText: { fontSize: 15, color: '#2563EB', fontWeight: '600' },
});
