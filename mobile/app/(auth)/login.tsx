import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/auth';
import { getDeviceId, getDeviceType, getDeviceName } from '@/utils/device';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  async function handleLogin() {
    if (!email.trim() || !password) return;
    setLoading(true);
    try {
      const [deviceId, deviceType, deviceName] = await Promise.all([
        getDeviceId(),
        Promise.resolve(getDeviceType()),
        Promise.resolve(getDeviceName()),
      ]);
      const { data } = await authApi.login({
        email: email.trim(),
        password,
        device_id: deviceId,
        device_type: deviceType,
        device_name: deviceName,
      });
      if (data.result === 'success') {
        await setAuth(data.data.token, data.data.user);
        router.replace('/(app)/files');
      } else {
        Alert.alert('Ошибка', data.message);
      }
    } catch (e: any) {
      const msg = e.response?.data?.message ?? 'Не удалось подключиться к серверу';
      Alert.alert('Ошибка', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.logoWrap}>
          <Image source={require('../../assets/images/logo.png')} style={styles.logo} />
          <Text style={styles.title}>DeliFile</Text>
        </View>
        <Text style={styles.subtitle}>Войдите в свой аккаунт</Text>

        <View style={styles.form}>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <Input
            label="Пароль"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoComplete="password"
          />

          <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
            <Text style={styles.link}>Забыли пароль?</Text>
          </TouchableOpacity>

          <Button title="Войти" onPress={handleLogin} loading={loading} />

          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.registerLink}>Нет аккаунта? Зарегистрироваться</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  container: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  logoWrap: { alignItems: 'center', marginBottom: 8, gap: 12 },
  logo: { width: 72, height: 72, borderRadius: 16 },
  title: { fontSize: 32, fontWeight: '700', color: '#2563EB', textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#64748B', textAlign: 'center', marginBottom: 32 },
  form: { gap: 16 },
  link: { fontSize: 14, color: '#2563EB', textAlign: 'right' },
  registerLink: { fontSize: 14, color: '#2563EB', textAlign: 'center', marginTop: 4 },
});
