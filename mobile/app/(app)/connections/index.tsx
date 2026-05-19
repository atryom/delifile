import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Modal } from 'react-native';
import { Stack } from 'expo-router';
import { useContacts, useContactRequests, useCreateContact, useAcceptContactRequest, useRejectContactRequest } from '@/hooks/useContacts';
import { useInboxFiles, useInboxSharedFolders, useAcceptInboxFile, useRejectInboxFile, useAcceptInboxFolder, useRejectInboxFolder } from '@/hooks/useInbox';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import type { Contact } from '@/types';

type Tab = 'contacts' | 'requests';

function ContactItem({ contact }: { contact: Contact }) {
  const name = contact.name || contact.resolved_user?.name || '—';
  const email = contact.email || contact.resolved_user?.email || '';
  return (
    <View style={styles.listItem}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{(name[0] || '?').toUpperCase()}</Text>
      </View>
      <View style={styles.itemMain}>
        <Text style={styles.itemTitle}>{name}</Text>
        {email ? <Text style={styles.itemSub}>{email}</Text> : null}
        {!contact.is_registered && <Text style={styles.itemTag}>Приглашён</Text>}
      </View>
    </View>
  );
}

function RequestActions({ onAccept, onReject, loading }: { onAccept: () => void; onReject: () => void; loading?: boolean }) {
  return (
    <View style={styles.actions}>
      <TouchableOpacity style={styles.acceptBtn} onPress={onAccept} disabled={loading}>
        <Text style={styles.acceptText}>✓</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.rejectBtn} onPress={onReject} disabled={loading}>
        <Text style={styles.rejectText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

function ContactsTab() {
  const [search, setSearch] = useState('');
  const [inviteModal, setInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const { data, isLoading } = useContacts(search || undefined);
  const createContact = useCreateContact();

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    try {
      await createContact.mutateAsync(inviteEmail.trim());
      setInviteEmail('');
      setInviteModal(false);
      Alert.alert('Готово', 'Контакт добавлен');
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message ?? 'Не удалось добавить контакт');
    }
  }

  return (
    <View style={styles.flex}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.search}
          placeholder="Поиск контактов..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#94A3B8"
        />
        <TouchableOpacity style={styles.inviteBtn} onPress={() => setInviteModal(true)}>
          <Text style={styles.inviteBtnText}>＋</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <Spinner />
      ) : (
        <ScrollView>
          {(data ?? []).length === 0 ? (
            <Text style={styles.empty}>Нет контактов</Text>
          ) : (
            (data ?? []).map((c) => <ContactItem key={c.id} contact={c} />)
          )}
        </ScrollView>
      )}

      <Modal visible={inviteModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Добавить контакт</Text>
            <TextInput
              style={styles.input}
              placeholder="Email пользователя"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
            />
            <Button title="Добавить" onPress={handleInvite} loading={createContact.isPending} />
            <TouchableOpacity onPress={() => setInviteModal(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function RequestsTab() {
  const { data: contactRequests, isLoading: crLoading } = useContactRequests();
  const { data: inboxFiles, isLoading: ifLoading } = useInboxFiles();
  const { data: inboxFolders, isLoading: sfLoading } = useInboxSharedFolders();

  const acceptCR = useAcceptContactRequest();
  const rejectCR = useRejectContactRequest();
  const acceptFile = useAcceptInboxFile();
  const rejectFile = useRejectInboxFile();
  const acceptFolder = useAcceptInboxFolder();
  const rejectFolder = useRejectInboxFolder();

  const pending = contactRequests?.filter((r) => r.status === 'pending') ?? [];
  const isLoading = crLoading || ifLoading || sfLoading;

  if (isLoading) return <Spinner />;

  const hasAnything = pending.length > 0 || (inboxFiles?.length ?? 0) > 0 || (inboxFolders?.length ?? 0) > 0;

  return (
    <ScrollView style={styles.flex}>
      {!hasAnything && <Text style={styles.empty}>Нет входящих запросов</Text>}

      {pending.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Запросы в контакты</Text>
          {pending.map((r) => (
            <View key={r.id} style={styles.requestItem}>
              <View style={styles.itemMain}>
                <Text style={styles.itemTitle}>{r.requester.name ?? r.requester.email}</Text>
                <Text style={styles.itemSub}>{r.requester.email}</Text>
              </View>
              <RequestActions
                onAccept={() => acceptCR.mutate(r.id)}
                onReject={() => rejectCR.mutate(r.id)}
              />
            </View>
          ))}
        </View>
      )}

      {(inboxFiles?.length ?? 0) > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Входящие файлы</Text>
          {(inboxFiles ?? []).map((item) => (
            <View key={item.id} style={styles.requestItem}>
              <View style={styles.itemMain}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {item.file?.original_name ?? 'Файл'}
                </Text>
                <Text style={styles.itemSub}>{item.sender?.name ?? item.sender?.email ?? ''}</Text>
              </View>
              <RequestActions
                onAccept={() => acceptFile.mutate(item.id)}
                onReject={() => rejectFile.mutate(item.id)}
              />
            </View>
          ))}
        </View>
      )}

      {(inboxFolders?.length ?? 0) > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Приглашения в папки</Text>
          {(inboxFolders ?? []).map((item) => (
            <View key={item.id} style={styles.requestItem}>
              <View style={styles.itemMain}>
                <Text style={styles.itemTitle}>{item.folder?.name ?? 'Папка'}</Text>
                <Text style={styles.itemSub}>{item.inviter?.name ?? item.inviter?.email ?? ''}</Text>
              </View>
              <RequestActions
                onAccept={() => acceptFolder.mutate(item.id)}
                onReject={() => rejectFolder.mutate(item.id)}
              />
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

export default function ConnectionsScreen() {
  const [tab, setTab] = useState<Tab>('contacts');

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: 'Связи', headerShown: false }} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Связи</Text>
      </View>

      <View style={styles.segmented}>
        <TouchableOpacity
          style={[styles.segBtn, tab === 'contacts' && styles.segBtnActive]}
          onPress={() => setTab('contacts')}
        >
          <Text style={[styles.segText, tab === 'contacts' && styles.segTextActive]}>Контакты</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segBtn, tab === 'requests' && styles.segBtnActive]}
          onPress={() => setTab('requests')}
        >
          <Text style={[styles.segText, tab === 'requests' && styles.segTextActive]}>Запросы</Text>
        </TouchableOpacity>
      </View>

      {tab === 'contacts' ? <ContactsTab /> : <RequestsTab />}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerTitle: { fontSize: 28, fontWeight: '700', color: '#1E293B' },
  segmented: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingHorizontal: 16, gap: 0 },
  segBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  segBtnActive: { borderBottomColor: '#2563EB' },
  segText: { fontSize: 15, fontWeight: '500', color: '#94A3B8' },
  segTextActive: { color: '#2563EB' },
  searchRow: { flexDirection: 'row', padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', gap: 8 },
  search: { flex: 1, height: 40, backgroundColor: '#F1F5F9', borderRadius: 10, paddingHorizontal: 14, fontSize: 15, color: '#1E293B' },
  inviteBtn: { width: 40, height: 40, backgroundColor: '#2563EB', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  inviteBtnText: { color: '#fff', fontSize: 22, lineHeight: 26 },
  listItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#2563EB' },
  itemMain: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: '500', color: '#1E293B' },
  itemSub: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  itemTag: { fontSize: 11, color: '#F59E0B', fontWeight: '600', marginTop: 2 },
  section: { marginTop: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#F8FAFC' },
  requestItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 12 },
  actions: { flexDirection: 'row', gap: 8 },
  acceptBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' },
  acceptText: { fontSize: 16, color: '#059669' },
  rejectBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  rejectText: { fontSize: 14, color: '#EF4444', fontWeight: '700' },
  empty: { textAlign: 'center', color: '#94A3B8', fontSize: 15, marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 12 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  input: { height: 48, backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 14, fontSize: 16, color: '#1E293B', borderWidth: 1, borderColor: '#E2E8F0' },
  cancelBtn: { alignItems: 'center', paddingVertical: 8 },
  cancelText: { fontSize: 15, color: '#94A3B8' },
});
