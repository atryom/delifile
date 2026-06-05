import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { authApi } from '@/api/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getApiError } from '@/utils/error';

export default function ResetPasswordScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    if (!code.trim() || !password) return;
    if (password !== passwordConfirm) {
      Alert.alert('Ошибка', 'Пароли не совпадают');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Ошибка', 'Пароль должен содержать минимум 8 символов');
      return;
    }
    setLoading(true);
    try {
      const verify = await authApi.verifyResetToken(code.trim(), email);
      if (verify.data.result !== 'success') {
        Alert.alert('Ошибка', verify.data.message || 'Неверный или истёкший код');
        return;
      }

      const confirmedToken = verify.data.data?.token ?? code.trim();

      const reset = await authApi.resetPassword(confirmedToken, password, passwordConfirm);
      if (reset.data.result) {
        Alert.alert('Готово', 'Пароль изменён. Войдите заново.', [
          { text: 'OK', onPress: () => router.replace('/(auth)/login') },
        ]);
      } else {
        Alert.alert('Ошибка', reset.data.message);
      }
    } catch (e) {
      const msg = getApiError(e, 'Не удалось сбросить пароль');
      Alert.alert('Ошибка', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>Введите 6-значный код из письма и новый пароль.</Text>
        <View style={styles.form}>
          <Input
            label="Код из письма"
            value={code}
            onChangeText={setCode}
            placeholder="123456"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={6}
          />
          <Input
            label="Новый пароль"
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
          <Button title="Сбросить пароль" onPress={handleReset} loading={loading} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  container: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  subtitle: { fontSize: 15, color: '#64748B', marginBottom: 24, lineHeight: 22 },
  form: { gap: 16 },
});
