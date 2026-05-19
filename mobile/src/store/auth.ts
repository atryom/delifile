import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { User } from '@/types';

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  setAuth: (token: string, user: User) => Promise<void>;
  setUser: (user: User) => void;
  clearAuth: () => Promise<void>;
  loadToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isLoading: true,

  setAuth: async (token, user) => {
    await SecureStore.setItemAsync('auth_token', token);
    await SecureStore.setItemAsync('auth_user', JSON.stringify(user));
    set({ token, user });
  },

  setUser: (user) => set({ user }),

  clearAuth: async () => {
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('auth_user');
    set({ token: null, user: null });
  },

  loadToken: async () => {
    const token = await SecureStore.getItemAsync('auth_token');
    const userJson = await SecureStore.getItemAsync('auth_user');
    const user = userJson ? (JSON.parse(userJson) as User) : null;
    set({ token, user, isLoading: false });
  },
}));
