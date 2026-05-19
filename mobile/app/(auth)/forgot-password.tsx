import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { authApi } from '@/api/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await authApi.forgotPassword(email.trim());
      setSent(true);
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message ?? 'Не удалось отправить письмо');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <View style={styles.center}>
        <Text style={styles.doneTitle}>Письмо отправлено</Text>
        <Text style={styles.doneText}>Проверьте почту и перейдите по ссылке или введите код сброса.</Text>
        <Button title="Ввести код" onPress={() => router.replace({ pathname: '/(auth)/reset-password', params: { email: email.trim() } })} style={styles.btn} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>Введите email — мы отправим инструкцию для сброса пароля.</Text>
        <View style={styles.form}>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Button title="Отправить" onPress={handleSubmit} loading={loading} />
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
  center: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#fff' },
  doneTitle: { fontSize: 22, fontWeight: '700', color: '#1E293B' },
  doneText: { fontSize: 15, color: '#64748B', textAlign: 'center', lineHeight: 22 },
  btn: { width: '100%', marginTop: 8 },
});
