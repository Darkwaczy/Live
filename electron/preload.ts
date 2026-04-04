import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('sermonSync', {
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
  openProjector: () => ipcRenderer.invoke('app:open-projector'),
  send: (channel: string, data: any) => {
    const validChannels = ['transcription:start', 'notes:save', 'sync:status'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  on: (channel: string, callback: (event: any, value: any) => void) => {
    const validChannels = ['transcription:update', 'bible:detected', 'lyrics:update', 'sync:reconnected'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, callback);
    }
  },
  db: {
    saveSession: (session: any) => ipcRenderer.invoke('db:save-session', session),
    saveLiveState: (liveState: any) => ipcRenderer.invoke('db:save-live-state', liveState),
    saveNote: (note: any) => ipcRenderer.invoke('db:save-note', note),
    getNotes: (sessionId: string) => ipcRenderer.invoke('db:get-notes', sessionId),
    getLiveState: (sessionId: string) => ipcRenderer.invoke('db:get-live-state', sessionId),
    getSession: (sessionId: string) => ipcRenderer.invoke('db:get-session', sessionId)
  }
});
