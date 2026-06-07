import { useState, useEffect } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import Markdown from 'react-native-markdown-display';
import { documentsApi } from '@/api/documents';
import type { MarkdownDocument } from '@/types/document';
import { Spinner } from '@/components/ui/Spinner';
import { formatDateTime } from '@/utils/format';

// react-native-markdown-display (markdown-it 10) has no GitHub task-list support,
// so "- [ ]" / "- [x]" would render as the literal text "[]". For this read-only
// view, rewrite the checkbox marker at the start of each list item to a glyph.
const TASK_ITEM_RE = /^(\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\]\s+/gm;
function renderTaskCheckboxes(md: string): string {
  return md.replace(TASK_ITEM_RE, (_m, marker: string, state: string) =>
    `${marker}${state.toLowerCase() === 'x' ? '☑' : '☐'} `);
}

export default function ViewDocumentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [doc, setDoc] = useState<MarkdownDocument | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    documentsApi.get(id)
      .then((res) => {
        setDoc(res.data.data.document);
        setPhase('ready');
      })
      .catch(() => {
        setErrorMsg('Не удалось загрузить документ');
        setPhase('error');
      });
  }, [id]);

  if (phase === 'loading') {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Документ' }} />
        <Spinner />
      </View>
    );
  }

  if (phase === 'error' || !doc) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Документ' }} />
        <Text style={styles.errorText}>{errorMsg}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: doc.fileName }} />

      {doc.lock.isLocked && (
        <View style={styles.lockBanner}>
          <Text style={styles.lockText}>
            Редактирует: {doc.lock.lockedBy?.name ?? doc.lock.lockedBy?.email ?? 'другой пользователь'}
          </Text>
        </View>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {doc.updatedAt && (
          <Text style={styles.meta}>
            Обновлён: {formatDateTime(doc.updatedAt)}
            {doc.updatedBy ? ` · ${doc.updatedBy.name ?? doc.updatedBy.email}` : ''}
          </Text>
        )}

        {doc.content.trim() ? (
          <Markdown style={markdownStyles}>{renderTaskCheckboxes(doc.content)}</Markdown>
        ) : (
          <Text style={styles.empty}>Документ пуст</Text>
        )}
      </ScrollView>

      {doc.capabilities.canEdit && (
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => router.push(`/(app)/files/edit/${id}` as any)}
        >
          <Text style={styles.editBtnText}>✏️ Редактировать</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 32 },
  meta: { fontSize: 12, color: '#94A3B8', marginBottom: 16 },
  empty: { fontSize: 15, color: '#94A3B8', textAlign: 'center', marginTop: 32 },
  errorText: { fontSize: 15, color: '#EF4444' },
  backBtn: { paddingVertical: 10, paddingHorizontal: 24, backgroundColor: '#EFF6FF', borderRadius: 10 },
  backBtnText: { fontSize: 15, color: '#2563EB', fontWeight: '600' },
  lockBanner: { backgroundColor: '#FEF3C7', paddingVertical: 8, paddingHorizontal: 16 },
  lockText: { fontSize: 13, color: '#92400E', textAlign: 'center' },
  editBtn: {
    margin: 16, paddingVertical: 14, alignItems: 'center', backgroundColor: '#2563EB',
    borderRadius: 12,
  },
  editBtnText: { fontSize: 16, color: '#fff', fontWeight: '600' },
});

const markdownStyles = StyleSheet.create({
  body: { fontSize: 15, color: '#1E293B', lineHeight: 24 },
  heading1: { fontSize: 24, fontWeight: '700', color: '#0F172A', marginBottom: 8, marginTop: 20 },
  heading2: { fontSize: 20, fontWeight: '700', color: '#1E293B', marginBottom: 6, marginTop: 16 },
  heading3: { fontSize: 17, fontWeight: '700', color: '#1E293B', marginBottom: 4, marginTop: 12 },
  paragraph: { marginBottom: 10 },
  bullet_list: { marginBottom: 8 },
  ordered_list: { marginBottom: 8 },
  list_item: { marginBottom: 4 },
  code_inline: {
    backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4, fontFamily: 'monospace', fontSize: 13,
  },
  fence: {
    backgroundColor: '#F1F5F9', padding: 12, borderRadius: 8, marginBottom: 10,
    fontFamily: 'monospace', fontSize: 13,
  },
  blockquote: {
    borderLeftWidth: 3, borderLeftColor: '#E2E8F0',
    paddingLeft: 12, marginBottom: 10, color: '#64748B',
  },
  hr: { borderTopWidth: 2, borderColor: '#E2E8F0', marginVertical: 16 },
  table: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, marginBottom: 12 },
  thead: { backgroundColor: '#F8FAFC' },
  th: { padding: 10, fontWeight: '600', fontSize: 14, color: '#1E293B' },
  td: { padding: 10, fontSize: 14, color: '#374151' },
  tr: { borderBottomWidth: 1, borderColor: '#E2E8F0' },
  link: { color: '#2563EB', textDecorationLine: 'underline' },
  strong: { fontWeight: '700' },
  em: { fontStyle: 'italic' },
});
