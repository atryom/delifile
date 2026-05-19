import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  async function handleRegister() {
    if (!email.trim() || !password) return;
    if (password !== passwordConfirm) {
      Alert.alert('Ошибка', 'Пароли не совпадают');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Ошибка', 'Пароль должен содержать минимум 8 символов');
      return;
    }
    if (!agreed) {
      Alert.alert('Ошибка', 'Необходимо принять политику конфиденциальности');
      return;
    }
    setLoading(true);
    try {
      const { data } = await authApi.register({
        email: email.trim(),
        password,
        password_confirmation: passwordConfirm,
      });
      if (data.result === 'success') {
        await setAuth(data.data.token, data.data.user);
        router.replace('/(app)/files');
      } else {
        Alert.alert('Ошибка', data.message);
      }
    } catch (e: any) {
      const msg = e.response?.data?.message ?? 'Не удалось зарегистрироваться';
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
          <Text style={styles.title}>Регистрация</Text>
        </View>

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
            placeholder="Минимум 8 символов"
            secureTextEntry
            autoComplete="new-password"
          />
          <Input
            label="Подтверждение пароля"
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
            placeholder="Повторите пароль"
            secureTextEntry
            autoComplete="new-password"
          />

          <TouchableOpacity style={styles.checkRow} onPress={() => setAgreed((v) => !v)} activeOpacity={0.7}>
            <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
              {agreed && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkLabel}>
              Я прочитал и принимаю{' '}
              <Text
                style={styles.link}
                onPress={() => Linking.openURL('https://delifile.ru/privacy')}
              >
                политику конфиденциальности
              </Text>
            </Text>
          </TouchableOpacity>

          <Button
            title="Зарегистрироваться"
            onPress={handleRegister}
            loading={loading}
          />
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.loginLink}>Уже есть аккаунт? Войти</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  container: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  logoWrap: { alignItems: 'center', marginBottom: 24, gap: 12 },
  logo: { width: 72, height: 72, borderRadius: 16 },
  title: { fontSize: 28, fontWeight: '700', color: '#1E293B', textAlign: 'center' },
  form: { gap: 16 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 },
  checkboxChecked: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  checkLabel: { flex: 1, fontSize: 14, color: '#64748B', lineHeight: 20 },
  link: { color: '#2563EB', textDecorationLine: 'underline' },
  loginLink: { fontSize: 14, color: '#2563EB', textAlign: 'center' },
});
