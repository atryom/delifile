import axios from 'axios';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/auth';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://delifile.ru/api/v1';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const { token, clearAuth } = useAuthStore.getState();
      if (token) {
        await clearAuth();
        router.replace('/(auth)/login');
      }
    }
    return Promise.reject(error);
  }
);
