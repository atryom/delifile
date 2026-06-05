import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useInboxCount } from '@/hooks/useInbox';
import { useContactRequests } from '@/hooks/useContacts';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { View, Text, StyleSheet } from 'react-native';

function TabBarIcon({ name, color, size }: { name: any; color: string; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

function useConnectionsBadge() {
  const { data: inbox } = useInboxCount();
  const { data: requests } = useContactRequests();
  return (inbox?.total ?? 0) + (requests?.filter((r) => r.status === 'pending').length ?? 0);
}

function ConnectionsTabIcon({ color, size }: { color: string; size: number }) {
  const count = useConnectionsBadge();
  return (
    <View>
      <Ionicons name="people-outline" size={size} color={color} />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </View>
  );
}

export default function AppLayout() {
  usePushNotifications();

  return (
    <>
      <OfflineBanner />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#2563EB',
          tabBarInactiveTintColor: '#94A3B8',
          headerShown: true,
          tabBarStyle: { borderTopColor: '#E2E8F0' },
        }}
      >
        <Tabs.Screen
          name="files"
          options={{
            title: 'Файлы',
            headerShown: false,
            tabBarIcon: ({ color, size }) => <TabBarIcon name="folder-outline" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="connections"
          options={{
            title: 'Связи',
            tabBarIcon: ({ color, size }) => <ConnectionsTabIcon color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Настройки',
            tabBarIcon: ({ color, size }) => <TabBarIcon name="settings-outline" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Профиль',
            tabBarIcon: ({ color, size }) => <TabBarIcon name="person-outline" color={color} size={size} />,
          }}
        />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
