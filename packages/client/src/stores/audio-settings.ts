import { create } from 'zustand';
import { useVoiceStore } from './voice.js';

const INPUT_KEY = 'faceless-audio-input';
const OUTPUT_KEY = 'faceless-audio-output';

interface AudioSettingsState {
  inputDeviceId: string;
  outputDeviceId: string;
  setInputDevice: (deviceId: string) => void;
  setOutputDevice: (deviceId: string) => void;
}

export const useAudioSettingsStore = create<AudioSettingsState>((set) => ({
  inputDeviceId: localStorage.getItem(INPUT_KEY) || '',
  outputDeviceId: localStorage.getItem(OUTPUT_KEY) || '',

  setInputDevice: (deviceId) => {
    localStorage.setItem(INPUT_KEY, deviceId);
    set({ inputDeviceId: deviceId });
  },

  setOutputDevice: (deviceId) => {
    localStorage.setItem(OUTPUT_KEY, deviceId);
    set({ outputDeviceId: deviceId });

    // If currently in a voice room, switch output device immediately
    const room = useVoiceStore.getState().room;
    if (room) {
      room.switchActiveDevice('audiooutput', deviceId || 'default').catch(() => {});
    }
  },
}));
