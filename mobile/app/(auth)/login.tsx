import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { authApi } from '@/api/auth';
import { lockpassApi } from '@/api/lockpass';
import { useAuthStore } from '@/store/auth';
import { getDeviceId, getDeviceType, getDeviceName } from '@/utils/device';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { isValidEmail } from '@/utils/format';
import { getApiError } from '@/utils/error';
import type { TwoFaSession, User } from '@/types';

type Step = 'credentials' | '2fa';
type TwoFaMode = 'push' | 'totp' | 'recovery';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const setAuth = useAuthStore((s) => s.setAuth);

  // 2FA state
  const [step, setStep] = useState<Step>('credentials');
  const [twoFaSession, setTwoFaSession] = useState<TwoFaSession | null>(null);
  const [twoFaMode, setTwoFaMode] = useState<TwoFaMode>('push');
  const [twoFaStatus, setTwoFaStatus] = useState<'pending' | 'approved' | 'rejected' | 'expired'>('pending');
  const [totpCode, setTotpCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [twoFaError, setTwoFaError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(300);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { stopPolling(); };
  }, []);

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  function startTimer() {
    setSecondsLeft(300);
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          stopPolling();
          setTwoFaStatus('expired');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function startPolling(sessionId: string) {
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await lockpassApi.poll(sessionId);
        const status = data.data.status;
        if (status !== 'pending') {
          setTwoFaStatus(status);
          stopPolling();
          if (status === 'approved' && data.data.token && data.data.user) {
            await handleApproved(data.data.token, data.data.user);
          }
        }
      } catch {
        // silently retry
      }
    }, 2000);
  }

  async function handleApproved(token: string, user: User) {
    stopPolling();
    await setAuth(token, user);
    router.replace('/(app)/files');
  }

  async function handleLogin() {
    const newErrors: typeof errors = {};
    if (!isValidEmail(email.trim())) newErrors.email = 'Введите корректный email';
    if (!password) newErrors.password = 'Введите пароль';
    if (Object.keys(newErrors).length) { setErrors(newErrors); return; }
    setErrors({});
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
      if (data.result !== 'success') { Alert.alert('Ошибка', data.message); return; }

      const payload = data.data as any;
      if (payload.requires_2fa) {
        setTwoFaSession(payload as TwoFaSession);
        setStep('2fa');
        startTimer();
        startPolling(payload.session_id);
        return;
      }

      await setAuth(payload.token, payload.user);
      router.replace('/(app)/files');
    } catch (e) {
      const msg = getApiError(e, 'Не удалось подключиться к серверу');
      if (msg.includes('2FA') || msg.includes('LockPass')) {
        Alert.alert('2FA недоступна', msg);
      } else {
        Alert.alert('Ошибка', msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleTotp() {
    if (totpCode.length !== 6 || !twoFaSession) return;
    setLoading(true);
    setTwoFaError(null);
    stopPolling();
    try {
      const { data } = await lockpassApi.verifyTotp(twoFaSession.session_id, totpCode);
      if (data.data.token && data.data.user) {
        await handleApproved(data.data.token, data.data.user);
      }
    } catch (e) {
      const msg = getApiError(e, 'Неверный код');
      setTwoFaError(msg);
      startPolling(twoFaSession.session_id);
    } finally {
      setLoading(false);
    }
  }

  async function handleRecovery() {
    if (!recoveryCode.trim() || !twoFaSession) return;
    setLoading(true);
    setTwoFaError(null);
    stopPolling();
    try {
      const { data } = await lockpassApi.verifyRecovery(twoFaSession.session_id, recoveryCode.trim());
      if (data.data.token && data.data.user) {
        await handleApproved(data.data.token, data.data.user);
      }
    } catch (e) {
      const msg = getApiError(e, 'Неверный код');
      setTwoFaError(msg);
      startPolling(twoFaSession.session_id);
    } finally {
      setLoading(false);
    }
  }

  function retryTwoFa() {
    stopPolling();
    setStep('credentials');
    setTwoFaSession(null);
    setTwoFaStatus('pending');
    setTwoFaMode('push');
    setTotpCode('');
    setRecoveryCode('');
    setTwoFaError(null);
    setSecondsLeft(300);
    setLoading(false);
  }

  const minutes = Math.floor(secondsLeft / 60);
  const secs = String(secondsLeft % 60).padStart(2, '0');

  if (step === '2fa') {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.flex, { paddingTop: insets.top }]}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Двухфакторная аутентификация</Text>

          {/* Timer */}
          <Text style={[styles.timer, secondsLeft < 60 && styles.timerRed]}>
            {minutes}:{secs}
          </Text>

          {/* Status outcomes */}
          {twoFaStatus === 'approved' && (
            <View style={styles.statusBox}>
              <Text style={styles.statusOk}>✓ Подтверждено. Входим…</Text>
              <ActivityIndicator color="#22c55e" style={{ marginTop: 8 }} />
            </View>
          )}
          {twoFaStatus === 'rejected' && (
            <View style={styles.statusBox}>
              <Text style={styles.statusErr}>Запрос отклонён в LockPass</Text>
              <Button title="Попробовать снова" onPress={retryTwoFa} />
            </View>
          )}
          {twoFaStatus === 'expired' && (
            <View style={styles.statusBox}>
              <Text style={styles.statusErr}>Время сессии истекло</Text>
              <Button title="Запросить новый код" onPress={retryTwoFa} />
            </View>
          )}

          {/* Pending UI */}
          {twoFaStatus === 'pending' && (
            <View style={styles.form}>
              {/* Mode tabs */}
              <View style={styles.tabs}>
                {(['push', 'totp', 'recovery'] as TwoFaMode[]).map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.tab, twoFaMode === m && styles.tabActive]}
                    onPress={() => { setTwoFaMode(m); setTwoFaError(null); }}
                  >
                    <Text style={[styles.tabText, twoFaMode === m && styles.tabTextActive]}>
                      {m === 'push' ? 'Push' : m === 'totp' ? 'Код' : 'Резервный'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {twoFaError && <Text style={styles.statusErr}>{twoFaError}</Text>}

              {/* Push */}
              {twoFaMode === 'push' && (
                <View style={styles.pushBlock}>
                  <ActivityIndicator color="#6366f1" size="large" />
                  <Text style={styles.hint}>Подтвердите запрос в приложении LockPass</Text>
                </View>
              )}

              {/* TOTP */}
              {twoFaMode === 'totp' && (
                <View style={styles.totpBlock}>
                  <Text style={styles.hint}>Введите 6-значный код из LockPass</Text>
                  <TextInput
                    style={styles.totpInput}
                    value={totpCode}
                    onChangeText={setTotpCode}
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholder="000000"
                    placeholderTextColor="#94a3b8"
                  />
                  <Button
                    title="Подтвердить"
                    onPress={handleTotp}
                    loading={loading}
                  />
                </View>
              )}

              {/* Recovery */}
              {twoFaMode === 'recovery' && (
                <View style={styles.totpBlock}>
                  <Text style={styles.hint}>Введите резервный код</Text>
                  <TextInput
                    style={styles.totpInput}
                    value={recoveryCode}
                    onChangeText={setRecoveryCode}
                    placeholder="xxxx-xxxx"
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="none"
                  />
                  <Button
                    title="Подтвердить"
                    onPress={handleRecovery}
                    loading={loading}
                  />
                </View>
              )}

              <TouchableOpacity onPress={retryTwoFa}>
                <Text style={styles.link}>← Назад</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.flex, { paddingTop: insets.top }]}>
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
            onChangeText={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: undefined })); }}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            error={errors.email}
          />
          <Input
            label="Пароль"
            value={password}
            onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: undefined })); }}
            placeholder="••••••••"
            secureTextEntry
            autoComplete="password"
            error={errors.password}
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
  title: { fontSize: 28, fontWeight: '700', color: '#2563EB', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#64748B', textAlign: 'center', marginBottom: 32 },
  form: { gap: 16 },
  link: { fontSize: 14, color: '#2563EB', textAlign: 'right' },
  registerLink: { fontSize: 14, color: '#2563EB', textAlign: 'center', marginTop: 4 },
  // 2FA
  timer: { fontSize: 28, fontWeight: '700', color: '#6366f1', textAlign: 'center', marginBottom: 16 },
  timerRed: { color: '#ef4444' },
  statusBox: { alignItems: 'center', gap: 12 },
  statusOk: { color: '#22c55e', fontSize: 16, fontWeight: '600' },
  statusErr: { color: '#ef4444', fontSize: 15, textAlign: 'center' },
  tabs: { flexDirection: 'row', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
  tab: { flex: 1, paddingVertical: 8, backgroundColor: '#f8fafc', alignItems: 'center' },
  tabActive: { backgroundColor: '#6366f1' },
  tabText: { fontSize: 13, fontWeight: '500', color: '#64748b' },
  tabTextActive: { color: '#fff' },
  pushBlock: { alignItems: 'center', gap: 16, paddingVertical: 16 },
  totpBlock: { gap: 12 },
  hint: { textAlign: 'center', color: '#64748b', fontSize: 14 },
  totpInput: {
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8,
    padding: 12, fontSize: 22, textAlign: 'center',
    letterSpacing: 8, color: '#1e293b',
  },
});
