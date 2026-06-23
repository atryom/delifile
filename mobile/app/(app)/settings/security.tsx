import { useState, useEffect, useRef } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { authApi } from '@/api/auth';
import { lockpassApi } from '@/api/lockpass';
import { useAuthStore } from '@/store/auth';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getApiError } from '@/utils/error';

export default function SecurityScreen() {
  const qc = useQueryClient();
  const { user, setUser } = useAuthStore((s) => ({ user: s.user, setUser: s.setUser }));
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ current?: string; new?: string; confirm?: string }>({});

  useQuery({
    queryKey: ['me'],
    queryFn: () => authApi.me().then((r) => { setUser(r.data.data.user); return r.data.data.user; }),
    staleTime: 0,
  });

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
      setErrors({});
    },
    onError: (e) => {
      Alert.alert('Ошибка', getApiError(e, 'Не удалось сменить пароль'));
    },
  });

  const revokeSession = useMutation({
    mutationFn: (id: string) => authApi.revokeSession(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  });

  function handleChangePassword() {
    const newErrors: typeof errors = {};
    if (!currentPassword) newErrors.current = 'Введите текущий пароль';
    if (!newPassword) newErrors.new = 'Введите новый пароль';
    else if (newPassword.length < 8) newErrors.new = 'Минимум 8 символов';
    if (!confirmPassword) newErrors.confirm = 'Повторите новый пароль';
    else if (newPassword && newPassword !== confirmPassword) newErrors.confirm = 'Пароли не совпадают';
    if (Object.keys(newErrors).length) { setErrors(newErrors); return; }
    setErrors({});
    changePassword.mutate();
  }

  function confirmRevoke(id: string, name: string) {
    Alert.alert('Отозвать сессию', `Завершить сессию «${name}»?`, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Отозвать', style: 'destructive', onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); revokeSession.mutate(id); } },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Безопасность' }} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Смена пароля</Text>
        <View style={styles.inputGroup}>
          <Input
            placeholder="Текущий пароль"
            value={currentPassword}
            onChangeText={(v) => { setCurrentPassword(v); setErrors((e) => ({ ...e, current: undefined })); }}
            secureTextEntry
            error={errors.current}
          />
          <Input
            placeholder="Новый пароль (мин. 8 символов)"
            value={newPassword}
            onChangeText={(v) => { setNewPassword(v); setErrors((e) => ({ ...e, new: undefined })); }}
            secureTextEntry
            error={errors.new}
          />
          <Input
            placeholder="Повторите новый пароль"
            value={confirmPassword}
            onChangeText={(v) => { setConfirmPassword(v); setErrors((e) => ({ ...e, confirm: undefined })); }}
            secureTextEntry
            error={errors.confirm}
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

      {/* ── 2FA section ── */}
      <TwoFaSection user={user} setUser={setUser} />

    </ScrollView>
  );
}

function TwoFaSection({ user, setUser }: { user: any; setUser: (u: any) => void }) {
  const [connectData, setConnectData] = useState<{ qr_payload: string; deep_link: string; temp_token: string } | null>(null);
  const [loadingQR, setLoadingQR] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setPolling(false);
  }

  useEffect(() => () => stopPolling(), []);

  function startPolling(tempToken: string) {
    stopPolling();
    setPolling(true);
    pollRef.current = setInterval(async () => {
      try {
        const res = await lockpassApi.pollConnect(tempToken);
        const { status, user: updatedUser } = res.data.data;
        if (status === 'connected' && updatedUser) {
          stopPolling();
          setConnectData(null);
          setUser(updatedUser);
          setError(null);
        }
      } catch {
        stopPolling();
        setError('Ошибка при ожидании подключения. Попробуйте снова.');
      }
    }, 2000);
  }

  async function loadQR() {
    if (connectData) { startPolling(connectData.temp_token); return; }
    setLoadingQR(true);
    setError(null);
    try {
      const res = await lockpassApi.initConnect();
      const data = res.data.data;
      setConnectData({ qr_payload: data.qr_payload, deep_link: data.deep_link, temp_token: data.temp_token });
      startPolling(data.temp_token);
    } catch (e) {
      setError(getApiError(e, 'Не удалось загрузить QR'));
    } finally {
      setLoadingQR(false);
    }
  }

  const disableMutation = useMutation({
    mutationFn: () => lockpassApi.disable(),
    onSuccess: (res) => { setUser(res.data.data.user); setError(null); },
    onError: (e) => setError(getApiError(e, 'Не удалось отключить 2FA')),
  });

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Двухфакторная аутентификация</Text>

      {error && <Text style={{ color: '#ef4444', fontSize: 13 }}>{error}</Text>}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={[s2fa.badge, user?.two_factor_enabled ? s2fa.badgeOn : s2fa.badgeOff]}>
          <Text style={s2fa.badgeText}>{user?.two_factor_enabled ? 'Включена' : 'Отключена'}</Text>
        </View>
        {user?.two_factor_enabled && (
          <Text style={{ color: '#64748b', fontSize: 13 }}>Устройств: {user?.devices_count ?? 0}</Text>
        )}
      </View>

      {!user?.two_factor_enabled ? (
        <>
          <Text style={{ color: '#64748b', fontSize: 13 }}>
            Подтверждайте вход в приложении LockPass.
          </Text>
          {!connectData ? (
            <Button title={loadingQR ? 'Загрузка…' : 'Подключить LockPass'} onPress={loadQR} loading={loadingQR} />
          ) : (
            <View style={{ gap: 10 }}>
              <Text style={{ color: '#64748b', fontSize: 13 }}>
                {polling ? 'Ожидаем подтверждения в LockPass…' : 'Откройте LockPass и отсканируйте QR или нажмите кнопку ниже.'}
              </Text>
              <Button title="Открыть в LockPass" onPress={() => Linking.openURL(connectData.deep_link)} />
              <Text style={{ color: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }} numberOfLines={2}>
                {connectData.qr_payload}
              </Text>
            </View>
          )}
        </>
      ) : (
        <>
          <Text style={{ color: '#64748b', fontSize: 13 }}>
            При каждом входе вы получаете push в LockPass.
          </Text>
          <TouchableOpacity
            onPress={() => Alert.alert('Отключить 2FA', 'Вы уверены?', [
              { text: 'Отмена', style: 'cancel' },
              { text: 'Отключить', style: 'destructive', onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); disableMutation.mutate(); } },
            ])}
            style={styles.revokeBtn}
          >
            <Text style={styles.revokeText}>{disableMutation.isPending ? 'Отключение…' : 'Отключить 2FA'}</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const s2fa = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeOn: { backgroundColor: '#dcfce7' },
  badgeOff: { backgroundColor: '#f1f5f9' },
  badgeText: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, gap: 24 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  inputGroup: { gap: 10 },
  sessionList: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  sessionItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 12 },
  sessionInfo: { flex: 1 },
  sessionName: { fontSize: 15, fontWeight: '500', color: '#1E293B' },
  sessionMeta: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  revokeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#FEE2E2' },
  revokeText: { fontSize: 13, color: '#EF4444', fontWeight: '600' },
  empty: { padding: 16, textAlign: 'center', color: '#94A3B8' },
});
