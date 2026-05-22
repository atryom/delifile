import { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api/auth';
import { pushApi } from '@/api/push';
import * as Notifications from 'expo-notifications';
import { tariffsApi } from '@/api/tariffs';
import { useAuthStore } from '@/store/auth';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { formatFileSize } from '@/utils/format';
import type { TariffPlan } from '@/types';

const PLAN_LABELS: Record<TariffPlan, string> = {
  free: 'Бесплатный',
  silver: 'Серебряный',
  gold: 'Золотой',
};

export default function ProfileScreen() {
  const { user, clearAuth } = useAuthStore();
  const qc = useQueryClient();
  const [tariffModal, setTariffModal] = useState(false);

  const { data: usage } = useQuery({
    queryKey: ['tariffs', 'usage'],
    queryFn: () => tariffsApi.usage().then((r) => r.data.data),
    staleTime: 1000 * 60 * 5,
  });

  const { data: plans } = useQuery({
    queryKey: ['tariffs', 'plans'],
    queryFn: () => tariffsApi.list().then((r) => r.data.data.plans),
    staleTime: 1000 * 60 * 60,
    enabled: tariffModal,
  });

  const requestPlan = useMutation({
    mutationFn: (plan: string) => tariffsApi.requestPlan(plan),
    onSuccess: () => {
      setTariffModal(false);
      Alert.alert('Заявка отправлена', 'Мы обработаем вашу заявку на смену тарифа в ближайшее время.');
    },
    onError: () => Alert.alert('Ошибка', 'Не удалось отправить заявку'),
  });

  async function handleLogout() {
    Alert.alert('Выход', 'Выйти из аккаунта?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Выйти', style: 'destructive',
        onPress: async () => {
          try {
            const tokenData = await Notifications.getExpoPushTokenAsync({
              projectId: '5cb7a68e-9f9c-45e8-ac2f-1c9d58b84b5c',
            });
            await pushApi.unregisterToken(tokenData.data);
          } catch {}
          try { await authApi.logout(); } catch {}
          await clearAuth();
          qc.clear();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  if (!user) return null;

  const storagePercent = usage
    ? Math.min(100, Math.round((usage.storage_used_bytes / usage.storage_limit_bytes) * 100))
    : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.name}>{user.name ?? 'Без имени'}</Text>
        <Text style={styles.email}>{user.email}</Text>
        {user.plan && (
          <View style={styles.planBadge}>
            <Text style={styles.planText}>{(PLAN_LABELS[user.plan] ?? user.plan).toUpperCase()}</Text>
          </View>
        )}
      </View>

      {usage && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Хранилище</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${storagePercent}%` as any }]} />
          </View>
          <Text style={styles.usageText}>
            {formatFileSize(usage.storage_used_bytes)} из {formatFileSize(usage.storage_limit_bytes)}
          </Text>
          {usage.device_limit !== null && (
            <Text style={styles.usageText}>
              Устройств: {usage.device_count} / {usage.device_limit}
            </Text>
          )}
          <TouchableOpacity style={styles.changePlanBtn} onPress={() => setTariffModal(true)}>
            <Text style={styles.changePlanText}>Сменить тариф</Text>
          </TouchableOpacity>
        </View>
      )}

      {user.account_status === 'pending_email_verification' && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>Email не подтверждён. Проверьте почту.</Text>
        </View>
      )}

      <Button title="Выйти из аккаунта" variant="danger" onPress={handleLogout} />

      <Modal visible={tariffModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Сменить тариф</Text>
            {!plans ? (
              <Spinner />
            ) : (
              <View style={styles.planList}>
                {plans.map((p) => (
                  <TouchableOpacity
                    key={p.key}
                    style={[styles.planItem, user.plan === p.key && styles.planItemActive]}
                    onPress={() => requestPlan.mutate(p.key)}
                    disabled={user.plan === p.key || requestPlan.isPending}
                  >
                    <View>
                      <Text style={styles.planItemName}>{PLAN_LABELS[p.key] ?? p.key}</Text>
                      <Text style={styles.planItemMeta}>
                        {p.storage_mb >= 1024 ? `${p.storage_mb / 1024} ГБ` : `${p.storage_mb} МБ`}
                        {' · '}
                        {p.price_rub === 0 ? 'Бесплатно' : `${p.price_rub} ₽/мес`}
                      </Text>
                    </View>
                    {user.plan === p.key && (
                      <Text style={styles.currentBadge}>Текущий</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TouchableOpacity onPress={() => setTariffModal(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, gap: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 8 },
  name: { fontSize: 20, fontWeight: '700', color: '#1E293B' },
  email: { fontSize: 14, color: '#64748B' },
  planBadge: { alignSelf: 'flex-start', backgroundColor: '#EFF6FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  planText: { fontSize: 12, color: '#2563EB', fontWeight: '700' },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#1E293B', marginBottom: 4 },
  progressTrack: { height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#2563EB', borderRadius: 4 },
  usageText: { fontSize: 13, color: '#64748B' },
  changePlanBtn: { marginTop: 4, alignSelf: 'flex-start' },
  changePlanText: { fontSize: 14, color: '#2563EB', fontWeight: '500' },
  warning: { backgroundColor: '#FEF3C7', borderRadius: 12, padding: 14 },
  warningText: { fontSize: 14, color: '#92400E' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 14 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1E293B' },
  planList: { gap: 10 },
  planItem: { padding: 14, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planItemActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  planItemName: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
  planItemMeta: { fontSize: 13, color: '#64748B', marginTop: 2 },
  currentBadge: { fontSize: 12, color: '#2563EB', fontWeight: '600' },
  cancelBtn: { alignItems: 'center', paddingVertical: 4 },
  cancelText: { fontSize: 15, color: '#94A3B8' },
});
