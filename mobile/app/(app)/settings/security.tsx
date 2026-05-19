import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Stack } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api/auth';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';

export default function SecurityScreen() {
  const qc = useQueryClient();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => authApi.sessions().then((r) => r.data.data.items),
  });

  const changePassword = useMutation({
    mutationFn: () => authApi.changePassword(currentPassword, newPassword, confirmPassword),
    onSuccess: () => {
      Alert.alert('Готово', 'Пароль успешно изменён');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (e: any) => {
      Alert.alert('Ошибка', e.response?.data?.message ?? 'Не удалось сменить пароль');
    },
  });

  const revokeSession = useMutation({
    mutationFn: (id: string) => authApi.revokeSession(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  });

  function handleChangePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Ошибка', 'Заполните все поля');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Ошибка', 'Пароли не совпадают');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Ошибка', 'Пароль должен содержать минимум 8 символов');
      return;
    }
    changePassword.mutate();
  }

  function confirmRevoke(id: string, name: string) {
    Alert.alert('Отозвать сессию', `Завершить сессию «${name}»?`, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Отозвать', style: 'destructive', onPress: () => revokeSession.mutate(id) },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Безопасность' }} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Смена пароля</Text>
        <View style={styles.inputGroup}>
          <TextInput
            style={styles.input}
            placeholder="Текущий пароль"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            placeholderTextColor="#94A3B8"
          />
          <TextInput
            style={styles.input}
            placeholder="Новый пароль (мин. 8 символов)"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            placeholderTextColor="#94A3B8"
          />
          <TextInput
            style={styles.input}
            placeholder="Повторите новый пароль"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholderTextColor="#94A3B8"
          />
        </View>
        <Button
          title="Сменить пароль"
          onPress={handleChangePassword}
          loading={changePassword.isPending}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Активные сессии</Text>
        {isLoading ? (
          <Spinner />
        ) : (
          <View style={styles.sessionList}>
            {(sessions ?? []).length === 0 ? (
              <Text style={styles.empty}>Нет активных сессий</Text>
            ) : (
              (sessions ?? []).map((s) => (
                <View key={s.id} style={styles.sessionItem}>
                  <View style={styles.sessionInfo}>
                    <Text style={styles.sessionName}>{s.device_name || 'Устройство'}</Text>
                    <Text style={styles.sessionMeta}>
                      {s.device_type ? `${s.device_type} · ` : ''}{s.ip_address ?? ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => confirmRevoke(s.id, s.device_name || 'устройство')}
                    style={styles.revokeBtn}
                  >
                    <Text style={styles.revokeText}>Отозвать</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, gap: 24 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  inputGroup: { gap: 10 },
  input: { height: 48, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, fontSize: 15, color: '#1E293B', borderWidth: 1, borderColor: '#E2E8F0' },
  sessionList: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  sessionItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 12 },
  sessionInfo: { flex: 1 },
  sessionName: { fontSize: 15, fontWeight: '500', color: '#1E293B' },
  sessionMeta: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  revokeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#FEE2E2' },
  revokeText: { fontSize: 13, color: '#EF4444', fontWeight: '600' },
  empty: { padding: 16, textAlign: 'center', color: '#94A3B8' },
});
