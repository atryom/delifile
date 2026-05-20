import { useRef, useEffect, useState } from 'react';
import { Alert, Keyboard, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Stack } from 'expo-router';
import { useContacts, useContactRequests, useCreateContact, useAcceptContactRequest, useRejectContactRequest } from '@/hooks/useContacts';
import { useInboxCount, useInboxFiles, useInboxSharedFolders, useAcceptInboxFile, useRejectInboxFile, useAcceptInboxFolder, useRejectInboxFolder } from '@/hooks/useInbox';
import { Spinner } from '@/components/ui/Spinner';
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
  const [adding, setAdding] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [kbHeight, setKbHeight] = useState(0);
  const nameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const { data, isLoading } = useContacts(search || undefined);
  const createContact = useCreateContact();

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  function openForm() {
    setInviteEmail('');
    setInviteName('');
    setAdding(true);
    nameRef.current?.focus();
  }

  function closeForm() {
    Keyboard.dismiss();
    setAdding(false);
    setInviteEmail('');
    setInviteName('');
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    try {
      await createContact.mutateAsync({ email: inviteEmail.trim(), name: inviteName.trim() || inviteEmail.trim() });
      closeForm();
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
        <TouchableOpacity style={styles.inviteBtn} onPress={openForm}>
          <Text style={styles.inviteBtnText}>＋</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <Spinner />
      ) : (
        <ScrollView contentContainerStyle={adding ? { paddingBottom: 220 } : undefined}>
          {(data ?? []).length === 0 ? (
            <Text style={styles.empty}>Нет контактов</Text>
          ) : (
            (data ?? []).map((c) => <ContactItem key={c.id} contact={c} />)
          )}
        </ScrollView>
      )}

      {adding && (
        <View style={[styles.inputBar, { bottom: kbHeight }]}>
          <Text style={styles.barTitle}>Добавить контакт</Text>
          <TextInput
            ref={nameRef}
            style={styles.input}
            placeholder="Имя контакта"
            placeholderTextColor="#94A3B8"
            value={inviteName}
            onChangeText={setInviteName}
            autoFocus
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
          />
          <TextInput
            ref={emailRef}
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#94A3B8"
            value={inviteEmail}
            onChangeText={setInviteEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={handleInvite}
          />
          <View style={styles.barButtons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={closeForm}>
              <Text style={styles.cancelText}>Отмена</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, createContact.isPending && styles.saveBtnDisabled]}
              onPress={handleInvite}
              disabled={createContact.isPending}
            >
              <Text style={styles.saveText}>Добавить</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

function RequestsTab() {
  const { data: contactRequests, isLoading: crLoading, refetch: refetchCR } = useContactRequests();
  const { data: inboxFiles, isLoading: ifLoading, refetch: refetchFiles } = useInboxFiles();
  const { data: inboxFolders, isLoading: sfLoading, refetch: refetchFolders } = useInboxSharedFolders();

  const acceptCR = useAcceptContactRequest();
  const rejectCR = useRejectContactRequest();
  const acceptFile = useAcceptInboxFile();
  const rejectFile = useRejectInboxFile();
  const acceptFolder = useAcceptInboxFolder();
  const rejectFolder = useRejectInboxFolder();

  const pending = contactRequests?.filter((r) => r.status === 'pending') ?? [];
  const isLoading = crLoading || ifLoading || sfLoading;
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([refetchCR(), refetchFiles(), refetchFolders()]);
    setRefreshing(false);
  }

  if (isLoading && !refreshing) return <Spinner />;

  const hasAnything = pending.length > 0 || (inboxFiles?.length ?? 0) > 0 || (inboxFolders?.length ?? 0) > 0;

  return (
    <ScrollView style={styles.flex} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
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
  const { data: inboxCount } = useInboxCount();
  const { data: contactReqs } = useContactRequests();
  const requestsBadge =
    (inboxCount?.total ?? 0) + (contactReqs?.filter((r) => r.status === 'pending').length ?? 0);

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
          <View style={styles.segBtnInner}>
            <Text style={[styles.segText, tab === 'requests' && styles.segTextActive]}>Запросы</Text>
            {requestsBadge > 0 && (
              <View style={styles.segBadge}>
                <Text style={styles.segBadgeText}>{requestsBadge > 99 ? '99+' : requestsBadge}</Text>
              </View>
            )}
          </View>
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
  segBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  segText: { fontSize: 15, fontWeight: '500', color: '#94A3B8' },
  segTextActive: { color: '#2563EB' },
  segBadge: { backgroundColor: '#EF4444', borderRadius: 8, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  segBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
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
  inputBar: { position: 'absolute', left: 0, right: 0, backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderTopWidth: 1, borderTopColor: '#E2E8F0', gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 8 },
  barTitle: { fontSize: 16, fontWeight: '600', color: '#1E293B' },
  input: { height: 48, backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 14, fontSize: 16, color: '#1E293B', borderWidth: 1, borderColor: '#E2E8F0' },
  barButtons: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, height: 44, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 15, color: '#64748B' },
  saveBtn: { flex: 1, height: 44, borderRadius: 10, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: { fontSize: 15, color: '#fff', fontWeight: '600' },
});
