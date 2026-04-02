import { create } from 'zustand';
import { wsClient } from '../lib/ws.js';
import { useVoiceStore } from './voice.js';
import type { MusicPlayerState } from '@faceless/shared';

interface MusicState {
  playerState: MusicPlayerState | null;

  play: (channelId: string, url: string) => void;
  skip: (channelId: string) => void;
  stop: (channelId: string) => void;
  pause: (channelId: string) => void;
  resume: (channelId: string) => void;

  getPositionMs: () => number;
}

export const useMusicStore = create<MusicState>((set, get) => ({
  playerState: null,

  play: (channelId, url) => {
    wsClient.send('music:play', { channelId, url });
  },

  skip: (channelId) => {
    wsClient.send('music:skip', { channelId });
  },

  stop: (channelId) => {
    wsClient.send('music:stop', { channelId });
  },

  pause: (channelId) => {
    wsClient.send('music:pause', { channelId });
  },

  resume: (channelId) => {
    wsClient.send('music:resume', { channelId });
  },

  getPositionMs: () => {
    const ps = get().playerState;
    if (!ps?.currentTrack) return 0;
    if (ps.isPlaying) {
      return ps.positionMs + (Date.now() - ps.positionUpdatedAt);
    }
    return ps.positionMs;
  },
}));

// Listen for state updates from server
wsClient.on('music:state', (data) => {
  if (data?.state) {
    useMusicStore.setState({ playerState: data.state });
  }
});

wsClient.on('music:error', (data) => {
  console.warn(`[Melody] ${data.message}`);
});

// Clear stale music state when leaving voice channel
useVoiceStore.subscribe((state, prev) => {
  if (prev.activeVoiceChannelId && !state.activeVoiceChannelId) {
    useMusicStore.setState({ playerState: null });
  }
});
