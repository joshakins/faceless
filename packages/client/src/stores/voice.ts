import { create } from 'zustand';
import { Room, RoomEvent, Track, RemoteTrackPublication, RemoteParticipant } from 'livekit-client';
import { api } from '../lib/api.js';

interface VoiceState {
  room: Room | null;
  activeVoiceChannelId: string | null;
  participants: string[];
  isMuted: boolean;
  isDeafened: boolean;
  joinVoice: (channelId: string) => Promise<void>;
  leaveVoice: () => Promise<void>;
  toggleMute: () => void;
  toggleDeafen: () => void;
}

export const useVoiceStore = create<VoiceState>((set, get) => ({
  room: null,
  activeVoiceChannelId: null,
  participants: [],
  isMuted: false,
  isDeafened: false,

  joinVoice: async (channelId) => {
    // Leave existing room first
    const current = get();
    if (current.room) {
      await current.leaveVoice();
    }

    const { token, url } = await api.getVoiceToken(channelId);

    const room = new Room();

    room.on(RoomEvent.ParticipantConnected, () => {
      set({ participants: Array.from(room.remoteParticipants.keys()) });
    });

    room.on(RoomEvent.ParticipantDisconnected, () => {
      set({ participants: Array.from(room.remoteParticipants.keys()) });
    });

    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrackPublication['track'], _pub: RemoteTrackPublication, _participant: RemoteParticipant) => {
      if (track && track.kind === Track.Kind.Audio) {
        const element = track.attach();
        document.body.appendChild(element);
      }
    });

    room.on(RoomEvent.Disconnected, () => {
      set({ room: null, activeVoiceChannelId: null, participants: [] });
    });

    await room.connect(url, token);
    await room.localParticipant.setMicrophoneEnabled(true);

    set({
      room,
      activeVoiceChannelId: channelId,
      participants: Array.from(room.remoteParticipants.keys()),
      isMuted: false,
      isDeafened: false,
    });
  },

  leaveVoice: async () => {
    const { room } = get();
    if (room) {
      room.disconnect();
    }
    set({ room: null, activeVoiceChannelId: null, participants: [], isMuted: false, isDeafened: false });
  },

  toggleMute: () => {
    const { room, isMuted } = get();
    if (room) {
      room.localParticipant.setMicrophoneEnabled(isMuted);
      set({ isMuted: !isMuted });
    }
  },

  toggleDeafen: () => {
    const { room, isDeafened } = get();
    if (room) {
      // Deafen = mute all remote audio tracks
      for (const participant of room.remoteParticipants.values()) {
        for (const pub of participant.audioTrackPublications.values()) {
          if (pub.track) {
            pub.track.mediaStreamTrack.enabled = isDeafened;
          }
        }
      }
      set({ isDeafened: !isDeafened });
    }
  },
}));
