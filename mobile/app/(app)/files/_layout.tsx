import { Stack } from 'expo-router';

export default function FilesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: '#2563EB',
        headerStyle: { backgroundColor: '#fff' },
        headerTitleStyle: { color: '#1E293B', fontWeight: '600' },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="add" options={{ presentation: 'modal' }} />
      <Stack.Screen name="shared-folders/index" options={{ title: 'Общие папки' }} />
      <Stack.Screen name="shared-folders/[id]" />
      <Stack.Screen name="shared-folders/add" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
