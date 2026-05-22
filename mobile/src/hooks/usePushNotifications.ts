import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { pushApi } from '@/api/push';

// How foreground notifications are displayed
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const PROJECT_ID = '5cb7a68e-9f9c-45e8-ac2f-1c9d58b84b5c';

export function usePushNotifications() {
  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();

  useEffect(() => {
    registerForPushAsync();

    // Foreground notification received
    notificationListener.current = Notifications.addNotificationReceivedListener(() => {
      // Badge update, etc. — no-op for now
    });

    // User tapped a notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse,
    );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);
}

async function registerForPushAsync(): Promise<void> {
  if (!Device.isDevice) return; // simulators / emulators don't support push

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    await pushApi.registerToken(tokenData.data, platform);
  } catch {
    // Non-critical — app works without push
  }
}

function handleNotificationResponse(response: Notifications.NotificationResponse): void {
  const url: string | undefined =
    response.notification.request.content.data?.url;
  if (!url) return;

  // Navigate based on URL path from backend deep-link
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
    // Ignore invalid URLs
  }
}
