import { useEffect, useRef } from 'react';
import { AppState, NativeModules, Platform } from 'react-native';
import { Stack, router } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '@/store/auth';
import { useNetworkStore } from '@/store/network';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 60 * 24,
      networkMode: 'offlineFirst',
    },
  },
});

function RootLayoutInner() {
  const { loadToken } = useAuthStore();
  const setOnline = useNetworkStore((s) => s.setOnline);

  useEffect(() => {
    loadToken();
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOnline(state.isConnected ?? true);
    });
    return unsubscribe;
  }, []);

  // Handle Android share intent — opens /share modal on launch and on each foreground resume
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const mod = NativeModules.ShareIntent;
    if (!mod) return;

    function checkIntent() {
      mod.getSharedData().then((data: any) => {
        if (data) router.push('/share' as any);
      }).catch(() => {});
    }

    checkIntent();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkIntent();
    });
    return () => sub.remove();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
      <Stack.Screen name="link/[token]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="share" options={{ presentation: 'modal', headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <RootLayoutInner />
    </QueryClientProvider>
  );
}
