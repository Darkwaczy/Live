"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('sermonSync', {
    getAppVersion: () => electron_1.ipcRenderer.invoke('app:get-version'),
    send: (channel, data) => {
        const validChannels = ['transcription:start', 'notes:save', 'sync:status'];
        if (validChannels.includes(channel)) {
            electron_1.ipcRenderer.send(channel, data);
        }
    },
    on: (channel, callback) => {
        const validChannels = ['transcription:update', 'bible:detected', 'lyrics:update', 'sync:reconnected'];
        if (validChannels.includes(channel)) {
            electron_1.ipcRenderer.on(channel, callback);
        }
    },
    db: {
        saveSession: (session) => electron_1.ipcRenderer.invoke('db:save-session', session),
        saveLiveState: (liveState) => electron_1.ipcRenderer.invoke('db:save-live-state', liveState),
        saveNote: (note) => electron_1.ipcRenderer.invoke('db:save-note', note),
        getNotes: (sessionId) => electron_1.ipcRenderer.invoke('db:get-notes', sessionId),
        getLiveState: (sessionId) => electron_1.ipcRenderer.invoke('db:get-live-state', sessionId),
        getSession: (sessionId) => electron_1.ipcRenderer.invoke('db:get-session', sessionId)
    }
});
