import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useAuthStore } from '@/store/auth';
import { authApi } from '@/api/auth';
import type { User } from '@/types';

type PrivacyKey = 'allow_contacts_without_confirmation' | 'auto_add_received_files';

const ITEMS: { key: PrivacyKey; title: string; sub: string }[] = [
  {
    key: 'allow_contacts_without_confirmation',
    title: 'Контакты без подтверждения',
    sub: 'Разрешить добавлять меня в контакты без моего подтверждения',
  },
  {
    key: 'auto_add_received_files',
    title: 'Автодобавление файлов',
    sub: 'Автоматически добавлять полученные файлы в мои файлы',
  },
];

export default function PrivacyScreen() {
  const { user, setUser } = useAuthStore();

  async function toggle(key: PrivacyKey, value: boolean) {
    if (!user) return;
    const updated = { ...user, [key]: value };
    setUser(updated);
    try {
      const res = await authApi.updateSettings({ [key]: value });
      setUser(res.data.data.user);
    } catch {
      setUser(user);
    }
  }

  if (!user) return null;

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen options={{ title: 'Приватность' }} />

      <View style={styles.section}>
        {ITEMS.map((item, i) => (
          <View key={item.key} style={[styles.item, i < ITEMS.length - 1 && styles.itemBorder]}>
            <View style={styles.itemText}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemSub}>{item.sub}</Text>
            </View>
            <Switch
              value={user[item.key] as boolean}
              onValueChange={(v) => toggle(item.key, v)}
              trackColor={{ true: '#2563EB' }}
            />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  section: { backgroundColor: '#fff', borderRadius: 12, marginHorizontal: 16, marginTop: 20, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  itemText: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: '500', color: '#1E293B' },
  itemSub: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
});
