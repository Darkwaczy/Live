import { supabase } from './supabaseClient';
import { Note } from '../models/note';
import { Session } from '../models/session';
import { LiveState } from '../models/liveState';

export async function saveNote(note: Note): Promise<Note> {
  const { data, error } = await supabase.from('notes').insert(note).select().single();
  if (error) throw error;
  return data as Note;
}

export async function saveSession(session: Session): Promise<Session> {
  const { data, error } = await supabase.from('sessions').upsert(session).select().single();
  if (error) throw error;
  return data as Session;
}

export async function saveLiveState(state: LiveState): Promise<LiveState> {
  const { data, error } = await supabase.from('live_state').upsert(state).select().single();
  if (error) throw error;
  return data as LiveState;
}

export async function getSession(session_id: string): Promise<Session | null> {
  const { data, error } = await supabase.from('sessions').select('*').eq('id', session_id).single();
  if (error) {
    console.warn('getSession failed', error);
    return null;
  }
  return data as Session;
}

export async function getLiveState(session_id: string): Promise<LiveState | null> {
  const { data, error } = await supabase.from('live_state').select('*').eq('session_id', session_id).single();
  if (error) {
    console.warn('getLiveState failed', error);
    return null;
  }
  return data as LiveState;
}

export async function getNotes(session_id: string): Promise<Note[]> {
  const { data, error } = await supabase.from('notes').select('*').eq('session_id', session_id).order('timestamp', { ascending: false });
  if (error) {
    console.warn('getNotes failed', error);
    return [];
  }
  return data as Note[];
}
