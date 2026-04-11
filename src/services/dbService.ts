import { supabase } from './supabaseClient';
import { Note } from '../models/note';
import { Session } from '../models/session';
import { LiveState } from '../models/liveState';
import { Song } from '../models/song';

const isElectron = typeof window !== 'undefined' && (window as any).sermonSync?.db;
const electronDb = isElectron ? (window as any).sermonSync.db : null;

export async function saveNote(note: Note): Promise<Note> {
  if (electronDb) await electronDb.saveNote(note);
  
  try {
    const { data, error } = await supabase.from('notes').upsert(note).select().single();
    if (error) throw error;
    return data as Note;
  } catch (err) {
    console.warn('Supabase saveNote failed, remaining local-only', err);
    return note;
  }
}

export async function saveSession(session: Session): Promise<Session> {
  if (electronDb) await electronDb.saveSession(session);

  try {
    const { data, error } = await supabase.from('sessions').upsert(session).select().single();
    if (error) throw error;
    return data as Session;
  } catch (err) {
    console.warn('Supabase saveSession failed, remaining local-only', err);
    return session;
  }
}

export async function saveLiveState(state: LiveState): Promise<LiveState> {
  if (electronDb) await electronDb.saveLiveState(state);

  try {
    const { data, error } = await supabase.from('live_state').upsert(state).select().single();
    if (error) throw error;
    return data as LiveState;
  } catch (err) {
    console.warn('Supabase saveLiveState failed, remaining local-only', err);
    return state;
  }
}

export async function getSession(session_id: string): Promise<Session | null> {
  if (electronDb) return electronDb.getSession(session_id);

  const { data, error } = await supabase.from('sessions').select('*').eq('id', session_id).single();
  if (error) {
    console.warn('getSession failed', error);
    return null;
  }
  return data as Session;
}

export async function getLiveState(session_id: string): Promise<LiveState | null> {
  const sanitize = (state: any): LiveState | null => {
    if (!state) return state;
    return {
      ...state,
      current_verse: null,
      preview_verse: null,
      current_verse_text: '',
      preview_verse_text: '',
      current_lyric_line: null,
      preview_lyric_line: null,
      current_media: null,
      preview_media: null,
      current_text: '',
      preview_text: '',
      is_blank: false,
      is_logo: false,
      current_lyric_index: undefined,
      preview_lyric_index: undefined
    };
  };

  if (electronDb) {
    const raw = await electronDb.getLiveState(session_id);
    return sanitize(raw);
  }

  const { data, error } = await supabase.from('live_state').select('*').eq('session_id', session_id).single();
  if (error) {
    console.warn('getLiveState failed', error);
    return null;
  }
  return sanitize(data);
}

export async function getNotes(session_id: string): Promise<Note[]> {
  if (electronDb) return electronDb.getNotes(session_id);

  const { data, error } = await supabase.from('notes').select('*').eq('session_id', session_id).order('timestamp', { ascending: false });
  if (error) {
    console.warn('getNotes failed', error);
    return [];
  }
  return data as Note[];
}

export async function savePastedSong(song: Song): Promise<void> {
  if (electronDb && electronDb.savePastedSong) {
    await electronDb.savePastedSong(song);
  }
  
  // Also save to a local table if exists, or just keep in Electron Store
  // For now, let's treat it as a per-machine preference
  if (isElectron) {
    const store = (window as any).sermonSync.store;
    if (store) {
      const existing = store.get('pasted_songs') || [];
      store.set('pasted_songs', [song, ...existing]);
    }
  }
}

export async function getPastedSongs(): Promise<Song[]> {
  if (isElectron) {
    const store = (window as any).sermonSync.store;
    return store?.get('pasted_songs') || [];
  }
  return [];
}

export async function searchBibleQuotes(queryText: string, limit: number = 1): Promise<any[]> {
  if (isElectron && electronDb.searchBibleQuotes) {
    return electronDb.searchBibleQuotes(queryText, limit);
  }
  return []; // Fallback for web mode if no cloud API is set up for FTS
}

export async function getCrossReferences(book: string, chapter: number, verse: number, limit: number = 5): Promise<any[]> {
  if (isElectron && electronDb.getCrossReferences) {
    return electronDb.getCrossReferences(book, chapter, verse, limit);
  }
  return []; // Fallback for web mode
}
