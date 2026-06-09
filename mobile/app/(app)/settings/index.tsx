import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

type SettingsItem = {
  title: string;
  subtitle: string;
  icon: any;
  route: string;
};

const ITEMS: SettingsItem[] = [
  { title: 'Уведомления', subtitle: 'Push-уведомления и их типы', icon: 'notifications-outline', route: '/(app)/settings/notifications' },
  { title: 'Приватность', subtitle: 'Контакты и полученные файлы', icon: 'eye-outline', route: '/(app)/settings/privacy' },
  { title: 'Теги', subtitle: 'Создание и управление тегами', icon: 'pricetag-outline', route: '/(app)/settings/tags' },
  { title: 'Безопасность', subtitle: 'Пароль и сессии устройств', icon: 'shield-outline', route: '/(app)/settings/security' },
  { title: 'Техподдержка', subtitle: 'Обращения и вопросы', icon: 'help-circle-outline', route: '/(app)/settings/support' },
];

export default function SettingsScreen() {
  const version = Constants.expoConfig?.version ?? '—';

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen options={{ title: 'Настройки' }} />
      <View style={styles.list}>
        {ITEMS.map((item) => (
          <TouchableOpacity
            key={item.route}
            style={styles.item}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.7}
          >
            <View style={styles.iconBox}>
              <Ionicons name={item.icon} size={22} color="#2563EB" />
            </View>
            <View style={styles.itemText}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemSub}>{item.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.versionText}>Версия {version}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  list: { marginTop: 20, backgroundColor: '#fff', borderRadius: 12, marginHorizontal: 16, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 14 },
  iconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  itemText: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
  itemSub: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  versionText: { textAlign: 'center', fontSize: 12, color: '#CBD5E1', marginTop: 24, marginBottom: 8 },
});
