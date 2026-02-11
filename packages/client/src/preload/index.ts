import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('faceless', {
  platform: process.platform,
});
