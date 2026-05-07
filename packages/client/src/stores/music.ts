import { create } from 'zustand';
import { wsClient } from '../lib/ws.js';
import { useVoiceStore } from './voice.js';
import { useAuthStore } from './auth.js';
import { getAuthToken } from '../lib/api.js';
import { useConnectionStore } from './connection.js';
import type { MusicPlayerState } from '@faceless/shared';
import { Track, type LocalTrackPublication } from 'livekit-client';

interface MusicState {
  playerState: MusicPlayerState | null;

  play: (channelId: string, url: string) => void;
  skip: (channelId: string) => void;
  stop: (channelId: string) => void;
  pause: (channelId: string) => void;
  resume: (channelId: string) => void;

  getPositionMs: () => number;
}

interface MelodyHost {
  trackId: string;
  channelId: string;
  audio: HTMLAudioElement;
  publication: LocalTrackPublication | null;
  mediaTrack: MediaStreamTrack | null;
}

let melodyHost: MelodyHost | null = null;

function getCapturedAudioTrack(audio: HTMLAudioElement): MediaStreamTrack | null {
  const element = audio as HTMLAudioElement & {
    captureStream?: () => MediaStream;
    mozCaptureStream?: () => MediaStream;
  };
  const stream = element.captureStream?.() ?? element.mozCaptureStream?.();
  return stream?.getAudioTracks()[0] ?? null;
}

function getProxiedAudioUrl(trackId: string): string {
  const token = getAuthToken();
  const base = useConnectionStore.getState().getHttpBase();
  return `${base}/music/stream/${encodeURIComponent(trackId)}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
}

function stopMelodyHost(): void {
  if (!melodyHost) return;

  const { room } = useVoiceStore.getState();
  if (room && melodyHost.mediaTrack) {
    room.localParticipant.unpublishTrack(melodyHost.mediaTrack);
  }

  melodyHost.audio.pause();
  melodyHost.audio.removeAttribute('src');
  melodyHost.audio.load();
  melodyHost.mediaTrack?.stop();
  melodyHost = null;
}

async function startMelodyHost(state: MusicPlayerState): Promise<void> {
  const track = state.currentTrack;
  const { room, activeVoiceChannelId } = useVoiceStore.getState();
  if (!track || !room || activeVoiceChannelId !== state.channelId) return;

  if (melodyHost?.trackId === track.id) {
    if (state.isPlaying) {
      await melodyHost.audio.play().catch((err) => {
        console.warn(`[Melody] Could not resume hosted audio: ${(err as Error).message}`);
      });
    } else {
      melodyHost.audio.pause();
    }
    return;
  }

  stopMelodyHost();

  const audio = new Audio();
  audio.crossOrigin = 'anonymous';
  audio.preload = 'auto';
  audio.src = getProxiedAudioUrl(track.id);

  melodyHost = {
    trackId: track.id,
    channelId: state.channelId,
    audio,
    publication: null,
    mediaTrack: null,
  };

  audio.addEventListener('ended', () => {
    wsClient.send('music:ended', { channelId: state.channelId, trackId: track.id });
  });

  try {
    if (state.positionMs > 1000) {
      audio.currentTime = state.positionMs / 1000;
    }
    await audio.play();
  } catch (err) {
    console.warn(`[Melody] Could not play hosted audio: ${(err as Error).message}`);
    stopMelodyHost();
    return;
  }

  const mediaTrack = getCapturedAudioTrack(audio);
  if (!mediaTrack) {
    console.warn('[Melody] Could not capture hosted audio track');
    stopMelodyHost();
    return;
  }

  try {
    const publication = await room.localParticipant.publishTrack(mediaTrack, {
      name: 'melody-audio',
      source: Track.Source.Microphone,
    });
    if (melodyHost?.trackId === track.id) {
      melodyHost.publication = publication;
      melodyHost.mediaTrack = mediaTrack;
      console.info(`[Melody] Hosting "${track.title}" from this client`);
    } else {
      room.localParticipant.unpublishTrack(mediaTrack);
      mediaTrack.stop();
    }
  } catch (err) {
    console.warn(`[Melody] Could not publish hosted audio: ${(err as Error).message}`);
    stopMelodyHost();
  }
}

function syncMelodyHost(state: MusicPlayerState | null): void {
  const userId = useAuthStore.getState().user?.id;
  const voice = useVoiceStore.getState();
  const track = state?.currentTrack;

  if (!state || !track || track.requestedBy !== userId || voice.activeVoiceChannelId !== state.channelId) {
    stopMelodyHost();
    return;
  }

  void startMelodyHost(state);
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
    syncMelodyHost(data.state);
  }
});

wsClient.on('music:error', (data) => {
  console.warn(`[Melody] ${data.message}`);
});

// Clear stale music state when leaving voice channel
useVoiceStore.subscribe((state, prev) => {
  if (prev.activeVoiceChannelId && !state.activeVoiceChannelId) {
    useMusicStore.setState({ playerState: null });
    stopMelodyHost();
    return;
  }
  syncMelodyHost(useMusicStore.getState().playerState);
});
