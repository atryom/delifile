import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useAuthStore } from '@/store/auth';
import { Spinner } from '@/components/ui/Spinner';

export default function Index() {
  const { token, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <View style={{ flex: 1 }}>
        <Spinner />
      </View>
    );
  }

  if (token) {
    return <Redirect href="/(app)/files" />;
  }

  return <Redirect href="/(auth)/login" />;
}
