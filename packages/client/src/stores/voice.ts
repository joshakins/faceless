import { create } from 'zustand';
import {
  Room,
  RoomEvent,
  Track,
  RemoteTrackPublication,
  RemoteParticipant,
  Participant,
  LocalTrackPublication,
  type RemoteTrack,
} from 'livekit-client';
import { api } from '../lib/api.js';
import { useAudioSettingsStore } from './audio-settings.js';

interface VoiceState {
  room: Room | null;
  activeVoiceChannelId: string | null;
  participants: string[];
  speakingParticipantIds: Set<string>;
  isMuted: boolean;
  isDeafened: boolean;

  // Screen share
  screenShareTrack: LocalTrackPublication | null;
  isScreenSharing: boolean;
  screenShareParticipantId: string | null;
  screenShareVideoTrack: RemoteTrack | null;

  joinVoice: (channelId: string) => Promise<void>;
  leaveVoice: () => Promise<void>;
  toggleMute: () => void;
  toggleDeafen: () => void;
  startScreenShare: (sourceId: string) => Promise<void>;
  stopScreenShare: () => void;
}

export const useVoiceStore = create<VoiceState>((set, get) => ({
  room: null,
  activeVoiceChannelId: null,
  participants: [],
  speakingParticipantIds: new Set(),
  isMuted: false,
  isDeafened: false,
  screenShareTrack: null,
  isScreenSharing: false,
  screenShareParticipantId: null,
  screenShareVideoTrack: null,

  joinVoice: async (channelId) => {
    // Leave existing room first
    const current = get();
    if (current.room) {
      await current.leaveVoice();
    }

    const { token, url } = await api.getVoiceToken(channelId);
    const { inputDeviceId, outputDeviceId } = useAudioSettingsStore.getState();

    const room = new Room({
      audioCaptureDefaults: inputDeviceId ? { deviceId: { exact: inputDeviceId } } : undefined,
    });

    room.on(RoomEvent.ParticipantConnected, () => {
      set({ participants: Array.from(room.remoteParticipants.keys()) });
    });

    room.on(RoomEvent.ParticipantDisconnected, () => {
      set({ participants: Array.from(room.remoteParticipants.keys()) });
    });

    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrackPublication['track'], pub: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (track && track.kind === Track.Kind.Audio) {
        const element = track.attach();
        document.body.appendChild(element);
      }
      // Screen share video track from a remote participant
      if (track && track.kind === Track.Kind.Video && pub.source === Track.Source.ScreenShare) {
        set({
          screenShareParticipantId: participant.identity,
          screenShareVideoTrack: track as RemoteTrack,
        });
      }
    });

    room.on(RoomEvent.TrackUnsubscribed, (track, pub) => {
      if (pub.source === Track.Source.ScreenShare) {
        track.detach().forEach((el) => el.remove());
        set({
          screenShareParticipantId: null,
          screenShareVideoTrack: null,
        });
      }
    });

    room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
      set({ speakingParticipantIds: new Set(speakers.map((s) => s.identity)) });
    });

    room.on(RoomEvent.Disconnected, () => {
      set({
        room: null,
        activeVoiceChannelId: null,
        participants: [],
        speakingParticipantIds: new Set(),
        screenShareTrack: null,
        isScreenSharing: false,
        screenShareParticipantId: null,
        screenShareVideoTrack: null,
      });
    });

    await room.connect(url, token);
    await room.localParticipant.setMicrophoneEnabled(true);

    if (outputDeviceId) {
      await room.switchActiveDevice('audiooutput', outputDeviceId).catch(() => {});
    }

    set({
      room,
      activeVoiceChannelId: channelId,
      participants: Array.from(room.remoteParticipants.keys()),
      isMuted: false,
      isDeafened: false,
    });
  },

  leaveVoice: async () => {
    const { room, screenShareTrack } = get();
    if (screenShareTrack?.track) {
      screenShareTrack.track.stop();
    }
    if (room) {
      room.disconnect();
    }
    set({
      room: null,
      activeVoiceChannelId: null,
      participants: [],
      speakingParticipantIds: new Set(),
      isMuted: false,
      isDeafened: false,
      screenShareTrack: null,
      isScreenSharing: false,
      screenShareParticipantId: null,
      screenShareVideoTrack: null,
    });
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

  startScreenShare: async (sourceId: string) => {
    const { room, screenShareTrack } = get();
    if (!room || screenShareTrack) return;

    // Check if someone else is already sharing
    for (const participant of room.remoteParticipants.values()) {
      for (const pub of participant.trackPublications.values()) {
        if (pub.source === Track.Source.ScreenShare) {
          return;
        }
      }
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
        },
      } as MediaTrackConstraints,
    });

    const videoTrack = stream.getVideoTracks()[0];

    // Auto-stop when the shared window/screen is closed
    videoTrack.addEventListener('ended', () => {
      get().stopScreenShare();
    });

    const publication = await room.localParticipant.publishTrack(videoTrack, {
      source: Track.Source.ScreenShare,
    });

    set({
      screenShareTrack: publication,
      isScreenSharing: true,
      screenShareParticipantId: room.localParticipant.identity,
      screenShareVideoTrack: null,
    });
  },

  stopScreenShare: () => {
    const { room, screenShareTrack } = get();
    if (!room || !screenShareTrack) return;

    if (screenShareTrack.track) {
      room.localParticipant.unpublishTrack(screenShareTrack.track);
      screenShareTrack.track.stop();
    }

    set({
      screenShareTrack: null,
      isScreenSharing: false,
      screenShareParticipantId: null,
      screenShareVideoTrack: null,
    });
  },
}));
