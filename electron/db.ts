import Store from 'electron-store';

const store = new Store();

export function saveSession(session: any) {
  store.set(`sessions.${session.id}`, session);
  return session;
}

export function saveLiveState(state: any) {
  store.set(`live_state.${state.session_id}`, state);
  return state;
}

export function saveNote(note: any) {
  const notes = store.get(`notes.${note.session_id}`) as any[] || [];
  notes.push(note);
  store.set(`notes.${note.session_id}`, notes);
  return note;
}

export function getNotes(sessionId: string) {
  const notes = store.get(`notes.${sessionId}`) as any[] || [];
  return notes.sort((a, b) => b.timestamp - a.timestamp);
}

export function getLiveState(sessionId: string) {
  return store.get(`live_state.${sessionId}`) || null;
}
