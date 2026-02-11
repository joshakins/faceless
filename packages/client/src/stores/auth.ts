import { create } from 'zustand';
import { api } from '../lib/api.js';
import { setAuthToken } from '../lib/api.js';
import { wsClient } from '../lib/ws.js';

const TOKEN_KEY = 'faceless-token';

function saveToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  setAuthToken(token);
}

function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  setAuthToken(null);
}

function loadToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) setAuthToken(token);
  return token;
}

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
      const { user, token } = await api.login(username, password);
      saveToken(token);
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
      const { user, token } = await api.register(username, password);
      saveToken(token);
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
    clearToken();
    set({ user: null });
  },

  checkSession: async () => {
    try {
      const { user } = await api.me();
      set({ user, loading: false });
      wsClient.connect();
    } catch {
      clearToken();
      set({ user: null, loading: false });
    }
  },
}));

// Check session on load — only if a token was previously saved
const savedUrl = localStorage.getItem('faceless-server-url');
const savedToken = loadToken();
if (savedUrl && savedToken) {
  useAuthStore.setState({ loading: true });
  useAuthStore.getState().checkSession();
}
