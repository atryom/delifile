import { useEffect, useRef } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { pushApi } from '@/api/push';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function usePushNotifications() {
  const responseListener = useRef<Notifications.EventSubscription | undefined>(undefined);

  useEffect(() => {
    registerForPushAsync();

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(handleNotificationTap);

    return () => responseListener.current?.remove();
  }, []);
}

async function registerForPushAsync(): Promise<void> {
  // Create Android notification channel (required for Android 8+)
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'DeliFile',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
    });
  }

  // Request permission (Android 13+ requires explicit request)
  const { status, canAskAgain } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    if (!canAskAgain) {
      Alert.alert(
        'Уведомления отключены',
        'Разрешите уведомления в настройках, чтобы получать оповещения о файлах.',
        [
          { text: 'Отмена', style: 'cancel' },
          { text: 'Открыть настройки', onPress: () => Linking.openSettings() },
        ],
      );
    }
    return;
  }

  try {
    // Raw FCM token — works without Expo Dashboard credentials
    const tokenData = await Notifications.getDevicePushTokenAsync();
    const platform: 'android' | 'ios' = Platform.OS === 'ios' ? 'ios' : 'android';
    await pushApi.registerToken(tokenData.data as string, platform);
  } catch {
    // Non-critical
  }
}

function handleNotificationTap(response: Notifications.NotificationResponse): void {
  const url = response.notification.request.content.data?.url as string | undefined;
  if (!url) return;
  try {
    const path = new URL(url).pathname;
    if (path.startsWith('/files/')) {
      const id = path.split('/files/')[1]?.split('/')[0];
      if (id) router.push(`/(app)/files/${id}` as any);
    } else if (path.includes('shared-folder')) {
      router.push('/(app)/files/shared-folders' as any);
    } else if (path.includes('support')) {
      router.push('/(app)/settings/support' as any);
    }
  } catch {
    // ignore
  }
}
