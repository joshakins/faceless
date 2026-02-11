import { create } from 'zustand';
import { api } from '../lib/api.js';
import { wsClient } from '../lib/ws.js';

interface AuthState {
  user: { id: string; username: string } | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  error: null,

  login: async (username, password) => {
    set({ error: null });
    try {
      const { user } = await api.login(username, password);
      set({ user });
      wsClient.connect();
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  register: async (username, password) => {
    set({ error: null });
    try {
      const { user } = await api.register(username, password);
      set({ user });
      wsClient.connect();
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  logout: async () => {
    await api.logout();
    wsClient.disconnect();
    set({ user: null });
  },

  checkSession: async () => {
    try {
      const { user } = await api.me();
      set({ user, loading: false });
      wsClient.connect();
    } catch {
      set({ user: null, loading: false });
    }
  },
}));

// Check session on load — only if a server URL was previously saved
const savedUrl = localStorage.getItem('faceless-server-url');
if (savedUrl) {
  useAuthStore.setState({ loading: true });
  useAuthStore.getState().checkSession();
}
