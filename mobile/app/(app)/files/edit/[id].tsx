import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, BackHandler, Platform, StyleSheet, Text, TouchableOpacity, View,
  Keyboard,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import WebView, { WebViewMessageEvent } from 'react-native-webview';
import { Animated } from 'react-native';
import { Asset } from 'expo-asset';
import { documentsApi } from '@/api/documents';
import type { MarkdownDocument } from '@/types/document';
import { Spinner } from '@/components/ui/Spinner';
import { getApiError } from '@/utils/error';
import { isAxiosError } from 'axios';

async function resolveEditorUri(): Promise<string> {
  if (Platform.OS === 'android') {
    return 'file:///android_asset/editor.html';
  }
  // iOS: editor-inline.html has the TipTap bundle inlined — no separate .js asset needed
  const [asset] = await Asset.loadAsync([
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../../../../assets/editor/editor-inline.html'),
  ]);
  return asset.localUri!;
}


const TOOLBAR_HEIGHT = 52;

export default function EditDocumentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [phase, setPhase] = useState<'loading' | 'lockPending' | 'ready' | 'lockedByOther' | 'error'>('loading');
  const [editorUri, setEditorUri] = useState<string | null>(null);
  const [doc, setDoc] = useState<MarkdownDocument | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const webViewRef = useRef<WebView>(null);
  const editorReadyRef = useRef(false);
  const editorLoadedRef = useRef(false);
  const hasChangedRef = useRef(false);
  const etagRef = useRef('');
  const pendingContentResolve = useRef<((md: string) => void) | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const docRef = useRef<MarkdownDocument | null>(null);

  // Keyboard offset for back button area (not toolbar — toolbar is inside WebView)
  const kbOffset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    resolveEditorUri().then(setEditorUri).catch(() => {
      setPhase('error');
      setErrorMsg('Не удалось загрузить редактор');
    });
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      kbOffset.setValue(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      kbOffset.setValue(0);
    });
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Load document and acquire lock
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const res = await documentsApi.get(id);
        const document = res.data.data.document;
        if (cancelled) return;

        docRef.current = document;
        etagRef.current = document.etag;
        setDoc(document);

        // If WebView already loaded before API responded, inject content now
        if (editorLoadedRef.current) {
          const content = document.content ?? '';
          webViewRef.current?.injectJavaScript(
            `(function(){if(typeof window._editorInit==='function')window._editorInit(${JSON.stringify(content)},false);})();void 0;`
          );
        }

        if (!document.capabilities.canEdit) {
          setPhase('error');
          setErrorMsg('У вас нет прав на редактирование этого документа');
          return;
        }

        setPhase('lockPending');

        // Try to acquire lock
        try {
          await documentsApi.acquireLock(id);
        } catch (e) {
          if (isAxiosError(e) && e.response?.status === 423) {
            if (cancelled) return;
            setPhase('lockedByOther');
            return;
          }
          // Other error — still try to proceed
        }

        if (cancelled) return;
        setPhase('ready');

        // Heartbeat
        heartbeatRef.current = setInterval(() => {
          documentsApi.heartbeat(id).catch(() => {});
        }, 60_000);

        // Auto-save every 30s
        autoSaveRef.current = setInterval(() => {
          if (hasChangedRef.current) {
            performSave(false);
          }
        }, 30_000);
      } catch {
        if (!cancelled) {
          setPhase('error');
          setErrorMsg('Не удалось загрузить документ');
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
      documentsApi.releaseLock(id).catch(() => {});
    };
  }, [id]);

  // Android hardware back button
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => handler.remove();
  }, []);

  function requestContent(): Promise<string> {
    return new Promise((resolve) => {
      pendingContentResolve.current = resolve;
      webViewRef.current?.injectJavaScript(
        `(function(){var md=window.editor?window.editor.storage.markdown.getMarkdown():'';` +
        `window.ReactNativeWebView.postMessage(JSON.stringify({type:'content',markdown:md}));})(); void 0;`,
      );
      // Timeout fallback
      setTimeout(() => {
        if (pendingContentResolve.current) {
          pendingContentResolve.current('');
          pendingContentResolve.current = null;
        }
      }, 5000);
    });
  }

  async function performSave(showSaving = true) {
    if (!docRef.current) return;
    if (showSaving) setIsSaving(true);
    try {
      const markdown = await requestContent();
      const res = await documentsApi.update(id, markdown, etagRef.current);
      etagRef.current = res.data.data.etag;
      hasChangedRef.current = false;
      const now = new Date();
      setSavedAt(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    } catch (e) {
      if (isAxiosError(e) && e.response?.status === 409) {
        Alert.alert(
          'Конфликт',
          'Документ был изменён другим пользователем. Ваши изменения не были сохранены.',
          [{ text: 'OK' }],
        );
      } else {
        Alert.alert('Ошибка', getApiError(e, 'Не удалось сохранить документ'));
      }
    } finally {
      if (showSaving) setIsSaving(false);
    }
  }

  async function handleBack() {
    if (hasChangedRef.current) {
      Alert.alert(
        'Несохранённые изменения',
        'Сохранить документ перед выходом?',
        [
          { text: 'Выйти без сохранения', style: 'destructive', onPress: () => router.back() },
          {
            text: 'Сохранить',
            onPress: async () => {
              await performSave(true);
              router.back();
            },
          },
          { text: 'Отмена', style: 'cancel' },
        ],
      );
    } else {
      router.back();
    }
  }

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);

      if (msg.type === 'scriptLoaded') {
        // Send init command via document.dispatchEvent — window.postMessage from
        // injectJavaScript is intercepted by react-native-webview's WKScriptMessageHandler
        // on iOS and never reaches window.addEventListener('message') inside the HTML.
        // document.dispatchEvent targets the document listener registered in the HTML.
        const content = docRef.current?.content ?? '';
        const initMsg = JSON.stringify({ cmd: 'init', content, readOnly: false });
        webViewRef.current?.injectJavaScript(
          `document.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(initMsg)}}));void 0;`,
        );
      } else if (msg.type === 'ready') {
        editorReadyRef.current = true;
      } else if (msg.type === 'changed') {
        hasChangedRef.current = true;
      } else if (msg.type === 'content') {
        if (pendingContentResolve.current) {
          pendingContentResolve.current(msg.markdown ?? '');
          pendingContentResolve.current = null;
        }
      } else if (msg.type === 'error') {
        // Editor load failed — show error
        setPhase('error');
        setErrorMsg('Ошибка загрузки редактора. Проверьте подключение к интернету.');
      }
    } catch { /* ignore */ }
  }, []);

  if (phase === 'loading' || phase === 'lockPending') {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Загрузка...' }} />
        <Spinner />
        <Text style={styles.hint}>{phase === 'lockPending' ? 'Получение доступа...' : 'Загрузка документа...'}</Text>
      </View>
    );
  }

  if (phase === 'error') {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Ошибка' }} />
        <Text style={styles.errorText}>{errorMsg}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'lockedByOther' && doc) {
    const locker = doc.lock.lockedBy;
    const lockerName = locker?.name ?? locker?.email ?? 'другой пользователь';
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: doc.fileName }} />
        <Text style={styles.lockIcon}>🔒</Text>
        <Text style={styles.lockTitle}>Документ заблокирован</Text>
        <Text style={styles.lockSub}>Сейчас редактирует: {lockerName}</Text>
        <TouchableOpacity
          style={styles.viewOnlyBtn}
          onPress={() => router.replace(`/(app)/files/view/${id}` as any)}
        >
          <Text style={styles.viewOnlyText}>Открыть для просмотра</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: doc?.fileName ?? 'Редактор',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => performSave(true)}
              disabled={isSaving}
              style={styles.saveBtn}
            >
              <Text style={styles.saveBtnText}>
                {isSaving ? 'Сохранение...' : savedAt ? `Сохранено ${savedAt}` : 'Сохранить'}
              </Text>
            </TouchableOpacity>
          ),
          headerLeft: () => (
            <TouchableOpacity onPress={handleBack} style={styles.headerBackBtn}>
              <Text style={styles.headerBackText}>‹ Назад</Text>
            </TouchableOpacity>
          ),
        }}
      />

      {editorUri && (
        <WebView
          ref={webViewRef}
          style={styles.webview}
          source={{ uri: editorUri }}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          allowFileAccess
          allowFileAccessFromFileURLs
          allowUniversalAccessFromFileURLs
          keyboardDisplayRequiresUserAction={false}
          onMessage={handleMessage}
          onLoadEnd={() => {
            editorLoadedRef.current = true;
            // If API already responded, inject now; otherwise editorLoadedRef
            // tells the init() callback to inject once the document arrives.
            if (docRef.current) {
              const content = docRef.current.content ?? '';
              webViewRef.current?.injectJavaScript(
                `(function(){if(typeof window._editorInit==='function')window._editorInit(${JSON.stringify(content)},false);})();void 0;`
              );
            }
          }}
          scrollEnabled
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  webview: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  hint: { fontSize: 14, color: '#94A3B8' },
  errorText: { fontSize: 15, color: '#EF4444', textAlign: 'center' },
  backBtn: { paddingVertical: 10, paddingHorizontal: 24, backgroundColor: '#EFF6FF', borderRadius: 10, marginTop: 8 },
  backBtnText: { fontSize: 15, color: '#2563EB', fontWeight: '600' },
  lockIcon: { fontSize: 40 },
  lockTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  lockSub: { fontSize: 14, color: '#64748B', textAlign: 'center' },
  viewOnlyBtn: { paddingVertical: 12, paddingHorizontal: 28, backgroundColor: '#2563EB', borderRadius: 10, marginTop: 8 },
  viewOnlyText: { fontSize: 15, color: '#fff', fontWeight: '600' },
  saveBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  saveBtnText: { fontSize: 14, color: '#2563EB', fontWeight: '600' },
  headerBackBtn: { paddingHorizontal: 4, paddingVertical: 6 },
  headerBackText: { fontSize: 17, color: '#2563EB' },
});
