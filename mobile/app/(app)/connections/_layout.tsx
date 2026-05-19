import { Stack } from 'expo-router';

export default function ConnectionsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: '#2563EB',
        headerStyle: { backgroundColor: '#fff' },
        headerTitleStyle: { color: '#1E293B', fontWeight: '600' },
      }}
    />
  );
}
