import { StyleSheet, Text, View } from 'react-native';
import { useNetworkStore } from '@/store/network';

export function OfflineBanner() {
  const isOnline = useNetworkStore((s) => s.isOnline);
  if (isOnline) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>Нет подключения — отображаются кэшированные данные</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  text: { fontSize: 13, color: '#92400E', textAlign: 'center' },
});
