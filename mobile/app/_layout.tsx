import { Component, useEffect, useRef } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AppState, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ShareIntentModule from '@/native/shareIntent';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '@/store/auth';
import { useNetworkStore } from '@/store/network';

SplashScreen.preventAutoHideAsync();

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'rq-cache',
  throttleTime: 1000,
});

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null; componentStack: string }> {
  state = { error: null, componentStack: '' };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary]', error.message, error.stack, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? '' });
  }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error;
      return (
        <ScrollView style={errStyles.scroll} contentContainerStyle={errStyles.container}>
          <Text style={errStyles.title}>Что-то пошло не так</Text>
          <Text style={errStyles.label}>Ошибка:</Text>
          <Text style={errStyles.code}>{err.message}</Text>
          {!!err.stack && (
            <>
              <Text style={errStyles.label}>Stack:</Text>
              <Text style={errStyles.code}>{err.stack}</Text>
            </>
          )}
          {!!this.state.componentStack && (
            <>
              <Text style={errStyles.label}>Component stack:</Text>
              <Text style={errStyles.code}>{this.state.componentStack}</Text>
            </>
          )}
          <TouchableOpacity style={errStyles.btn} onPress={() => { this.setState({ error: null, componentStack: '' }); try { router.replace('/'); } catch {} }}>
            <Text style={errStyles.btnText}>Вернуться на главную</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

const errStyles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 20, paddingBottom: 40, gap: 8 },
  title: { fontSize: 18, fontWeight: '700', color: '#DC2626', marginBottom: 4 },
  label: { fontSize: 12, fontWeight: '700', color: '#64748B', marginTop: 8 },
  code: { fontSize: 11, color: '#1E293B', backgroundColor: '#F1F5F9', padding: 10, borderRadius: 8, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  btn: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 32, backgroundColor: '#2563EB', borderRadius: 10, alignSelf: 'flex-start' },
  btnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});

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

  // Handle share intent (Android) / Share Extension (iOS)
  // Opens /share modal on launch and on each foreground resume
  const sharePendingRef = useRef(false);
  useEffect(() => {
    const mod = ShareIntentModule;
    if (!mod) return;
    const safeMod = mod;

    let retryCount = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let linkSubscription: { remove: () => void } | null = null;

    function checkIntent() {
      safeMod.getSharedData().then((data: unknown) => {
        if (data) {
          // Guard against opening /share twice: checkIntent runs on mount and on
          // every AppState→active, but the shared payload persists until /share
          // consumes and clears it. Push only once per payload.
          if (!sharePendingRef.current) {
            sharePendingRef.current = true;
            router.push('/share' as any);
          }
          if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
        } else {
          // Payload consumed/cleared — ready for the next share.
          sharePendingRef.current = false;
          // Retry with backoff — UserDefaults may not have synced yet
          // after Share Extension wrote to the App Group container.
          if (retryCount < 3) {
            const delay = [500, 1000, 2000][retryCount];
            retryCount++;
            retryTimer = setTimeout(checkIntent, delay);
          }
        }
      }).catch(() => {});
    }

    // Check on mount — catches cold start with pending share
    checkIntent();

    // Check when app comes to foreground
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        retryCount = 0;
        checkIntent();
      }
    });

    // Handle deep link delifile://share from Share Extension
    Linking.getInitialURL().then((url) => {
      if (url && url.startsWith('delifile://')) {
        retryCount = 0;
        checkIntent();
      }
    });
    linkSubscription = Linking.addEventListener('url', (event) => {
      if (event.url.startsWith('delifile://')) {
        retryCount = 0;
        checkIntent();
      }
    });

    return () => {
      appStateSub.remove();
      linkSubscription?.remove();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="+not-found" />
        <Stack.Screen name="link/[token]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="share" options={{ presentation: 'modal', headerShown: false }} />
      </Stack>
    </>
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
    <AppErrorBoundary>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: asyncStoragePersister }}
      >
        <RootLayoutInner />
      </PersistQueryClientProvider>
    </AppErrorBoundary>
  );
}
