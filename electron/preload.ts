import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('sermonSync', {
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
  openProjector: () => ipcRenderer.invoke('app:open-projector'),
  getProjectorStatus: () => ipcRenderer.invoke('app:get-projector-status'),
  checkNDIRuntime: () => ipcRenderer.invoke('app:check-ndi-runtime'),
  installNDIRuntime: () => ipcRenderer.invoke('app:install-ndi-runtime'),
  getNAtlasStatus: () => ipcRenderer.invoke('app:get-natlas-status'),
  installNAtlas: () => ipcRenderer.invoke('app:install-natlas'),
  onProjectorStatus: (callback: (isActive: boolean) => void) => {
    ipcRenderer.on('projector-status-changed', (_event, isActive) => callback(isActive));
  },
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
    getSession: (sessionId: string) => ipcRenderer.invoke('db:get-session', sessionId),
    searchBibleQuotes: (queryText: string, limit?: number) => ipcRenderer.invoke('db:search-bible', queryText, limit),
    getCrossReferences: (book: string, chapter: number, verse: number, limit?: number) => ipcRenderer.invoke('db:get-cross-references', book, chapter, verse, limit)
  }
});
