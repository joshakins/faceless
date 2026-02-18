import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('faceless', {
  platform: process.platform,
  onOpenAudioSettings: (callback: () => void): (() => void) => {
    const handler = () => callback();
    ipcRenderer.on('open-audio-settings', handler);
    return () => {
      ipcRenderer.removeListener('open-audio-settings', handler);
    };
  },
});
