import { create } from 'zustand';

const STORAGE_KEY = 'faceless-server-url';
const DEFAULT_URL = 'localhost:3000';

function loadSavedUrl(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_URL;
  } catch {
    return DEFAULT_URL;
  }
}

interface ConnectionState {
  serverUrl: string;
  setServerUrl: (url: string) => void;
  getHttpBase: () => string;
  getWsUrl: () => string;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  serverUrl: loadSavedUrl(),

  setServerUrl: (url: string) => {
    // Strip trailing slashes and protocol prefixes for clean storage
    const clean = url.replace(/\/+$/, '').replace(/^https?:\/\//, '');
    localStorage.setItem(STORAGE_KEY, clean);
    set({ serverUrl: clean });
  },

  getHttpBase: () => {
    const { serverUrl } = get();
    return `http://${serverUrl}/api`;
  },

  getWsUrl: () => {
    const { serverUrl } = get();
    return `ws://${serverUrl}/ws`;
  },
}));
