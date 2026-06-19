import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { authApi } from '@/api/auth';
import { pushApi } from '@/api/push';
import type { User } from '@/types';

type NotifKey = 'notifications_enabled' | 'notify_new_files' | 'notify_folder_shared' |
  'notify_shared_folder_updates' | 'notify_comments' | 'notify_mentions' |
  'notify_support_reply' | 'notify_contacts_added' | 'notify_task_assigned';

const ITEMS: { key: NotifKey; title: string; sub: string }[] = [
  { key: 'notify_new_files',            title: 'Новые файлы',          sub: 'Файлы, поделённые со мной' },
  { key: 'notify_folder_shared',        title: 'Доступ к папке',       sub: 'Когда мне дали доступ к папке' },
  { key: 'notify_shared_folder_updates',title: 'Обновления папок',     sub: 'Новые файлы в общих папках' },
  { key: 'notify_comments',             title: 'Комментарии',          sub: 'Новые комментарии к моим файлам' },
  { key: 'notify_mentions',             title: 'Упоминания',           sub: 'Когда меня упомянули' },
  { key: 'notify_support_reply',        title: 'Ответы поддержки',     sub: 'Ответы на обращения в поддержку' },
  { key: 'notify_contacts_added',       title: 'Новые контакты',       sub: 'Запросы на добавление в контакты' },
  { key: 'notify_task_assigned',        title: 'Назначенные задачи',   sub: 'Когда мне назначена задача' },
];

export default function NotificationsScreen() {
  const { user, setUser } = useAuthStore();
  const [permStatus, setPermStatus] = useState<string>('checking');
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => setPermStatus(status));
  }, []);

  async function reregisterToken() {
    setRegistering(true);
    try {
      const { status, canAskAgain } = await Notifications.requestPermissionsAsync();
      setPermStatus(status);
      if (status !== 'granted') {
        if (!canAskAgain) {
          Alert.alert(
            'Разрешение отклонено',
            'Откройте Настройки → Приложения → DeliFile → Уведомления и включите их.',
            [{ text: 'Отмена' }, { text: 'Настройки', onPress: () => Linking.openSettings() }],
          );
        }
        return;
      }
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'DeliFile',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#2563EB',
        });
      }
      const tokenData = await Notifications.getDevicePushTokenAsync();
      const platform: 'android' | 'ios' = Platform.OS === 'ios' ? 'ios' : 'android';
      await pushApi.registerToken(tokenData.data as string, platform);
      Alert.alert('Готово', 'Push-токен зарегистрирован');
    } catch (e: any) {
      Alert.alert('Ошибка', 'Не удалось зарегистрировать токен: ' + (e?.message ?? String(e)));
    } finally {
      setRegistering(false);
    }
  }

  async function toggle(key: NotifKey, value: boolean) {
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
      <Stack.Screen options={{ title: 'Уведомления' }} />

      <View style={styles.section}>
        <View style={styles.item}>
          <View style={styles.itemText}>
            <Text style={styles.itemTitle}>Все уведомления</Text>
            <Text style={styles.itemSub}>Включить / выключить все push-уведомления</Text>
          </View>
          <Switch
            value={user.notifications_enabled}
            onValueChange={(v) => toggle('notifications_enabled', v)}
            trackColor={{ true: '#2563EB' }}
          />
        </View>
      </View>

      <Text style={styles.sectionLabel}>УСТРОЙСТВО</Text>
      <View style={styles.section}>
        <View style={[styles.item, styles.itemBorder]}>
          <View style={styles.itemText}>
            <Text style={styles.itemTitle}>Разрешение на уведомления</Text>
            <Text style={[styles.itemSub, permStatus === 'granted' ? styles.statusOk : styles.statusErr]}>
              {permStatus === 'granted' ? '✓ Разрешено' : permStatus === 'denied' ? '✗ Отклонено' : permStatus === 'undetermined' ? '⚠ Не запрошено' : permStatus}
            </Text>
          </View>
        </View>
        <Pressable style={({ pressed }) => [styles.item, pressed && { opacity: 0.6 }]} onPress={reregisterToken} disabled={registering}>
          <View style={styles.itemText}>
            <Text style={styles.itemTitle}>{registering ? 'Регистрация…' : 'Зарегистрировать токен'}</Text>
            <Text style={styles.itemSub}>Нажмите если уведомления не приходят</Text>
          </View>
        </Pressable>
      </View>

      <Text style={styles.sectionLabel}>ЧТО УВЕДОМЛЯТЬ</Text>
      <View style={styles.section}>
        {ITEMS.map((item, i) => (
          <View key={item.key} style={[styles.item, i < ITEMS.length - 1 && styles.itemBorder]}>
            <View style={styles.itemText}>
              <Text style={[styles.itemTitle, !user.notifications_enabled && styles.dimmed]}>{item.title}</Text>
              <Text style={styles.itemSub}>{item.sub}</Text>
            </View>
            <Switch
              value={user[item.key] as boolean}
              onValueChange={(v) => toggle(item.key, v)}
              disabled={!user.notifications_enabled}
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
  sectionLabel: { fontSize: 11, fontWeight: '600', color: '#94A3B8', letterSpacing: 0.5, marginHorizontal: 16, marginTop: 24, marginBottom: 6 },
  section: { backgroundColor: '#fff', borderRadius: 12, marginHorizontal: 16, marginTop: 16, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  itemText: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: '500', color: '#1E293B' },
  itemSub: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  dimmed: { color: '#CBD5E1' },
  statusOk: { color: '#16A34A' },
  statusErr: { color: '#DC2626' },
});
