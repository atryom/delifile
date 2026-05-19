import { ActivityIndicator, StyleSheet, View } from 'react-native';

export function Spinner({ size = 'large' }: { size?: 'small' | 'large' }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size={size} color="#2563EB" />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
