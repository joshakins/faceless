import { useConnectionStore } from '../stores/connection.js';

let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

function getBase(): string {
  return useConnectionStore.getState().getHttpBase();
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${getBase()}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request<{ user: { id: string; username: string }; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  register: (username: string, password: string) =>
    request<{ user: { id: string; username: string }; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  logout: () =>
    request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),

  me: () =>
    request<{ user: { id: string; username: string } }>('/auth/me'),

  // Servers
  getServers: () =>
    request<{ servers: Array<{ id: string; name: string; ownerId: string }> }>('/servers'),

  createServer: (name: string) =>
    request<{ id: string; name: string }>('/servers', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  joinServer: (code: string) =>
    request<{ serverId: string }>('/servers/join', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  createInvite: (serverId: string) =>
    request<{ code: string }>(`/servers/${serverId}/invites`, { method: 'POST' }),

  getMembers: (serverId: string) =>
    request<{ members: Array<{ id: string; username: string }> }>(`/servers/${serverId}/members`),

  // Channels
  getChannels: (serverId: string) =>
    request<{ channels: Array<{ id: string; name: string; type: 'text' | 'voice'; serverId: string }> }>(`/channels/${serverId}`),

  createChannel: (serverId: string, name: string, type: 'text' | 'voice') =>
    request<{ id: string; name: string; type: string }>(`/channels/${serverId}`, {
      method: 'POST',
      body: JSON.stringify({ name, type }),
    }),

  // Messages
  getMessages: (channelId: string, before?: string) =>
    request<{ messages: Array<{ id: string; channelId: string; authorId: string; content: string; createdAt: number; authorUsername: string }> }>(
      `/messages/${channelId}${before ? `?before=${before}` : ''}`
    ),

  // Voice
  getVoiceToken: (channelId: string) =>
    request<{ token: string; url: string }>('/voice/token', {
      method: 'POST',
      body: JSON.stringify({ channelId }),
    }),
};
