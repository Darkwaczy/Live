import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';

const dbPath = path.join(os.homedir(), 'sermonsync-local.sqlite');
const db = new Database(dbPath, { verbose: console.log });

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    name TEXT,
    status TEXT,
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS live_state (
    session_id TEXT PRIMARY KEY,
    current_text TEXT,
    current_verse TEXT,
    current_song TEXT,
    current_line INTEGER,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    session_id TEXT,
    content TEXT,
    timestamp INTEGER,
    context TEXT,
    created_at TEXT,
    updated_at TEXT
  );
`);

export function saveSession(session: any) {
  const stmt = db.prepare(`INSERT OR REPLACE INTO sessions (id,name,status,created_at,updated_at) VALUES (?,?,?,?,?)`);
  return stmt.run(session.id, session.name, session.status, session.created_at, session.updated_at);
}

export function saveLiveState(state: any) {
  const stmt = db.prepare(`INSERT OR REPLACE INTO live_state (session_id,current_text,current_verse,current_song,current_line,updated_at) VALUES (?,?,?,?,?,?)`);
  return stmt.run(state.session_id, state.current_text, JSON.stringify(state.current_verse), state.current_song, state.current_line, state.updated_at);
}

export function saveNote(note: any) {
  const stmt = db.prepare(`INSERT INTO notes (user_id,session_id,content,timestamp,context,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`);
  return stmt.run(note.user_id, note.session_id, note.content, note.timestamp, JSON.stringify(note.context || {}), new Date().toISOString(), new Date().toISOString());
}

export function getNotes(sessionId: string) {
  const stmt = db.prepare(`SELECT * FROM notes WHERE session_id = ? ORDER BY timestamp DESC`);
  return stmt.all(sessionId);
}

export function getLiveState(sessionId: string) {
  const stmt = db.prepare(`SELECT * FROM live_state WHERE session_id = ?`);
  return stmt.get(sessionId);
}
