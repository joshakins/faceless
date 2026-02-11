import { create } from 'zustand';
import { wsClient } from '../lib/ws.js';
import type { PresenceStatus } from '@faceless/shared';

interface PresenceState {
  presenceMap: Map<string, { status: PresenceStatus; voiceChannelId: string | null }>;
  getStatus: (userId: string) => PresenceStatus;
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  presenceMap: new Map(),

  getStatus: (userId) => {
    return get().presenceMap.get(userId)?.status ?? 'offline';
  },
}));

wsClient.on('presence:update', (data) => {
  const state = usePresenceStore.getState();
  const updated = new Map(state.presenceMap);
  if (data.status === 'offline') {
    updated.delete(data.userId);
  } else {
    updated.set(data.userId, { status: data.status, voiceChannelId: data.voiceChannelId });
  }
  usePresenceStore.setState({ presenceMap: updated });
});
