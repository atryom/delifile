import { Stack, router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Страница не найдена' }} />
      <View style={styles.container}>
        <Text style={styles.code}>404</Text>
        <Text style={styles.title}>Страница не найдена</Text>
        <Text style={styles.subtitle}>Запрошенный адрес не существует</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(app)/files')}>
          <Text style={styles.btnText}>На главную</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  code: { fontSize: 64, fontWeight: '700', color: '#E2E8F0', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '700', color: '#1E293B', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#64748B', marginBottom: 26, textAlign: 'center' },
  btn: { paddingVertical: 12, paddingHorizontal: 32, backgroundColor: '#2563EB', borderRadius: 10 },
  btnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
