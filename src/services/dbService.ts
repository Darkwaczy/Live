import { supabase } from './supabaseClient';
import { Note } from '../models/note';
import { Session } from '../models/session';
import { LiveState } from '../models/liveState';

const isElectron = typeof window !== 'undefined' && (window as any).sermonSync?.db;
const electronDb = isElectron ? (window as any).sermonSync.db : null;

export async function saveNote(note: Note): Promise<Note> {
  if (electronDb) return electronDb.saveNote(note);
  
  const { data, error } = await supabase.from('notes').insert(note).select().single();
  if (error) throw error;
  return data as Note;
}

export async function saveSession(session: Session): Promise<Session> {
  if (electronDb) return electronDb.saveSession(session);

  const { data, error } = await supabase.from('sessions').upsert(session).select().single();
  if (error) throw error;
  return data as Session;
}

export async function saveLiveState(state: LiveState): Promise<LiveState> {
  if (electronDb) return electronDb.saveLiveState(state);

  const { data, error } = await supabase.from('live_state').upsert(state).select().single();
  if (error) throw error;
  return data as LiveState;
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
  if (electronDb) return electronDb.getLiveState(session_id);

  const { data, error } = await supabase.from('live_state').select('*').eq('session_id', session_id).single();
  if (error) {
    console.warn('getLiveState failed', error);
    return null;
  }
  return data as LiveState;
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
