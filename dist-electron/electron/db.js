"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveSession = saveSession;
exports.saveLiveState = saveLiveState;
exports.saveNote = saveNote;
exports.getNotes = getNotes;
exports.getLiveState = getLiveState;
const electron_store_1 = __importDefault(require("electron-store"));
const store = new electron_store_1.default();
function saveSession(session) {
    store.set(`sessions.${session.id}`, session);
    return session;
}
function saveLiveState(state) {
    store.set(`live_state.${state.session_id}`, state);
    return state;
}
function saveNote(note) {
    const notes = store.get(`notes.${note.session_id}`) || [];
    notes.push(note);
    store.set(`notes.${note.session_id}`, notes);
    return note;
}
function getNotes(sessionId) {
    const notes = store.get(`notes.${sessionId}`) || [];
    return notes.sort((a, b) => b.timestamp - a.timestamp);
}
function getLiveState(sessionId) {
    return store.get(`live_state.${sessionId}`) || null;
}
